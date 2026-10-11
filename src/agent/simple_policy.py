"""
Simple evolution strategy policy for shelf selection.

Linear policy: observation -> action weights.
Uses CMA-ES-like evolution to find good weights.
"""
import numpy as np


class LinearPolicy:
    """Linear mapping from observation to action."""
    
    def __init__(self, obs_dim=13, action_dim=5, action_scale=None, grasp_scale=None, release_scale=None, seed=None):
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        self.rng = np.random.default_rng(seed)
        
        # Weight matrix: (action_dim, obs_dim)
        self.weights = self.rng.normal(0, 0.1, (action_dim, obs_dim))
        self.bias = np.zeros(action_dim)
        
        # Action scaling factors (default: 50.0 for movement, 100.0 for grasp and release)
        if action_scale is not None:
            if np.isscalar(action_scale):
                self.action_scale = np.full(action_dim, float(action_scale), dtype=np.float32)
            else:
                self.action_scale = np.array(action_scale, dtype=np.float32).copy()
        else:
            if action_dim == 5:
                # [forward, turn_left, turn_right, grasp, release]
                self.action_scale = np.array([50.0, 50.0, 50.0, 100.0, 100.0], dtype=np.float32)
            else:
                self.action_scale = np.full(action_dim, 50.0, dtype=np.float32)
                
        if grasp_scale is not None and self.action_dim >= 4:
            self.action_scale[3] = float(grasp_scale)
        if release_scale is not None and self.action_dim >= 5:
            self.action_scale[4] = float(release_scale)
    
    def __call__(self, obs):
        """
        Compute action from observation.
        
        Returns action in [0, 250] Hz range with ReLU activation and per-action scaling.
        """
        logits = self.weights @ obs + self.bias
        action = np.maximum(0, logits) * self.action_scale
        return np.clip(action, 0.0, 250.0)
    
    def get_params(self):
        """Flatten parameters for optimization."""
        return np.concatenate([self.weights.flatten(), self.bias])
    
    def set_params(self, params):
        """Set parameters from flat array."""
        n_weights = self.obs_dim * self.action_dim
        self.weights = params[:n_weights].reshape(self.action_dim, self.obs_dim)
        self.bias = params[n_weights:]
    
    def save(self, path):
        """Save policy to file."""
        np.savez(
            path,
            weights=self.weights,
            bias=self.bias,
            action_scale=self.action_scale,
            obs_dim=self.obs_dim,
            action_dim=self.action_dim
        )
    
    @classmethod
    def load(cls, path):
        """Load policy from file."""
        data = np.load(path)
        obs_dim = int(data['obs_dim']) if 'obs_dim' in data else data['weights'].shape[1]
        action_dim = int(data['action_dim']) if 'action_dim' in data else data['weights'].shape[0]
        action_scale = data['action_scale'] if 'action_scale' in data else None
        policy = cls(obs_dim=obs_dim, action_dim=action_dim, action_scale=action_scale)
        policy.weights = data['weights']
        policy.bias = data['bias']
        if action_scale is not None:
            policy.action_scale = np.array(action_scale, dtype=np.float32)
        return policy


class SimpleES:
    """
    Simple Evolution Strategy optimizer.
    
    Perturbs parameters with Gaussian noise, selects top performers.
    """
    
    def __init__(self, num_params, population_size=50, sigma=0.1, 
                 learning_rate=0.01, seed=None):
        """
        Args:
            num_params: Number of policy parameters
            population_size: Number of candidates per generation
            sigma: Noise standard deviation
            learning_rate: Step size for parameter update
        """
        self.num_params = num_params
        self.population_size = population_size
        self.sigma = sigma
        self.learning_rate = learning_rate
        self.rng = np.random.default_rng(seed)
        
        # Current mean parameters
        self.theta = self.rng.normal(0, 0.1, num_params)
        
    def ask(self):
        """Generate population of parameter candidates."""
        epsilon = self.rng.normal(0, 1, (self.population_size, self.num_params))
        candidates = self.theta + self.sigma * epsilon
        return candidates, epsilon
    
    def tell(self, epsilon, rewards):
        """
        Update parameters based on rewards.
        
        Args:
            epsilon: Noise vectors used to generate candidates
            rewards: Rewards for each candidate
        """
        # Normalize rewards
        rewards = np.array(rewards)
        if rewards.std() > 1e-6:
            rewards = (rewards - rewards.mean()) / (rewards.std() + 1e-8)
        
        # Update theta in direction of best-performing noise
        grad = (epsilon.T @ rewards) / self.population_size
        self.theta += self.learning_rate * grad
    
    def get_best(self):
        """Return current best parameters."""
        return self.theta.copy()
