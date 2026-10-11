import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from environment.inventory import create_inventory, deliver_item
from environment import ShelfTaskEnv


class InventoryTests(unittest.TestCase):
    def test_initial_inventory_has_four_misfiled_project_books_and_one_correct_book(self):
        inventory = create_inventory()

        self.assertEqual(len(inventory), 5)
        self.assertEqual(sum(item["shelf"] == 0 for item in inventory), 4)
        self.assertEqual(sum(item["shelf"] == 1 for item in inventory), 1)
        self.assertTrue(all(item["category"] == "Projects" for item in inventory))

    def test_delivery_moves_one_project_book_without_changing_batch_direction(self):
        inventory = create_inventory()

        deliver_item(inventory, "misfiled-1", 1)

        self.assertEqual(next(item for item in inventory if item["id"] == "misfiled-1")["shelf"], 1)
        self.assertEqual(sum(item["shelf"] == 0 for item in inventory), 3)
        self.assertEqual(sum(item["shelf"] == 1 for item in inventory), 2)

    def test_a_sorting_episode_keeps_the_projects_shelf_as_its_target(self):
        env = ShelfTaskEnv.__new__(ShelfTaskEnv)
        from environment.world_state import WorldState
        env.world = WorldState(target_shelf=0, seed=1)
        env.brain = type("Brain", (), {"reset": lambda self, seed=None: None})()
        env.steps = 0
        env.episode_reward = 0.0

        env.reset(seed=2, options={"target_shelf": 1})

        self.assertEqual(env.world.target_shelf, 1)


if __name__ == "__main__":
    unittest.main()
