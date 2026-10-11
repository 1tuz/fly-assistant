# Design Document: File-as-Object System & Shelf Hierarchy for Fly-Assistant

## 1. Overview
This document outlines the architecture and API proposals for integrating a **file-as-object** system into the `fly-assistant` environment. In this system:
1. **Files** are physical objects residing on shelves or folders.
2. **Folders** are hierarchical shelves whose physical scale, granularity, and accessibility adapt based on nesting depth.
3. **Physics** can operate in either `REALISTIC` (rigid body, friction, grasping kinematics) or `SIMPLIFIED` (kinematic snap-to, discrete navigation) modes.

---

## 2. Core Components

### 2.1 `FileObject` Class
Represents an individual file in the virtual filesystem as a manipulable physical object in the 3D environment.

```python
from enum import Enum
import numpy as np
from typing import Dict, Any, Optional

class FileState(Enum):
    ON_SHELF = "on_shelf"
    GRASPED = "grasped"
    CARRIED = "carried"
    DROPPED = "dropped"
    IN_TRANSIT = "in_transit"

class FileObject:
    """Represents a file as a physical object in the 3D world."""
    
    def __init__(
        self,
        path: str,
        size_bytes: int = 1024,
        metadata: Optional[Dict[str, Any]] = None,
        markers: Optional[Dict[str, Any]] = None
    ):
        self.path = path  # e.g., "/documents/reports/q3.pdf"
        self.name = path.split("/")[-1]
        self.size_bytes = size_bytes
        self.metadata = metadata or {}
        self.markers = markers or {"color": 0x3366ff, "tag": "general"}
        
        # Physical state
        self.state = FileState.ON_SHELF
        self.position = np.zeros(3, dtype=np.float32)      # (x, y, z)
        self.orientation = np.zeros(4, dtype=np.float32)   # Quaternion (x, y, z, w)
        self.velocity = np.zeros(3, dtype=np.float32)
        
        # Derived physical properties
        self.mass = self._calculate_mass()
        self.bounding_box = self._calculate_bounding_box()

    def _calculate_mass(self) -> float:
        """Mass scales sub-linearly with file size (mg)."""
        return max(1.0, float(np.log10(self.size_bytes + 1) * 5.0))

    def _calculate_bounding_box(self) -> np.ndarray:
        """Dimensions [width, height, depth] based on size/type."""
        scale_factor = (self.size_bytes ** (1/3)) * 0.01
        return np.array([0.2 + scale_factor, 0.05, 0.2 + scale_factor], dtype=np.float32)

    def to_dict(self) -> Dict[str, Any]:
        """Export state for visualization and serialization."""
        return {
            "path": self.path,
            "name": self.name,
            "size": self.size_bytes,
            "mass": self.mass,
            "state": self.state.value,
            "position": self.position.tolist(),
            "orientation": self.orientation.tolist(),
            "markers": self.markers
        }
```

---

### 2.2 `FolderHierarchy` & Shelf Scaling Logic
Folders are structured as a tree of `FolderNode` objects mapped onto open bookcases in the 3D environment. Nesting depth dictates shelf compartment dimensions, grid density, and mechanical precision required by the fly.

```python
class FolderNode:
    """Represents a folder (shelf compartment) in the hierarchy."""
    
    def __init__(self, path: str, name: str, depth: int = 0):
        self.path = path
        self.name = name
        self.depth = depth
        self.files: Dict[str, FileObject] = {}
        self.subfolders: Dict[str, 'FolderNode'] = {}
        self.parent: Optional['FolderNode'] = None
        
        # 3D Spatial layout
        self.position = np.zeros(3, dtype=np.float32)
        self.dimensions = self._compute_dimensions(depth)

    def _compute_dimensions(self, depth: int) -> np.ndarray:
        """
        Nesting depth scaling rule:
        Depth 0 (Root/Room): Large bookcase bay (e.g., 5.0 x 3.0 x 2.0 units)
        Depth 1 (Main folder): Shelf tier (2.0 x 0.4 x 2.0 units)
        Depth 2+ (Nested folder): Drawer / compartment (0.5 x 0.1 x 0.5 units * 0.7^depth)
        """
        base_scale = 0.7 ** depth
        if depth == 0:
            return np.array([5.0, 3.0, 2.0], dtype=np.float32)
        elif depth == 1:
            return np.array([2.0, 0.4, 2.0], dtype=np.float32)
        else:
            return np.array([2.0 * base_scale, 0.3 * base_scale, 2.0 * base_scale], dtype=np.float32)

    def add_file(self, file_obj: FileObject):
        self.files[file_obj.path] = file_obj

    def remove_file(self, path: str) -> Optional[FileObject]:
        return self.files.pop(path, None)


class FolderHierarchy:
    """Manages the full virtual filesystem tree and spatial shelf mapping."""
    
    def __init__(self):
        self.root = FolderNode("/", "root", depth=0)
        self._build_spatial_layout()

    def create_folder(self, path: str) -> FolderNode:
        """Create folder node and update hierarchy."""
        parts = [p for p in path.split("/") if p]
        curr = self.root
        current_path = ""
        for i, part in enumerate(parts):
            current_path += f"/{part}"
            if part not in curr.subfolders:
                node = FolderNode(current_path, part, depth=i+1)
                node.parent = curr
                curr.subfolders[part] = node
            curr = curr.subfolders[part]
        return curr

    def _build_spatial_layout(self):
        """Map folder tree nodes to 3D shelf coordinates in the world."""
        # Spatial positioning algorithm placing root bookcases and sub-shelves
        pass

    def transfer_file(self, file_path: str, source_folder_path: str, dest_folder_path: str) -> bool:
        """Transfer a file object between folders (shelves)."""
        src_node = self.get_node(source_folder_path)
        dest_node = self.get_node(dest_folder_path)
        if not src_node or not dest_node or file_path not in src_node.files:
            return False
        
        file_obj = src_node.remove_file(file_path)
        file_obj.path = f"{dest_folder_path.rstrip('/')}/{file_obj.name}"
        dest_node.add_file(file_obj)
        return True

    def get_node(self, path: str) -> Optional[FolderNode]:
        parts = [p for p in path.split("/") if p]
        curr = self.root
        for part in parts:
            if part in curr.subfolders:
                curr = curr.subfolders[part]
            else:
                return None
        return curr
```

---

## 3. Physics Mode Abstraction

To support both high-speed RL training and high-fidelity simulation/testing, the system defines a `PhysicsMode` and an abstract `PhysicsEngine` interface.

### 3.1 `PhysicsMode` Enum
```python
class PhysicsMode(Enum):
    SIMPLIFIED = "simplified"  # Kinematic, grid-based, bounding-box raycast, fast RL training
    REALISTIC = "realistic"    # Rigid-body dynamics, friction, gravity, multi-joint leg grasping
```

### 3.2 `BasePhysicsEngine` Interface
```python
from abc import ABC, abstractmethod

class BasePhysicsEngine(ABC):
    """Abstract base class for environment physics simulation."""
    
    @abstractmethod
    def step(self, dt: float) -> None:
        """Advance physics simulation by dt seconds."""
        pass

    @abstractmethod
    def apply_grasp(self, fly_id: str, file_obj: FileObject) -> bool:
        """Attempt to grasp a file object with the fly's front legs."""
        pass

    @abstractmethod
    def release_grasp(self, fly_id: str, file_obj: FileObject, target_folder: FolderNode) -> bool:
        """Release grasped file onto target shelf/folder."""
        pass

    @abstractmethod
    def check_collisions(self) -> list:
        """Detect collisions between fly, obstacles, and file objects."""
        pass
```

---

## 4. Proposed Environment & State Integration

### 4.1 Updated `WorldState` API
```python
class WorldState:
    def __init__(self, physics_mode: PhysicsMode = PhysicsMode.SIMPLIFIED, seed: Optional[int] = None):
        self.physics_mode = physics_mode
        self.folder_hierarchy = FolderHierarchy()
        self.physics_engine = (
            SimplifiedPhysicsEngine(self.folder_hierarchy) 
            if physics_mode == PhysicsMode.SIMPLIFIED 
            else RealisticPhysicsEngine(self.folder_hierarchy)
        )
        # Fly state, navigation targets, etc.
```

### 4.2 Updated `ShelfTaskEnv` API
```python
class ShelfTaskEnv:
    def __init__(self, max_steps=200, step_ms=50, physics_mode=PhysicsMode.SIMPLIFIED):
        self.physics_mode = physics_mode
        self.world = WorldState(physics_mode=physics_mode)
        # Gymnasium-style reset, step, render methods
```

---

## 5. Visualization Integration (`web/scene.js`)
- **Render Folders as Bookcases**: Depth 0 renders as a large open bookcase room; depth 1+ renders as nested shelves and compartment boxes.
- **File Representation**: Files rendered as books or documents with marker colors matching `FileObject.markers`.
- **Interactive Transfer**: Visual animation when a file is transferred between shelves.
