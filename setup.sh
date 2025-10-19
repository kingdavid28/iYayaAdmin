#!/bin/bash

echo "🚀 iYaya Admin - React Native Setup Script"
echo "============================================="

# Check Node.js version
echo "📋 Checking Node.js version..."
node_version=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$node_version" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required"
    echo "Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version $(node -v) - OK"

# Check npm
echo "📋 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm is installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# iOS setup
echo "🍎 Setting up iOS (if on macOS)..."
if [ -d "ios" ]; then
    cd ios
    if command -v pod &> /dev/null; then
        pod install
        if [ $? -eq 0 ]; then
            echo "✅ iOS dependencies installed"
        else
            echo "⚠️ iOS setup failed, but continuing..."
        fi
    else
        echo "⚠️ CocoaPods not found, skipping iOS setup"
    fi
    cd ..
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📱 To run the application:"
echo ""
echo "1. Start the Metro bundler:"
echo "   npm start"
echo ""
echo "2. Run on Android:"
echo "   npm run android"
echo ""
echo "3. Run on iOS:"
echo "   npm run ios"
echo ""
echo "4. Make sure your iYaya backend is running on http://localhost:5000"
echo ""
echo "📚 For more information, see README.md"
