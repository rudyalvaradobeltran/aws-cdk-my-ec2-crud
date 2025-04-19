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
