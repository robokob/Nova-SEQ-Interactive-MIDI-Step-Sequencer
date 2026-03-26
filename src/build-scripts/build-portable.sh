#!/bin/bash

echo "🎵 Building Portable Step Sequencer..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🔧 Installing additional Electron dependencies...${NC}"
npm install --save-dev concurrently wait-on

echo -e "${BLUE}📁 Creating build resources directory...${NC}"
mkdir -p build-resources

# Create basic icon files if they don't exist
if [ ! -f "build-resources/icon.png" ]; then
    echo -e "${YELLOW}📷 Creating default app icon...${NC}"
    # Create a simple SVG icon and convert to PNG
    cat > build-resources/icon.svg << 'EOF'
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" fill="#1a1a1a" rx="32"/>
  <rect x="32" y="32" width="48" height="48" fill="#4ade80" rx="8"/>
  <rect x="96" y="32" width="48" height="48" fill="#3b82f6" rx="8"/>
  <rect x="160" y="32" width="48" height="48" fill="#f59e0b" rx="8"/>
  <rect x="224" y="32" width="48" height="48" fill="#ef4444" rx="8"/>
  <rect x="32" y="96" width="48" height="48" fill="#8b5cf6" rx="8"/>
  <rect x="96" y="96" width="48" height="48" fill="#06b6d4" rx="8"/>
  <rect x="160" y="96" width="48" height="48" fill="#10b981" rx="8"/>
  <rect x="224" y="96" width="48" height="48" fill="#f97316" rx="8"/>
  <rect x="32" y="160" width="48" height="48" fill="#ec4899" rx="8"/>
  <rect x="96" y="160" width="48" height="48" fill="#84cc16" rx="8"/>
  <rect x="160" y="160" width="48" height="48" fill="#6366f1" rx="8"/>
  <rect x="224" y="160" width="48" height="48" fill="#14b8a6" rx="8"/>
  <rect x="32" y="224" width="48" height="48" fill="#f43f5e" rx="8"/>
  <rect x="96" y="224" width="48" height="48" fill="#a855f7" rx="8"/>
  <rect x="160" y="224" width="48" height="48" fill="#0ea5e9" rx="8"/>
  <rect x="224" y="224" width="48" height="48" fill="#22c55e" rx="8"/>
  <text x="128" y="140" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">STEP</text>
  <text x="128" y="168" text-anchor="middle" fill="white" font-family="Arial" font-size="16">SEQUENCER</text>
</svg>
EOF
    
    # Copy icon files (for now just copy the same file)
    cp build-resources/icon.svg build-resources/icon.png 2>/dev/null || echo "Icon created"
fi

echo -e "${BLUE}⚛️ Building React application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ React build failed!${NC}"
    exit 1
fi

echo -e "${BLUE}📱 Building Electron application...${NC}"

# Build portable versions for all platforms
echo -e "${YELLOW}🖥️ Building Windows portable...${NC}"
npm run dist-portable

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Electron build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${GREEN}📁 Portable apps available in: dist-electron/${NC}"
echo ""
echo -e "${BLUE}📋 Files created:${NC}"
if [ -d "dist-electron" ]; then
    ls -la dist-electron/ | grep -E "\.(exe|dmg|zip|AppImage)$"
else
    echo "   Build directory not found - check for errors above"
fi

echo ""
echo -e "${GREEN}🎉 Your portable step sequencer is ready!${NC}"
echo -e "${YELLOW}📖 To distribute:${NC}"
echo "   • Windows: Share the .exe file (no installation needed)"
echo "   • macOS: Share the .zip file (extract and run)"
echo "   • Linux: Share the .AppImage file (no installation needed)"

echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo "   1. Test the app: Open the generated executable"
echo "   2. Connect MIDI device and test MIDI output"
echo "   3. Share the portable file - no installation required!"