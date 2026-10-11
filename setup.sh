#!/usr/bin/env bash
set -e

echo "🪰 Fly Assistant Setup"
echo "====================="
echo ""

# Find Python 3.12+
PYTHON=""
for cmd in python3.13 python3.12 python3; do
    if command -v "$cmd" &> /dev/null; then
        version=$("$cmd" --version 2>&1 | awk '{print $2}')
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -eq 3 ] && [ "$minor" -ge 12 ]; then
            PYTHON="$cmd"
            echo "✓ Found Python $version at $cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "❌ Python 3.12 or newer required"
    echo "Install with: brew install python@3.13"
    exit 1
fi

# Create virtual environment
if [ ! -d .venv ]; then
    echo "Creating virtual environment..."
    "$PYTHON" -m venv .venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment exists"
fi

# Activate and install dependencies
source .venv/bin/activate

echo "Installing dependencies..."
pip install --quiet --upgrade pip
pip install -r requirements.txt
echo "✓ Dependencies installed"

# Setup flybrain
echo ""
echo "Setting up flybrain connectome data..."
cd flybrain

if [ ! -f malecns_graph.npz ]; then
    echo "Running flybrain setup (downloads ~1.1GB, converts data)..."
    ./setup.sh
    echo "✓ Flybrain connectome ready"
else
    echo "✓ Flybrain connectome already set up"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start:"
echo "  ./run.sh        # Launch server and visualization"
echo "  ./train.py      # Start training"
