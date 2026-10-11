#!/usr/bin/env python3
"""
Smoke test: verify basic functionality without full training.
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../src'))

def test_imports():
    """Test that all modules can be imported."""
    print("Testing imports...")
    try:
        from brain import BrainAdapter
        from environment import ShelfTaskEnv, WorldState
        from agent import LinearPolicy, SimpleES
        print("✓ All imports successful")
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False


def test_world_state():
    """Test world state basic operations."""
    print("\nTesting world state...")
    try:
        from environment import WorldState
        world = WorldState(target_shelf=0, seed=42)
        
        # Check initial state
        assert world.target_shelf == 0
        assert world.fly_pos[0] == 0.0
        assert world.fly_yaw == 0.0
        
        # Test movement
        world.update_fly(0.5, 0.1)
        assert world.fly_pos[2] > 0.0  # Should have moved forward
        
        # Test observation
        obs = world.get_observation()
        assert obs.shape == (13,)
        
        # Test grasping
        world.fly_pos = world.object_pos.copy()  # Move fly to object
        world.update_grasp(0.5, 0.0)
        assert world.object_is_carried
        
        world.update_grasp(0.0, 0.5)
        assert not world.object_is_carried
        
        print("✓ World state and grasping OK")
        return True
    except Exception as e:
        print(f"✗ World state failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_brain_light():
    """Test brain adapter initialization (light check, no full simulation)."""
    print("\nTesting brain adapter...")
    try:
        from brain import BrainAdapter
        print("  Loading connectome (this takes ~10s)...")
        brain = BrainAdapter(dt=0.2, w_scale=0.5)
        
        # Check that neuron groups were found
        assert len(brain.visual_left) > 0, "No visual_left neurons"
        assert len(brain.visual_right) > 0, "No visual_right neurons"
        assert len(brain.forward) > 0, "No forward neurons"
        
        print(f"✓ Brain adapter OK ({brain.conn.N:,} neurons loaded)")
        return True
    except Exception as e:
        print(f"✗ Brain adapter failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_policy():
    """Test policy and ES."""
    print("\nTesting policy...")
    try:
        from agent import LinearPolicy, SimpleES
        import numpy as np
        
        policy = LinearPolicy(obs_dim=10, action_dim=3, seed=42)
        obs = np.random.randn(10)
        action = policy(obs)
        
        assert action.shape == (3,)
        assert (action >= 0).all(), "Actions should be non-negative"
        
        # Test ES
        es = SimpleES(num_params=33, population_size=10, seed=42)
        candidates, epsilon = es.ask()
        assert candidates.shape == (10, 33)
        
        rewards = np.random.randn(10)
        es.tell(epsilon, rewards)
        
        print("✓ Policy and ES OK")
        return True
    except Exception as e:
        print(f"✗ Policy failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("🪰 Fly Assistant Smoke Tests")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_world_state,
        test_policy,
        test_brain_light,  # This one is slow
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print("\n" + "=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ All {total} tests passed!")
        return 0
    else:
        print(f"❌ {total - passed}/{total} tests failed")
        return 1


if __name__ == '__main__':
    sys.exit(main())
