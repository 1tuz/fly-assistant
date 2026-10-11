"""The small, visible book-sorting scenario used by the simulator."""


def create_inventory():
    return [
        {"id": "misfiled-1", "name": "q3_report.pdf", "category": "Projects", "shelf": 0, "status": "misfiled"},
        {"id": "misfiled-2", "name": "architecture.md", "category": "Projects", "shelf": 0, "status": "misfiled"},
        {"id": "misfiled-3", "name": "fly_model.py", "category": "Projects", "shelf": 0, "status": "misfiled"},
        {"id": "misfiled-4", "name": "weights.bin", "category": "Projects", "shelf": 0, "status": "misfiled"},
        {"id": "sorted-1", "name": "project_index.md", "category": "Projects", "shelf": 1, "status": "sorted"},
    ]


def deliver_item(inventory, item_id, shelf):
    item = next((item for item in inventory if item["id"] == item_id), None)
    if item is None or item["shelf"] == shelf:
        raise ValueError(f"item cannot be delivered: {item_id}")
    item["shelf"] = shelf
    item["status"] = "sorted"
