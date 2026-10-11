"""
HTTP server for fly-assistant visualization.

Serves static files and provides API for current simulation state.
"""
import http.server
import json
import argparse
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import threading
import time
import sys
import numpy as np


class SimulationState:
    """Shared state between simulation and visualization."""
    
    def __init__(self):
        self.lock = threading.Lock()
        self.world = None
        self.info = {}
        self.running = False
        self.status = "starting"
        self.error = None
    
    def update(self, world, info):
        """Update state from environment step."""
        info = dict(info)
        if "target_shelf" in info:
            info["target_shelf"] = int(info["target_shelf"])
        with self.lock:
            self.world = world
            self.info = info
            self.status = info.get("status", "running")
            self.running = self.status in {"running", "training"}
            self.error = None

    def fail(self, error):
        with self.lock:
            self.running = False
            self.status = "error"
            self.error = error

    def annotate(self, **info):
        with self.lock:
            self.info.update(info)
            if "status" in info:
                self.status = info["status"]
                self.running = self.status in {"running", "training"}
    
    def get(self):
        """Get current state."""
        with self.lock:
            return {
                'world': self.world,
                'running': self.running,
                'status': self.status,
                'error': self.error,
                **self.info
            }
    
    def stop(self):
        """Mark simulation as stopped."""
        with self.lock:
            self.running = False


# Global state
STATE = SimulationState()
STOP_SIMULATION = threading.Event()
STOP_TRAINING = threading.Event()
COMMAND = {}
COMMAND_LOCK = threading.Lock()


def set_command(command):
    with COMMAND_LOCK:
        COMMAND.update(command)


def take_command():
    with COMMAND_LOCK:
        command = dict(COMMAND)
        COMMAND.clear()
        return command


def autonomous_action(world):
    """Choose one connectome drive for the next step of the shelf task."""
    goal_shelf = world.target_shelf if world.object_is_carried else 1 - world.target_shelf
    goal = world.SHELF_LEFT_POS if goal_shelf == 0 else world.SHELF_RIGHT_POS
    delta = goal - world.fly_pos
    angle = float(np.arctan2(delta[0], delta[2]) - world.fly_yaw)
    angle = float(np.arctan2(np.sin(angle), np.cos(angle)))
    distance = world.distance_to_shelf(goal_shelf)
    if not world.object_is_carried and distance < world.GRASP_RADIUS:
        return [0.0, 0.0, 0.0, 250.0, 0.0]
    if abs(angle) > 0.12:
        return [0.0, 250.0 if angle < 0 else 0.0,
                250.0 if angle > 0 else 0.0, 0.0, 0.0]
    return [250.0, 0.0, 0.0, 0.0, 0.0]


def run_simulation():
    """Run one real connectome-backed environment and publish its current state."""
    env = None
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from environment import ShelfTaskEnv

        env = ShelfTaskEnv(max_steps=300, step_ms=50)
        seed = int(time.time())
        mode, policy, manual_action = "autonomous", None, [0.0] * 5
        state = "stopped"

        def reset():
            env.reset(seed=seed)
            STATE.update(env.world.to_dict(), {
                "steps": 0,
                "target_shelf": env.world.target_shelf,
                "brain_activity": 0,
                "motor_forward": 0.0,
                "motor_turn_left": 0.0,
                "motor_turn_right": 0.0,
                "mode": mode,
                "status": state,
            })

        reset()
        while not STOP_SIMULATION.is_set():
            command = take_command()
            if command.get("reset"):
                seed += 1
                policy = None
                reset()
            if "mode" in command:
                mode = command["mode"]
                if mode == "replay":
                    from agent import LinearPolicy
                    policy_path = Path(command.get("policy", "runs/training/best_policy.npz"))
                    if not policy_path.is_file():
                        raise FileNotFoundError(f"trained policy not found: {policy_path}")
                    policy = LinearPolicy.load(policy_path)
                else:
                    policy = None
                state = "running" if mode != "stopped" else "stopped"
                if mode == "train":
                    state = "training"
                    STOP_TRAINING.clear()
                    threading.Thread(target=run_training, args=(env,), daemon=True).start()
                reset()
            if "action" in command:
                manual_action = command["action"]
            state = command.get("status", state)
            if command:
                STATE.annotate(mode=mode, status=state)
            if state != "running" or mode == "train":
                time.sleep(0.05)
                continue
            world = env.world
            if mode == "manual":
                action = manual_action if manual_action is not None else [0] * 5
            elif mode == "replay":
                action = policy(env.world.get_observation())
            else:
                action = autonomous_action(world)

            _, _, terminated, truncated, info = env.step(action)
            info.update(mode=mode, status=state)
            STATE.update(info["world"], info)
            if terminated or truncated:
                if terminated:
                    info["task_status"] = "delivered" if info["object_delivered"] else "missed target"
                    STATE.update(info["world"], info)
                    time.sleep(1.0)
                seed += 1
                reset()
            else:
                time.sleep(0.05)
    except Exception as exc:
        STATE.fail(f"{type(exc).__name__}: {exc}")
        print(f"Simulation failed: {exc}", flush=True)
    finally:
        if env is not None:
            env.close()


def run_training(env):
    """Run the repository's real ES training loop and expose its generation progress."""
    try:
        from types import SimpleNamespace
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from train import train
        args = SimpleNamespace(generations=50, population=30, eval_episodes=3, max_steps=200,
            step_ms=50, sigma=0.1, lr=0.01, seed=42, output="runs/training",
            action_scale=50.0, grasp_scale=100.0, release_scale=100.0)
        def publish(item):
            STATE.update(env.world.to_dict(), {
                "mode": "train", "status": "training", "training": item,
                "steps": env.steps, "target_shelf": env.world.target_shelf,
                "brain_activity": env.brain.brain.n_active,
                "motor_forward": 0.0, "motor_turn_left": 0.0, "motor_turn_right": 0.0,
            })
        train(args, on_progress=publish, env=env, stop_event=STOP_TRAINING)
        stopped = STOP_TRAINING.is_set()
        STATE.update(env.world.to_dict(), {
            "mode": "train", "status": "stopped", "training_status": "stopped" if stopped else "complete",
            "steps": env.steps, "target_shelf": env.world.target_shelf,
            "brain_activity": env.brain.brain.n_active,
        })
        set_command({"mode": "autonomous", "status": "stopped"})
    except InterruptedError:
        STATE.update(env.world.to_dict(), {"mode": "train", "status": "stopped", "training_status": "stopped"})
        set_command({"mode": "autonomous", "status": "stopped"})
    except Exception as exc:
        STATE.fail(f"{type(exc).__name__}: {exc}")


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
        elif parsed_path.path == '/api/health':
            state = STATE.get()
            status = 200 if state['running'] else 503
            self.send_json_response({'status': state['status'], 'error': state['error']}, status)
        elif parsed_path.path == '/api/ping':
            self.send_json_response({'status': 'ok'})
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/control":
            self.send_json_response({"error": "not found"}, 404)
            return
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            action = data.get("action")
            if action not in {"start", "stop", "reset", "manual"}:
                raise ValueError("action must be start, stop, reset, or manual")
            command = {}
            if action == "start":
                mode = data.get("mode", "autonomous")
                if mode not in {"autonomous", "manual", "train", "replay"}:
                    raise ValueError("mode must be autonomous, manual, train, or replay")
                command["mode"] = mode
                if "policy" in data:
                    command["policy"] = data["policy"]
                command["status"] = "running"
            elif action == "stop":
                command["status"] = "stopped"
                STOP_TRAINING.set()
            elif action == "reset":
                command["reset"] = True
            else:
                values = data.get("values", [])
                if len(values) != 5 or any(not isinstance(v, (int, float)) or not 0 <= v <= 250 for v in values):
                    raise ValueError("manual values must contain five rates in [0, 250]")
                command.update(mode="manual", status="running", action=values)
            set_command(command)
            self.send_json_response({"status": "accepted", **command})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json_response({"error": str(exc)}, 400)
    
    def send_json_response(self, data, status=200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def log_message(self, format, *args):
        """Suppress request logging (less noise)."""
        pass


def run_server(port=8766):
    """Start HTTP server."""
    STOP_SIMULATION.clear()
    STOP_TRAINING.clear()
    set_command({"status": "running"})
    threading.Thread(target=run_simulation, daemon=True).start()
    with http.server.ThreadingHTTPServer(("", port), FlyAssistantHandler) as httpd:
        print(f"🪰 Server running at http://127.0.0.1:{port}")
        print(f"   Open http://127.0.0.1:{port} in your browser")
        print("")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✓ Server stopped")
        finally:
            STOP_SIMULATION.set()
            STOP_TRAINING.set()


def main():
    parser = argparse.ArgumentParser(description='Fly Assistant HTTP server')
    parser.add_argument('--port', type=int, default=8766,
                       help='HTTP port (default: 8766)')
    args = parser.parse_args()
    
    run_server(args.port)


if __name__ == '__main__':
    main()
