#!/bin/bash

set -e

cd /home/ec2-user/webapp || exit 1

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh" || true

if ! command -v node >/dev/null; then
  echo "Installing Node.js..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  nvm install 18
  nvm use 18
fi

echo "Installing dependencies..."
npm install --omit=dev

echo "Installing pm2..."
npm install -g pm2

echo "Starting app with pm2..."
pm2 delete webapp || true
pm2 start npm --name webapp -- start
pm2 save
pm2 startup | grep sudo | bash
