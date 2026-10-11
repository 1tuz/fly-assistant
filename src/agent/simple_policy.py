"""
Simple evolution strategy policy for shelf selection.

Linear policy: observation -> action weights.
Uses CMA-ES-like evolution to find good weights.
"""
import numpy as np


class LinearPolicy:
    """Linear mapping from observation to action."""
    
    def __init__(self, obs_dim, action_dim, seed=None):
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        self.rng = np.random.default_rng(seed)
        
        # Weight matrix: (action_dim, obs_dim)
        self.weights = self.rng.normal(0, 0.1, (action_dim, obs_dim))
        self.bias = np.zeros(action_dim)
    
    def __call__(self, obs):
        """
        Compute action from observation.
        
        Returns action in [0, max_hz] range with ReLU activation.
        """
        logits = self.weights @ obs + self.bias
        # ReLU and scale to [0, 250] Hz range
        action = np.maximum(0, logits) * 50.0
        return action
    
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
        np.savez(path, weights=self.weights, bias=self.bias)
    
    @classmethod
    def load(cls, path):
        """Load policy from file."""
        data = np.load(path)
        policy = cls(data['weights'].shape[1], data['weights'].shape[0])
        policy.weights = data['weights']
        policy.bias = data['bias']
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
