"""Adapter from the shelf task's inputs to flybrain's current simulation API."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../flybrain"))

import flyenv


class BrainAdapter:
    def __init__(self, dt=0.2, w_scale=0.5):
        self.brain = flyenv.FlyBrain(params={"model": "shiu", "dt": dt, "w_scale": w_scale})
        self.conn = self.brain.C
        self.visual_left = self._find_neurons("^LC4$", side="L")
        self.visual_right = self._find_neurons("^LC4$", side="R")
        self.forward = self._find_neurons("^ICL012m$")
        self.turn_left = self._find_neurons("^LAL018$", side="L")
        self.turn_right = self._find_neurons("^LAL018$", side="R")
        self.grasp_left = self._find_neurons("^DNg12_e$", side="L")
        self.grasp_right = self._find_neurons("^DNg12_e$", side="R")

    def _find_neurons(self, pattern, side=None):
        return self.brain.group(pattern, side=side)

    def reset(self, seed=None):
        self.brain.reset(seed=0 if seed is None else seed)

    def step(self, action, ms=50):
        drive = {}
        target = action.get("visual_target")
        # Strong LC4 drive suppresses the walking readout in this connectome.
        if target == 0:
            drive[self.visual_left] = 10.0
        elif target == 1:
            drive[self.visual_right] = 10.0
        for key, group in (("forward", self.forward), ("turn_left", self.turn_left),
                           ("turn_right", self.turn_right), ("grasp_left", self.grasp_left),
                           ("grasp_right", self.grasp_right)):
            rate = float(action.get(key, 0.0))
            if rate > 0:
                drive[group] = rate

        rates = self.brain.step(drive, ms=ms)
        return {
            "forward": rates.get("fwd", 0.0),
            "turn_left": rates.get("turnL", 0.0),
            "turn_right": rates.get("turnR", 0.0),
            "grasp_left": rates.get("T1L_pro", 0.0),
            "grasp_right": rates.get("T1R_pro", 0.0),
            "n_active": self.brain.n_active,
            "total_spikes": len(self.brain.spikes),
        }
