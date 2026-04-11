#!/bin/bash
set -e

echo "Building server..."
npm run build

echo "Creating Fly.io app..."
fly apps create messenger-server --no-confirm || true

echo "Setting secrets..."
fly secrets set DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" NODE_ENV=production

echo "Deploying..."
fly deploy

echo "Done! Your server is deployed at: https://messenger-server.fly.dev"
