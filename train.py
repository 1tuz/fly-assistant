#!/usr/bin/env python3
"""
Training script for shelf-selection task.

Uses simple evolution strategy to train a linear policy.
"""
import sys
import os
import argparse
import time
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import numpy as np
from environment import ShelfTaskEnv
from agent import LinearPolicy, SimpleES


def evaluate_policy(env, policy, n_episodes=5, seed=0):
    """Evaluate policy over multiple episodes."""
    returns = []
    success_count = 0
    
    for i in range(n_episodes):
        obs, info = env.reset(seed=seed + i)
        episode_return = 0.0
        terminated = False
        truncated = False
        
        while not (terminated or truncated):
            action = policy(obs)
            obs, reward, terminated, truncated, info = env.step(action)
            episode_return += reward
        
        returns.append(episode_return)
        if episode_return > 0.5:  # Success if positive return
            success_count += 1
    
    return {
        'mean_return': float(np.mean(returns)),
        'std_return': float(np.std(returns)),
        'success_rate': success_count / n_episodes,
        'returns': returns
    }


def train(args):
    """Main training loop."""
    print("🪰 Fly Assistant Training")
    print("=" * 50)
    print(f"Generations: {args.generations}")
    print(f"Population: {args.population}")
    print(f"Eval episodes: {args.eval_episodes}")
    print("")
    
    # Create output directory
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize environment
    print("Initializing environment (loading connectome)...")
    env = ShelfTaskEnv(max_steps=args.max_steps, step_ms=args.step_ms)
    print(f"✓ Environment ready (obs_dim={env.observation_dim}, action_dim={env.action_dim})")
    print("")
    
    # Initialize policy and optimizer
    policy = LinearPolicy(env.observation_dim, env.action_dim, seed=args.seed)
    num_params = policy.get_params().shape[0]
    
    es = SimpleES(
        num_params=num_params,
        population_size=args.population,
        sigma=args.sigma,
        learning_rate=args.lr,
        seed=args.seed
    )
    
    print(f"Policy: {num_params} parameters")
    print(f"ES: population={args.population}, σ={args.sigma}, lr={args.lr}")
    print("")
    
    # Training log
    training_log = []
    best_return = -float('inf')
    
    # Training loop
    for gen in range(args.generations):
        gen_start = time.time()
        
        # Generate candidate policies
        candidates, epsilon = es.ask()
        
        # Evaluate each candidate
        rewards = []
        for i, params in enumerate(candidates):
            policy.set_params(params)
            result = evaluate_policy(env, policy, n_episodes=args.eval_episodes, 
                                    seed=args.seed + gen * 1000 + i)
            rewards.append(result['mean_return'])
        
        # Update ES
        es.tell(epsilon, rewards)
        
        # Evaluate best policy
        policy.set_params(es.get_best())
        best_result = evaluate_policy(env, policy, n_episodes=args.eval_episodes * 2,
                                     seed=args.seed + gen * 10000)
        
        gen_time = time.time() - gen_start
        
        # Log results
        log_entry = {
            'generation': gen,
            'mean_reward': float(np.mean(rewards)),
            'max_reward': float(np.max(rewards)),
            'best_policy_return': best_result['mean_return'],
            'best_policy_success': best_result['success_rate'],
            'time': gen_time
        }
        training_log.append(log_entry)
        
        # Save best policy
        if best_result['mean_return'] > best_return:
            best_return = best_result['mean_return']
            policy.save(output_dir / 'best_policy.npz')
            print(f"Gen {gen:3d} | "
                  f"pop_mean={np.mean(rewards):6.3f} pop_max={np.max(rewards):6.3f} | "
                  f"best_return={best_result['mean_return']:6.3f} "
                  f"success={best_result['success_rate']:.1%} | "
                  f"{gen_time:.1f}s ⭐ NEW BEST")
        else:
            print(f"Gen {gen:3d} | "
                  f"pop_mean={np.mean(rewards):6.3f} pop_max={np.max(rewards):6.3f} | "
                  f"best_return={best_result['mean_return']:6.3f} "
                  f"success={best_result['success_rate']:.1%} | "
                  f"{gen_time:.1f}s")
        
        # Save checkpoint every 10 generations
        if (gen + 1) % 10 == 0:
            policy.save(output_dir / f'policy_gen{gen}.npz')
    
    # Save final policy and log
    policy.save(output_dir / 'final_policy.npz')
    with open(output_dir / 'training_log.json', 'w') as f:
        json.dump(training_log, f, indent=2)
    
    print("")
    print(f"✅ Training complete!")
    print(f"Best return: {best_return:.3f}")
    print(f"Policies saved to: {output_dir}")
    
    env.close()


def main():
    parser = argparse.ArgumentParser(description='Train fly to select correct shelf')
    parser.add_argument('--generations', type=int, default=50,
                       help='Number of ES generations')
    parser.add_argument('--population', type=int, default=30,
                       help='Population size per generation')
    parser.add_argument('--eval-episodes', type=int, default=3,
                       help='Episodes per policy evaluation')
    parser.add_argument('--max-steps', type=int, default=200,
                       help='Max steps per episode')
    parser.add_argument('--step-ms', type=int, default=50,
                       help='Simulation milliseconds per step')
    parser.add_argument('--sigma', type=float, default=0.1,
                       help='ES noise standard deviation')
    parser.add_argument('--lr', type=float, default=0.01,
                       help='ES learning rate')
    parser.add_argument('--seed', type=int, default=42,
                       help='Random seed')
    parser.add_argument('--output', type=str, default='runs/training',
                       help='Output directory')
    
    args = parser.parse_args()
    train(args)


if __name__ == '__main__':
    main()
