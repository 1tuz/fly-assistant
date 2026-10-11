"""
Shelf-selection task environment.

Gymnasium-style API without importing gymnasium.
The fly must navigate to the correct shelf based on a visual target indicator.
"""
import numpy as np
from .world_state import WorldState
try:
    from ..brain import BrainAdapter
except ImportError:
    from brain import BrainAdapter


class ShelfTaskEnv:
    """
    RL environment for shelf selection task.
    
    Observation space: 10D vector (position, orientation, target, distances)
    Action space: 3D continuous [forward, turn_left, turn_right] in Hz (0-250)
    
    Episode ends when:
    - Fly reaches correct shelf (reward +1)
    - Fly reaches wrong shelf (reward -1)
    - Max steps reached (truncated)
    """
    
    def __init__(self, max_steps=200, step_ms=50, render_mode=None):
        """
        Args:
            max_steps: Maximum steps per episode
            step_ms: Simulation duration per step (milliseconds)
            render_mode: None or 'human' (not implemented yet)
        """
        self.max_steps = max_steps
        self.step_ms = step_ms
        self.render_mode = render_mode
        
        # Initialize brain simulation (expensive, done once)
        self.brain = BrainAdapter(dt=0.2, w_scale=0.5)
        
        # World state
        self.world = WorldState()
        
        # Episode state
        self.steps = 0
        self.episode_reward = 0.0
        
        # Action/observation spaces (for reference)
        self.action_dim = 5  # [forward, turn_left, turn_right, grasp, release] in Hz
        self.action_max = 250.0  # Max Poisson rate
        self.observation_dim = 13
    
    def reset(self, seed=None, options=None):
        """
        Reset environment to start new episode.
        
        Returns:
            observation: np.array of shape (10,)
            info: dict with episode info
        """
        if seed is not None:
            np.random.seed(seed)
        
        # Reset world (randomizes target shelf)
        self.world.reset(seed=seed)
        
        # Reset brain simulation
        self.brain.reset(seed=seed)
        
        # Reset episode counters
        self.steps = 0
        self.episode_reward = 0.0
        
        observation = self.world.get_observation()
        info = {
            'target_shelf': self.world.target_shelf,
            'steps': 0
        }
        
        return observation, info
    
    def step(self, action):
        """
        Execute one environment step.
        
        Args:
            action: np.array of shape (3,) with [forward_hz, turn_left_hz, turn_right_hz]
                   Values should be in [0, action_max]
        
        Returns:
            observation: np.array
            reward: float
            terminated: bool (reached a shelf)
            truncated: bool (max steps)
            info: dict
        """
        self.steps += 1
        
        # Clip actions to valid range and pad if needed
        action = np.clip(action, 0.0, self.action_max)
        if len(action) < 5:
            action = np.pad(action, (0, 5 - len(action)), mode='constant')
        
        # Prepare brain input
        brain_action = {
            'visual_target': self.world.target_shelf,
            'forward': float(action[0]),
            'turn_left': float(action[1]),
            'turn_right': float(action[2]),
            'grasp_left': float(action[3]),
            'grasp_right': float(action[3])
        }
        
        # Run brain simulation
        brain_output = self.brain.step(brain_action, ms=self.step_ms)
        
        # Convert brain output to movement
        # Forward activation from DNp09 rate (normalize to 0-1)
        forward_activation = min(brain_output['forward'] / 50.0, 1.0)
        
        # Turn activation from difference between left/right turn rates
        turn_left_rate = brain_output['turn_left']
        turn_right_rate = brain_output['turn_right']
        turn_activation = np.clip((turn_right_rate - turn_left_rate) / 50.0, -1.0, 1.0)
        
        # Grasp and release activation from brain output and action
        grasp_left_rate = brain_output.get('grasp_left', 0.0)
        grasp_right_rate = brain_output.get('grasp_right', 0.0)
        grasp_activation = min((grasp_left_rate + grasp_right_rate + float(action[3])) / 100.0, 1.0)
        release_activation = min(float(action[4]) / 250.0, 1.0)
        
        # Update world physics and grasping
        self.world.update_fly(forward_activation, turn_activation)
        self.world.update_grasp(grasp_activation, release_activation)
        
        # Check termination conditions
        terminated = False
        reward = -0.001  # Small step penalty to encourage speed
        
        if self.world.object_delivered:
            reward = 1.0
            terminated = True
        elif self.world.at_wrong_shelf():
            reward = -1.0
            terminated = True
        truncated = self.steps >= self.max_steps
        
        self.episode_reward += reward
        
        observation = self.world.get_observation()
        info = {
            'target_shelf': self.world.target_shelf,
            'steps': self.steps,
            'brain_activity': brain_output['n_active'],
            'motor_forward': brain_output['forward'],
            'motor_turn_left': brain_output['turn_left'],
            'motor_turn_right': brain_output['turn_right'],
            'motor_grasp_left': brain_output.get('grasp_left', 0.0),
            'motor_grasp_right': brain_output.get('grasp_right', 0.0),
            'object_carried': self.world.object_is_carried,
            'object_delivered': self.world.object_delivered,
            'world': self.world.to_dict()
        }
        
        return observation, reward, terminated, truncated, info
    
    def close(self):
        """Cleanup resources."""
        pass
