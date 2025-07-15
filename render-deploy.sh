#!/bin/bash

# Render Deployment Script for Daveenci CRM
# This script handles the complete deployment process for Render
# Use this when database tables already exist

set -e  # Exit on any error

echo "🚀 Starting Render deployment for Daveenci CRM..."

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install
cd server && npm install && cd ..
cd src && npm install && cd ..

# Step 2: Navigate to server directory for database operations
cd server

# Step 3: Generate Prisma client (skip migrations since tables exist)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Step 4: Build server
echo "🏗️  Building server..."
npm run build

# Step 5: Go back to root and build frontend
cd ..
echo "🎨 Building frontend..."
npm run build --prefix src

echo "✅ Build completed successfully!"
echo "🎯 Use these commands in Render:"
echo "   Build Command: npm run render:build"
echo "   Start Command: npm run render:start"

# Optional: If you need to run migrations later, use:
# echo "To run migrations later: cd server && npx prisma migrate deploy" 