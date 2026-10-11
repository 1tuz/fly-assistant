"""
World state representation for the shelf-selection task.

Simple 3D world:
- Fly starts at origin (0, 0, 0) facing +Z
- Two shelves: left at (-5, 0, 10), right at (+5, 0, 10)
- One object placed on one of the shelves (target changes per episode)
"""
import numpy as np


class WorldState:
    """Represents the 3D world state."""
    
    # World dimensions
    SHELF_LEFT_POS = np.array([-5.0, 0.0, 10.0])
    SHELF_RIGHT_POS = np.array([5.0, 0.0, 10.0])
    SHELF_REACH_RADIUS = 1.5  # Distance to consider "reached shelf"
    
    # Fly parameters
    FLY_START_POS = np.array([0.0, 0.0, 0.0])
    FLY_MOVE_SPEED = 0.1  # Units per timestep when moving forward
    FLY_TURN_SPEED = 0.15  # Radians per timestep when turning
    
    def __init__(self, target_shelf=0, seed=None):
        """
        Args:
            target_shelf: 0 for left, 1 for right
            seed: Random seed for reproducibility
        """
        self.rng = np.random.default_rng(seed)
        self.target_shelf = target_shelf
        
        # Fly state
        self.fly_pos = self.FLY_START_POS.copy()
        self.fly_yaw = 0.0  # Facing +Z initially
        
        # Object on target shelf
        self.object_pos = (self.SHELF_LEFT_POS if target_shelf == 0 
                          else self.SHELF_RIGHT_POS).copy()
    
    def reset(self, target_shelf=None, seed=None):
        """Reset world to initial state."""
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        if target_shelf is not None:
            self.target_shelf = target_shelf
        else:
            # Randomize target
            self.target_shelf = self.rng.integers(0, 2)
        
        self.fly_pos = self.FLY_START_POS.copy()
        self.fly_yaw = 0.0
        self.object_pos = (self.SHELF_LEFT_POS if self.target_shelf == 0
                          else self.SHELF_RIGHT_POS).copy()
    
    def update_fly(self, forward_activation, turn_activation):
        """
        Update fly position based on motor neuron activations.
        
        Args:
            forward_activation: 0-1, how much to move forward
            turn_activation: -1 to +1, negative=left, positive=right
        """
        # Forward movement
        if forward_activation > 0.01:
            dx = np.sin(self.fly_yaw) * self.FLY_MOVE_SPEED * forward_activation
            dz = np.cos(self.fly_yaw) * self.FLY_MOVE_SPEED * forward_activation
            self.fly_pos[0] += dx
            self.fly_pos[2] += dz
        
        # Turning
        if abs(turn_activation) > 0.01:
            self.fly_yaw += self.FLY_TURN_SPEED * turn_activation
            # Wrap angle to [-pi, pi]
            self.fly_yaw = np.arctan2(np.sin(self.fly_yaw), np.cos(self.fly_yaw))
    
    def distance_to_shelf(self, shelf_idx):
        """Distance from fly to shelf (0=left, 1=right)."""
        shelf_pos = self.SHELF_LEFT_POS if shelf_idx == 0 else self.SHELF_RIGHT_POS
        return np.linalg.norm(self.fly_pos - shelf_pos)
    
    def at_target_shelf(self):
        """Check if fly has reached the target shelf."""
        return self.distance_to_shelf(self.target_shelf) < self.SHELF_REACH_RADIUS
    
    def at_wrong_shelf(self):
        """Check if fly reached the wrong shelf."""
        wrong_shelf = 1 - self.target_shelf
        return self.distance_to_shelf(wrong_shelf) < self.SHELF_REACH_RADIUS
    
    def get_observation(self):
        """
        Get observation vector for the agent.
        
        Returns:
            np.array of shape (10,):
            - fly position (3)
            - fly orientation as (cos(yaw), sin(yaw)) (2)
            - target shelf indicator (2): one-hot [left, right]
            - distance to left shelf (1)
            - distance to right shelf (1)
            - angle to target shelf (1)
        """
        target_one_hot = np.zeros(2)
        target_one_hot[self.target_shelf] = 1.0
        
        # Angle to target shelf
        target_pos = (self.SHELF_LEFT_POS if self.target_shelf == 0 
                     else self.SHELF_RIGHT_POS)
        to_target = target_pos - self.fly_pos
        angle_to_target = np.arctan2(to_target[0], to_target[2]) - self.fly_yaw
        angle_to_target = np.arctan2(np.sin(angle_to_target), np.cos(angle_to_target))
        
        obs = np.concatenate([
            self.fly_pos,
            [np.cos(self.fly_yaw), np.sin(self.fly_yaw)],
            target_one_hot,
            [self.distance_to_shelf(0)],
            [self.distance_to_shelf(1)],
            [angle_to_target]
        ])
        
        return obs.astype(np.float32)
    
    def to_dict(self):
        """Export state as dict for visualization."""
        return {
            'fly': {
                'position': self.fly_pos.tolist(),
                'yaw': float(self.fly_yaw)
            },
            'shelves': {
                'left': self.SHELF_LEFT_POS.tolist(),
                'right': self.SHELF_RIGHT_POS.tolist()
            },
            'object': {
                'position': self.object_pos.tolist()
            },
            'target_shelf': int(self.target_shelf)
        }
