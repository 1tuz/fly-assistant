"""
HTTP server for fly-assistant visualization.

Serves static files and provides API for current simulation state.
"""
import http.server
import socketserver
import json
import argparse
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import threading
import time


class SimulationState:
    """Shared state between simulation and visualization."""
    
    def __init__(self):
        self.lock = threading.Lock()
        self.world = None
        self.info = {}
        self.running = False
    
    def update(self, world, info):
        """Update state from environment step."""
        with self.lock:
            self.world = world
            self.info = info
            self.running = True
    
    def get(self):
        """Get current state."""
        with self.lock:
            return {
                'world': self.world,
                'running': self.running,
                **self.info
            }
    
    def stop(self):
        """Mark simulation as stopped."""
        with self.lock:
            self.running = False


# Global state
STATE = SimulationState()


class FlyAssistantHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with API endpoints."""
    
    def __init__(self, *args, **kwargs):
        # Serve from web/ directory
        super().__init__(*args, directory="web", **kwargs)
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/state':
            self.send_json_response(STATE.get())
        elif parsed_path.path == '/api/ping':
            self.send_json_response({'status': 'ok'})
        else:
            # Serve static files
            super().do_GET()
    
    def send_json_response(self, data):
        """Send JSON response."""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Suppress request logging (less noise)."""
        pass


def run_server(port=8766):
    """Start HTTP server."""
    with socketserver.TCPServer(("", port), FlyAssistantHandler) as httpd:
        print(f"🪰 Server running at http://127.0.0.1:{port}")
        print(f"   Open http://127.0.0.1:{port} in your browser")
        print("")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✓ Server stopped")


def main():
    parser = argparse.ArgumentParser(description='Fly Assistant HTTP server')
    parser.add_argument('--port', type=int, default=8766,
                       help='HTTP port (default: 8766)')
    args = parser.parse_args()
    
    run_server(args.port)


if __name__ == '__main__':
    main()
