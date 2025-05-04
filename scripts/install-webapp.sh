#!/bin/bash

set -euxo pipefail

# Check if Webapp is already installed and running
if [ -d "/home/ec2-user/webapp" ] && pm2 list | grep -q "nextjs-app"; then
  echo "Webapp is already installed and running. Restarting..."
  pm2 stop nextjs-app 2>/dev/null
  pm2 delete nextjs-app 2>/dev/null
  pm2 start npm --name nextjs-app -- start
  pm2 save
  
  set +e
  echo "Setting up PM2 startup..."
  pm2 startup | grep sudo | bash
  PM2_STARTUP_STATUS=$?
  set -e
  
  sudo systemctl restart nginx
  exit 0
fi

cd /home/ec2-user/webapp || exit 1

# Install NVM if not already installed
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "Installing NVM..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
source "$NVM_DIR/nvm.sh"

# Install Node.js
nvm install 18
nvm use 18

# Make sure ec2-user owns all files
sudo chown -R ec2-user:ec2-user /home/ec2-user/webapp

# Install app dependencies
npm install --omit=dev

# Install PM2 globally
npm install -g pm2

# Start app with PM2
pm2 delete nextjs-app || true
pm2 start npm --name nextjs-app -- start
pm2 save

# Temporarily disable exit on error for PM2 startup
set +e
echo "Setting up PM2 startup..."
pm2 startup | grep sudo | bash
PM2_STARTUP_STATUS=$?
set -e

# Install NGINX
sudo dnf install nginx -y

# Set up reverse proxy to port 3000
sudo tee /etc/nginx/conf.d/nextjs.conf > /dev/null <<EOF
server {
  listen 80;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_cache_bypass \$http_upgrade;
  }
}
EOF

# Remove default NGINX configuration
sudo rm -f /etc/nginx/conf.d/default.conf || true

# Start and enable Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# Wait for the app to be ready
echo "Waiting for API to be ready..."
sleep 10
if netstat -tuln | grep -q ":3000 "; then
  if curl -s http://localhost:3000 > /dev/null; then
    echo "API is accessible on port 3000"
  fi
  
  if curl -s http://localhost:80 > /dev/null; then
    echo "API is accessible through NGINX on port 80"
    exit 0
  fi
fi