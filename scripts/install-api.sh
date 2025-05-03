#!/bin/bash

set -euxo pipefail

cd /home/ec2-user/api || exit 1

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
sudo chown -R ec2-user:ec2-user /home/ec2-user/api

# Install app dependencies
npm install --omit=dev

# Install PM2 globally
npm install -g pm2

# Start app with PM2
pm2 delete nestjs-api || true
pm2 start dist/main.js --name nestjs-api
pm2 save

# Temporarily disable exit on error for PM2 startup
set +e
echo "Setting up PM2 startup..."
pm2 startup | grep sudo | bash
PM2_STARTUP_STATUS=$?
set -e

if [ $PM2_STARTUP_STATUS -ne 0 ]; then
  echo "Warning: PM2 startup command failed, but continuing with installation..."
fi

# Install NGINX
sudo dnf install nginx -y

# Set up reverse proxy to port 3000
sudo tee /etc/nginx/conf.d/api.conf > /dev/null <<EOF
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
MAX_RETRIES=5
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  # Check if port 3000 is in use
  if netstat -tuln | grep -q ":3000 "; then
    echo "API is running on port 3000!"
    exit 0
  fi
  echo "API not ready yet, retrying in 5 seconds... (Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
  sleep 5
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

echo "Error: API is not running on port 3000 after $MAX_RETRIES attempts"
echo "Checking PM2 status..."
pm2 list
echo "Checking PM2 logs..."
pm2 logs nestjs-api --lines 20
exit 1