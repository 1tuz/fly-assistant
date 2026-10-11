# fly-assistant Architecture

## Design Principles

1. **Real neural simulation**: Use flybrain's connectome simulation, not fake animation
2. **Clear separation**: Brain simulation, RL agent, environment, and visualization are distinct modules
3. **Minimal viable prototype**: Simple shelf-selection task before complex object manipulation
4. **Modular extensibility**: Easy to add new worlds, tasks, and objects

## Project Structure

```
fly-assistant/
├── flybrain/                 # Git submodule of jppaquet/flybrain
├── src/
│   ├── brain/               # Neural simulation wrapper
│   │   ├── __init__.py
│   │   └── brain_adapter.py # Adapts flybrain engine for our tasks
│   ├── environment/         # RL environments
│   │   ├── __init__.py
│   │   ├── shelf_task.py    # Simple shelf selection task
│   │   └── world_state.py   # World state representation
│   ├── agent/               # RL agent/policy
│   │   ├── __init__.py
│   │   └── simple_policy.py # Basic RL policy (start with random/ES)
│   └── server/              # Web server & API
│       ├── __init__.py
│       ├── server.py        # HTTP server
│       └── trainer.py       # Training loop control
├── web/                     # 3D visualization (static files)
│   ├── index.html
│   ├── scene.js             # Three.js 3D scene
│   └── style.css
├── setup.sh                 # Setup script
├── run.sh                   # Launch server
├── train.py                 # Training entry point
├── requirements.txt
└── README.md
```

## Component Interactions

```
train.py
  ↓
TrainingLoop ←→ ShelfTaskEnv
                    ↓
                BrainAdapter (wraps flybrain)
                    ↓
                flybrain/engine.py (real connectome)

HTTP Server ←→ TrainingLoop (status, control)
    ↓
web/scene.js (visualization)
```

## Shelf Selection Task (MVP)

**Goal**: Fly must choose the correct shelf (left or right) based on simple stimulus.

**State Space**:
- Fly position (x, y, z)
- Fly orientation (yaw, pitch, roll)
- Target shelf indicator (binary: left/right)
- Object position

**Action Space**:
- Neural stimulation patterns (similar to flybrain DriveEnv)
- Drive descending neurons to control movement and direction

**Reward**:
- +1.0 for reaching correct shelf
- -1.0 for reaching wrong shelf
- -0.001 per timestep (encourage speed)
- Episode terminates on shelf contact or timeout (200 steps)

**Simplifications**:
- No physics-based object grasping yet
- Fly just needs to reach the correct shelf
- Simple spatial navigation task

## Technology Stack

- **Brain simulation**: flybrain (Python, numpy, pyarrow)
- **RL framework**: Custom lightweight implementation (no heavy dependencies)
- **Web server**: Python http.server + WebSockets for real-time updates
- **3D visualization**: Three.js (CDN, no build step)
- **Platform**: macOS Apple Silicon, Python 3.12+

## Training Strategy

Start with simplest approach:
1. Random policy baseline
2. Evolution strategy (ES) like flybrain's drive_es.py
3. If successful, consider more sophisticated RL

## Extension Points

Future additions can plug into:
- New environments in `src/environment/`
- Different neural stimulation patterns in `BrainAdapter`
- New 3D worlds in `web/scene.js`
- Advanced RL algorithms in `src/agent/`
