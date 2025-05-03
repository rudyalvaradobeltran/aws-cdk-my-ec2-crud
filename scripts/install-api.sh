#!/bin/bash

set -euxo pipefail

# Check if API is already installed and running
if [ -d "/home/ec2-user/api" ] && pm2 list | grep -q "nestjs-api"; then
  echo "API is already installed and running. Skipping installation."
  exit 0
fi

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

# Backup original nginx.conf
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Update main nginx.conf
sudo tee /etc/nginx/nginx.conf > /dev/null <<EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                      '\$status \$body_bytes_sent "\$http_referer" '
                      '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    tcp_nodelay         on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    include /etc/nginx/conf.d/*.conf;

    server {
        listen       80 default_server;
        listen       [::]:80 default_server;
        server_name  _;

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}
EOF

# Remove any existing configurations
sudo rm -f /etc/nginx/conf.d/*.conf

# Test NGINX configuration
echo "Testing NGINX configuration..."
sudo nginx -t

# Start and enable Nginx
echo "Starting NGINX..."
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