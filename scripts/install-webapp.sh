#!/bin/bash

set -euxo pipefail

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
pm2 startup | grep sudo | bash

echo "Installing NGINX..."

# Install NGINX
sudo dnf install nginx -y

echo "Setting up reverse proxy..."

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