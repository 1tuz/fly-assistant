"""
Brain simulation adapter - wraps flybrain engine for our shelf-selection task.

Uses flybrain's real connectome simulation (165,384 neurons) with custom sensory inputs
and motor readouts tailored for spatial navigation.
"""
import sys
import os
import numpy as np

# Add flybrain to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../flybrain'))

import engine


class BrainAdapter:
    """
    Wraps flybrain's LIF connectome simulation for the shelf-selection task.
    
    Input channels:
    - Visual stimulus (left/right target indicator via LC4 looming neurons)
    - Proprioception (simulated position feedback)
    
    Output channels:
    - Forward movement (DNp09)
    - Turning (DNa01/02 left/right)
    - Speed/activity level
    """
    
    def __init__(self, dt=0.2, w_scale=0.5):
        """
        Args:
            dt: Simulation timestep in ms
            w_scale: Synaptic weight scaling (0.5 to avoid runaway activity)
        """
        print("Loading connectome...")
        self.conn = engine.Connectome()
        
        # Simulation parameters matching flybrain defaults
        self.params = dict(
            model="shiu",
            dt=dt,
            tau_m=20.0,
            tau_syn=5.0,
            v_th=7.0,
            refrac=2.2,
            delay=1.8,
            w_syn=0.275,
            f_poi=250.0,
            w_scale=w_scale,
            std_u=0.0,    # No synaptic depression for now
            std_tau=200.0
        )
        
        # Initialize simulation state
        self.sim = engine.LIF(self.conn, **self.params)
        
        # Define input neuron groups for our task
        self._setup_channels()
        
        print(f"Brain adapter ready: {self.conn.N:,} neurons")
    
    def _setup_channels(self):
        """Define neuron groups for inputs and outputs."""
        # Visual stimulus neurons (looming detectors - LC4)
        self.visual_left = self._find_neurons("^LC4$", side="L")
        self.visual_right = self._find_neurons("^LC4$", side="R")
        
        # Walking command neurons (one synapse upstream of descending neurons)
        # These are what keyboard mode uses in flybrain
        self.forward = self._find_neurons("^ICL012m$")  # → DNp09
        self.turn_left = self._find_neurons("^LAL018$", side="L")  # → DNa01/02
        self.turn_right = self._find_neurons("^LAL018$", side="R")
        
        # Readout channels (descending neurons)
        self.readout_fwd = self._find_neurons("^DNp09$")
        self.readout_turn_left = self._find_neurons("^DNa0[12]$", side="L")
        self.readout_turn_right = self._find_neurons("^DNa0[12]$", side="R")
        
        print(f"Input channels: visual_left={len(self.visual_left)}, "
              f"visual_right={len(self.visual_right)}, "
              f"forward={len(self.forward)}, "
              f"turn_left={len(self.turn_left)}, "
              f"turn_right={len(self.turn_right)}")
        print(f"Output channels: fwd={len(self.readout_fwd)}, "
              f"turn_left={len(self.readout_turn_left)}, "
              f"turn_right={len(self.readout_turn_right)}")
    
    def _find_neurons(self, pattern, side=None):
        """Find neuron indices matching pattern and optional side."""
        import re
        regex = re.compile(pattern)
        indices = []
        for i in range(self.conn.N):
            if regex.match(self.conn.type[i]):
                if side is None or self.conn.side[i] == side:
                    indices.append(i)
        return np.array(indices, dtype=np.int32)
    
    def reset(self, seed=None):
        """Reset simulation to resting state."""
        if seed is not None:
            np.random.seed(seed)
        self.sim.reset()
    
    def step(self, action, ms=50):
        """
        Run simulation for ms milliseconds with given actions.
        
        Args:
            action: dict with keys 'visual_target' (0=left, 1=right),
                   'forward', 'turn_left', 'turn_right' (Poisson rates in Hz)
            ms: Duration in milliseconds
        
        Returns:
            dict with motor output rates and activity metrics
        """
        # Build stimulation dict for flybrain engine
        stim = {}
        
        # Visual target indication
        if 'visual_target' in action:
            target = action['visual_target']
            if target == 0:  # Left shelf
                stim[tuple(self.visual_left)] = 150.0
            elif target == 1:  # Right shelf
                stim[tuple(self.visual_right)] = 150.0
        
        # Motor commands (agent's actions)
        if action.get('forward', 0) > 0:
            stim[tuple(self.forward)] = float(action['forward'])
        if action.get('turn_left', 0) > 0:
            stim[tuple(self.turn_left)] = float(action['turn_left'])
        if action.get('turn_right', 0) > 0:
            stim[tuple(self.turn_right)] = float(action['turn_right'])
        
        # Run simulation
        self.sim.run(stim, ms)
        
        # Read motor outputs (rates in Hz over the period)
        # Mask out directly stimulated neurons
        driven_mask = np.zeros(self.conn.N, dtype=bool)
        for idx_tuple in stim.keys():
            driven_mask[np.array(idx_tuple)] = True
        
        def channel_rate(indices):
            """Mean rate of channel, excluding driven neurons."""
            valid = indices[~driven_mask[indices]]
            if len(valid) == 0:
                return 0.0
            spikes = self.sim.spikes[valid].sum()
            return float(spikes) / (len(valid) * ms / 1000.0)
        
        output = {
            'forward': channel_rate(self.readout_fwd),
            'turn_left': channel_rate(self.readout_turn_left),
            'turn_right': channel_rate(self.readout_turn_right),
            'n_active': int(self.sim.n_active),
            'total_spikes': int(self.sim.spikes.sum())
        }
        
        return output
