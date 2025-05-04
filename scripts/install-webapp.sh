#!/bin/bash

set -euo pipefail

echo "Starting webapp deployment process..."

# Setup environment
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source "$NVM_DIR/nvm.sh"
else
  echo "NVM already installed, sourcing..."
  source "$NVM_DIR/nvm.sh"
fi

# Install Node.js
echo "Setting up Node.js..."
nvm install 18
nvm use 18

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
else
  echo "PM2 already installed"
fi

# Check if we're in the webapp directory
cd /home/ec2-user/webapp || { echo "Failed to enter webapp directory"; exit 1; }

# Ensure proper ownership
echo "Setting proper file permissions..."
sudo chown -R ec2-user:ec2-user /home/ec2-user/webapp

# Install app dependencies, but skip dev dependencies
echo "Installing dependencies..."
npm install --omit=dev

# Stop any existing webapp processes
echo "Stopping any existing processes..."
pm2 stop nextjs-app 2>/dev/null || echo "No existing nextjs-app process found"
pm2 delete nextjs-app 2>/dev/null || echo "No existing nextjs-app process to delete"

# Start the application with PM2
echo "Starting application with PM2..."
pm2 start npm --name nextjs-app -- start
pm2 save

# Set PM2 to start on system boot
echo "Setting up PM2 startup..."
pm2_startup_cmd=$(pm2 startup | grep 'sudo' | tail -n 1)
if [ -n "$pm2_startup_cmd" ]; then
  echo "Running PM2 startup command: $pm2_startup_cmd"
  eval "$pm2_startup_cmd"
else
  echo "Failed to get PM2 startup command, attempting default setup"
  sudo env PATH=$PATH:/home/ec2-user/.nvm/versions/node/v18*/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
fi

# Set up Nginx
echo "Setting up Nginx..."
if ! command -v nginx &> /dev/null; then
  echo "Installing Nginx..."
  sudo dnf install nginx -y
else
  echo "Nginx already installed"
fi

# Configure Nginx reverse proxy
echo "Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/conf.d/nextjs.conf > /dev/null <<EOF
server {
  listen 80;
  server_name _;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
  }
}
EOF

# Remove default Nginx configuration
echo "Removing default Nginx configuration..."
sudo rm -f /etc/nginx/conf.d/default.conf || echo "No default.conf to remove"

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t || { echo "Nginx configuration test failed"; exit 1; }

# Start and enable Nginx
echo "Starting and enabling Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Wait for the app to be ready
echo "Waiting for webapp to be ready..."
attempt=0
max_attempts=10
until curl -s http://localhost:3000 > /dev/null || [ $attempt -eq $max_attempts ]
do
  attempt=$((attempt+1))
  echo "Waiting for webapp to start... ($attempt/$max_attempts)"
  sleep 5
done

if [ $attempt -eq $max_attempts ]; then
  echo "WARNING: Could not connect to webapp on port 3000 after $max_attempts attempts"
  echo "PM2 process status:"
  pm2 status
  echo "Nginx status:"
  sudo systemctl status nginx
  echo "Port 3000 status:"
  netstat -tuln | grep 3000 || echo "No process listening on port 3000"
  
  # Try to recover by restarting PM2 process
  echo "Attempting recovery by restarting PM2 process..."
  pm2 restart nextjs-app
  sleep 5
else
  echo "Webapp is accessible on port 3000"
fi

# Verify Nginx is working
if curl -s http://localhost:80 > /dev/null; then
  echo "Webapp is accessible through Nginx on port 80"
  echo "Deployment completed successfully!"
else
  echo "WARNING: Webapp is not accessible through Nginx"
  echo "Nginx error log:"
  sudo tail -n 20 /var/log/nginx/error.log
  
  # Try to recover by restarting Nginx
  echo "Attempting recovery by restarting Nginx..."
  sudo systemctl restart nginx
  sleep 2
  
  if curl -s http://localhost:80 > /dev/null; then
    echo "Webapp is now accessible through Nginx on port 80 after restart"
    echo "Deployment completed successfully!"
  else
    echo "WARNING: Webapp is still not accessible through Nginx after restart"
  fi
fi

# Print PM2 status for verification
echo "Current PM2 processes:"
pm2 list

exit 0