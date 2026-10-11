#!/usr/bin/env python3
"""
Integration tests for the object grasping and delivery task.

Tests cover:
1. Grasping object when fly is within GRASP_RADIUS (and not grasping when far/inactive)
2. Carrying object: object position follows fly position + heading offset
3. Releasing object: both manual release and automatic delivery at target shelf
4. Full pipeline: approach -> grasp -> carry -> deliver (WorldState & ShelfTaskEnv 5D)
"""
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
import numpy as np

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from environment import (
    ShelfTaskEnv,
    WorldState,
    FileObject,
    FileState,
    FolderHierarchy,
    PhysicsMode,
)
from brain import BrainAdapter
from server.server import autonomous_action


class DummyBrainAdapter:
    """
    Lightweight deterministic replacement for BrainAdapter used to test
    ShelfTaskEnv's 5D action space and grasping integration without requiring
    the full 165k-neuron connectome simulation when unit-testing.
    """

    def __init__(self, dt=0.2, w_scale=0.5):
        self.dt = dt
        self.w_scale = w_scale

    def reset(self, seed=None):
        pass

    def step(self, action, ms=50):
        return {
            "forward": float(action.get("forward", 0.0)),
            "turn_left": float(action.get("turn_left", 0.0)),
            "turn_right": float(action.get("turn_right", 0.0)),
            "grasp_left": float(action.get("grasp_left", 0.0)) * 0.5,
            "grasp_right": float(action.get("grasp_right", 0.0)) * 0.5,
            "n_active": 100,
            "total_spikes": 500,
        }


class TestGraspingIntegration(unittest.TestCase):
    """Integration test suite for fly object grasping and delivery."""

    def test_connectome_walk_output_survives_target_visual_input(self):
        brain = BrainAdapter(dt=0.2, w_scale=0.5)
        brain.reset(seed=0)
        output = brain.step({"visual_target": 1, "forward": 150.0}, ms=300)
        self.assertGreater(output["forward"], 20.0)
        self.assertLess(output["n_active"], 500)

    def test_fly_can_grasp_object_when_near(self):
        """Test 1: Fly can grasp object when within GRASP_RADIUS and grasp activation > 0.2."""
        world = WorldState(target_shelf=0, seed=42)
        # Place object in open space so grasping doesn't immediately trigger shelf delivery
        world.object_pos = np.array([0.0, 0.0, 3.0])
        world.fly_pos = np.array([0.0, 0.0, 0.0])

        # Far from object (distance = 3.0 > GRASP_RADIUS = 2.0): cannot grasp
        world.update_grasp(grasp_activation=0.9, release_activation=0.0)
        self.assertFalse(
            world.object_is_carried,
            "Fly should not grasp object when outside GRASP_RADIUS",
        )

        # Move fly within GRASP_RADIUS (distance = 1.2 < 2.0), but low grasp activation (<= 0.2)
        world.fly_pos = np.array([0.0, 0.0, 1.8])
        world.update_grasp(grasp_activation=0.1, release_activation=0.0)
        self.assertFalse(
            world.object_is_carried,
            "Fly should not grasp object when grasp_activation <= 0.2",
        )

        # Sufficient grasp activation (> 0.2) while within GRASP_RADIUS
        world.update_grasp(grasp_activation=0.8, release_activation=0.0)
        self.assertTrue(
            world.object_is_carried,
            "Fly should grasp object when within GRASP_RADIUS and grasp_activation > 0.2",
        )
        self.assertFalse(world.object_delivered)

        # Verify observation reflects carried state (index 11)
        obs = world.get_observation()
        self.assertEqual(obs.shape, (13,))
        self.assertEqual(obs[11], 1.0)
        self.assertEqual(obs[12], 0.0)

    def test_object_follows_fly_when_carried(self):
        """Test 2: Object follows fly with front-leg offset as fly moves and turns."""
        world = WorldState(target_shelf=1, seed=42)
        # Place object near origin, away from target shelf (SHELF_RIGHT_POS = [5, 0, 10])
        world.object_pos = np.array([0.0, 0.0, 1.0])
        world.fly_pos = np.array([0.0, 0.0, 0.0])
        world.fly_yaw = 0.0

        # Grasp the object
        world.update_grasp(grasp_activation=0.8, release_activation=0.0)
        self.assertTrue(world.object_is_carried)

        # Step the fly forward and slightly turning across multiple steps
        for _ in range(10):
            world.update_fly(forward_activation=1.0, turn_activation=0.2)
            world.update_grasp(grasp_activation=0.0, release_activation=0.0)

            self.assertTrue(
                world.object_is_carried,
                "Object should remain carried while moving away from target shelf",
            )
            expected_offset = np.array(
                [np.sin(world.fly_yaw) * 0.4, 0.0, np.cos(world.fly_yaw) * 0.4]
            )
            np.testing.assert_allclose(
                world.object_pos,
                world.fly_pos + expected_offset,
                atol=1e-6,
                err_msg="Carried object position must track fly position + heading offset",
            )

    def test_fly_keeps_inertial_motion_then_slows_to_rest(self):
        world = WorldState(target_shelf=1, seed=42)
        world.update_fly(forward_activation=1.0, turn_activation=0.0)
        first_position = world.fly_pos[2]

        world.update_fly(forward_activation=0.0, turn_activation=0.0)
        self.assertGreater(world.fly_pos[2], first_position)
        coasting_position = world.fly_pos[2]

        for _ in range(12):
            world.update_fly(forward_activation=0.0, turn_activation=0.0)
        self.assertGreater(world.fly_pos[2], coasting_position)
        self.assertLess(world.fly_speed, 0.001)

    def test_autonomous_keeps_carrying_book_until_inside_delivery_radius(self):
        world = WorldState(target_shelf=1, seed=42)
        world.fly_pos = world.SHELF_RIGHT_POS + np.array([-1.8, 0.0, 0.0])
        world.fly_yaw = np.pi / 2
        world.object_is_carried = True

        action = autonomous_action(world)
        self.assertEqual(action[0], 250.0)
        self.assertEqual(action[3], 0.0)

    def test_object_releases_at_target_and_on_command(self):
        """Test 3: Object releases on explicit release command or upon reaching target shelf."""
        # Case A: Manual release away from target shelf drops object without marking delivered
        world = WorldState(target_shelf=0, seed=42)
        world.object_pos = np.array([0.0, 0.0, 1.0])
        world.fly_pos = np.array([0.0, 0.0, 0.0])
        world.update_grasp(grasp_activation=0.8, release_activation=0.0)
        self.assertTrue(world.object_is_carried)

        world.update_grasp(grasp_activation=0.0, release_activation=0.6)
        self.assertFalse(
            world.object_is_carried,
            "Object should be released when release_activation > 0.3",
        )
        self.assertFalse(
            world.object_delivered,
            "Object released away from target shelf should not be marked delivered",
        )

        # Case B: Releasing / arriving at target shelf marks object as delivered
        world.reset(target_shelf=0, seed=42)
        # Position fly just outside SHELF_REACH_RADIUS (1.5) but inside GRASP_RADIUS (2.0)
        world.fly_pos = world.SHELF_LEFT_POS + np.array([0.0, 0.0, -1.7])
        world.object_pos = world.fly_pos + np.array([0.0, 0.0, 1.0])
        world.update_grasp(grasp_activation=0.8, release_activation=0.0)
        self.assertTrue(world.object_is_carried)
        self.assertFalse(world.object_delivered)

        # Move fly within SHELF_REACH_RADIUS (< 1.5) of target shelf
        world.fly_pos = world.SHELF_LEFT_POS + np.array([0.0, 0.0, -1.0])
        self.assertTrue(world.at_target_shelf())
        world.update_grasp(grasp_activation=0.0, release_activation=0.5)

        self.assertFalse(
            world.object_is_carried,
            "Object should no longer be carried once delivered at target shelf",
        )
        self.assertTrue(
            world.object_delivered,
            "Object should be marked delivered at target shelf",
        )
        obs = world.get_observation()
        self.assertEqual(obs[11], 0.0)
        self.assertEqual(obs[12], 1.0)

    def test_full_pipeline_approach_grasp_carry_deliver(self):
        """Test 4: Full pipeline (approach -> grasp -> carry -> deliver) in ShelfTaskEnv."""
        with patch("environment.shelf_task.BrainAdapter", DummyBrainAdapter):
            env = ShelfTaskEnv(max_steps=300, step_ms=50)
            obs, info = env.reset(seed=42)

            # Force target to right shelf (+5, 0, 10) and place object along the path at (2.5, 0, 5)
            env.world.reset(target_shelf=1, seed=42)
            env.world.object_pos = np.array([2.5, 0.0, 5.0])
            obs = env.world.get_observation()

            self.assertEqual(env.action_dim, 5)
            self.assertEqual(env.observation_dim, 13)
            self.assertEqual(obs.shape, (13,))
            self.assertFalse(env.world.object_is_carried)
            self.assertFalse(env.world.object_delivered)

            # Helper to compute steering + forward action toward a 3D target point
            def navigate_step(target_pt, grasp_hz=0.0, release_hz=0.0):
                to_target = target_pt - env.world.fly_pos
                desired_yaw = np.arctan2(to_target[0], to_target[2])
                yaw_err = np.arctan2(
                    np.sin(desired_yaw - env.world.fly_yaw),
                    np.cos(desired_yaw - env.world.fly_yaw),
                )
                turn_left_hz = max(0.0, -yaw_err * 150.0)
                turn_right_hz = max(0.0, yaw_err * 150.0)
                forward_hz = 100.0 if abs(yaw_err) < 0.4 else 10.0
                action = np.array(
                    [forward_hz, turn_left_hz, turn_right_hz, grasp_hz, release_hz],
                    dtype=np.float32,
                )
                return env.step(action)

            # Phase 1: Approach object until within GRASP_RADIUS (2.0)
            for _ in range(100):
                dist_to_obj = np.linalg.norm(env.world.fly_pos - env.world.object_pos)
                if dist_to_obj < 1.5:
                    break
                obs, reward, terminated, truncated, info = navigate_step(
                    env.world.object_pos, grasp_hz=0.0, release_hz=0.0
                )
                self.assertFalse(terminated)

            dist_to_obj = np.linalg.norm(env.world.fly_pos - env.world.object_pos)
            self.assertLess(
                dist_to_obj,
                env.world.GRASP_RADIUS,
                "Fly failed to approach within GRASP_RADIUS of object",
            )
            self.assertFalse(env.world.object_is_carried)

            # Phase 2: Grasp object near current location
            obs, reward, terminated, truncated, info = navigate_step(
                env.world.object_pos, grasp_hz=200.0, release_hz=0.0
            )
            self.assertTrue(
                env.world.object_is_carried,
                "Fly should have grasped the object after firing grasp action",
            )
            self.assertTrue(info["object_carried"])
            self.assertFalse(terminated)

            # Phase 3 & 4: Carry object to target shelf and deliver
            pos_at_grasp = env.world.object_pos.copy()
            delivered = False
            for _ in range(150):
                obs, reward, terminated, truncated, info = navigate_step(
                    env.world.SHELF_RIGHT_POS, grasp_hz=0.0, release_hz=0.0
                )
                if terminated:
                    delivered = True
                    break
                # While still in transit, object must remain carried and move with fly
                self.assertTrue(env.world.object_is_carried)

            self.assertTrue(delivered, "Episode should terminate upon object delivery")
            self.assertTrue(env.world.object_delivered)
            self.assertTrue(info["object_delivered"])
            self.assertFalse(env.world.object_is_carried)
            self.assertEqual(reward, 1.0)
            self.assertGreater(
                np.linalg.norm(env.world.object_pos - pos_at_grasp),
                2.0,
                "Object should have been carried a significant distance to the shelf",
            )

    def test_file_system_object_grasping_workflow(self):
        """Test 5: FileObject and FolderHierarchy state transitions during grasp/carry/deliver."""
        hierarchy = FolderHierarchy()
        inbox = hierarchy.create_folder("/inbox")
        archive = hierarchy.create_folder("/archive")

        file_obj = FileObject("/inbox/report.pdf", size_bytes=4096)
        inbox.add_file(file_obj)
        self.assertEqual(file_obj.state, FileState.ON_SHELF)

        # Simulate grasp -> carry -> release/transfer
        file_obj.state = FileState.GRASPED
        self.assertEqual(file_obj.to_dict()["state"], "grasped")

        file_obj.state = FileState.CARRIED
        self.assertEqual(file_obj.to_dict()["state"], "carried")

        transferred = hierarchy.transfer_file("/inbox/report.pdf", "/inbox", "/archive")
        self.assertTrue(transferred)
        file_obj.state = FileState.ON_SHELF
        self.assertEqual(file_obj.path, "/archive/report.pdf")
        self.assertIsNotNone(hierarchy.get_file("/archive/report.pdf"))


def main():
    print("🪰 Fly Assistant Grasping Integration Tests")
    print("=" * 50)
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestGraspingIntegration)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
