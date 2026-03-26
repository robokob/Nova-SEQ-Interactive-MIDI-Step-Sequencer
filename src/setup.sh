#!/bin/bash

echo "======================================"
echo "Step Sequencer - Complete Setup"
echo "======================================"
echo ""

# Stop any running dev server
echo "→ Stopping any running dev servers..."
pkill -f "vite" 2>/dev/null || true
sleep 2

# Clean everything
echo "→ Cleaning old build files and dependencies..."
rm -rf node_modules
rm -rf dist
rm -rf .vite
rm -f package-lock.json
rm -f yarn.lock

echo "→ Installing dependencies (this may take a minute)..."
npm install

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Now run: npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo ""
