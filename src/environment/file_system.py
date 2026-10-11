"""
Virtual file system and spatial hierarchy for fly-assistant.

Files are physical objects placed on shelves/folders with nesting-depth-scaled
dimensions and physical states.
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional
import numpy as np


class PhysicsMode(Enum):
    """Simulation physics modes."""
    SIMPLIFIED = "simplified"  # Kinematic, grid-based, bounding-box raycast, fast RL training
    REALISTIC = "realistic"    # Rigid-body dynamics, friction, gravity, multi-joint leg grasping


class FileState(Enum):
    """Physical state of a file in the environment."""
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
        markers: Optional[Dict[str, Any]] = None,
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
        scale_factor = (self.size_bytes ** (1 / 3)) * 0.01
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
            "markers": self.markers,
        }


class FolderNode:
    """Represents a folder (shelf compartment) in the hierarchy."""

    def __init__(self, path: str, name: str, depth: int = 0):
        self.path = path
        self.name = name
        self.depth = depth
        self.files: Dict[str, FileObject] = {}
        self.subfolders: Dict[str, FolderNode] = {}
        self.parent: Optional[FolderNode] = None

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

    def to_dict(self) -> Dict[str, Any]:
        """Export state for visualization and serialization."""
        return {
            "path": self.path,
            "name": self.name,
            "depth": self.depth,
            "position": self.position.tolist(),
            "dimensions": self.dimensions.tolist(),
            "files": [f.to_dict() for f in self.files.values()],
            "subfolders": [sf.to_dict() for sf in self.subfolders.values()],
        }


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
                node = FolderNode(current_path, part, depth=i + 1)
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
        """Find folder node by path."""
        parts = [p for p in path.split("/") if p]
        curr = self.root
        for part in parts:
            if part in curr.subfolders:
                curr = curr.subfolders[part]
            else:
                return None
        return curr

    def get_file(self, file_path: str) -> Optional[FileObject]:
        """Find file object by its full path."""
        folder_path = "/".join(file_path.split("/")[:-1]) or "/"
        node = self.get_node(folder_path)
        if node and file_path in node.files:
            return node.files[file_path]
        return None


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
