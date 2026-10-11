#!/usr/bin/env bash
set -e

if [ ! -d .venv ]; then
    echo "❌ Run ./setup.sh first"
    exit 1
fi

source .venv/bin/activate

# Default port
PORT=${1:-8766}

echo "🪰 Starting Fly Assistant server on http://127.0.0.1:$PORT"
python src/server/server.py --port "$PORT"
