import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BOOKS_POSITION, SHELF_LABEL_SIZE, inventoryBookPosition, shelfLabelPosition, taskObjectPosition, tripodPhase } from '../web/scene-layout.js';

test('shelf label clears the cabinet and sits in front of it', async () => {
    const sceneCode = await readFile(new URL('../web/scene.js', import.meta.url), 'utf8');
    assert.equal(sceneCode.includes('sprite.position.fromArray(shelfLabelPosition(dim.height))'), true);
    assert.equal(sceneCode.includes('sprite.scale.set(...SHELF_LABEL_SIZE, 1)'), true);
    assert.equal(sceneCode.includes('shelf.labelSprite.position.fromArray(shelfLabelPosition(cabinetHeight))'), true);
    const shelf = JSON.parse(await readFile(new URL('../web/assets/shelf-01/Shelf_01.gltf', import.meta.url)));
    const bounds = shelf.accessors[shelf.meshes[0].primitives[0].attributes.POSITION];
    const [x, y, z] = shelfLabelPosition(bounds.max[1]);

    assert.ok(y - SHELF_LABEL_SIZE[1] / 2 > bounds.max[1] + 0.45);
    assert.ok(z < -bounds.max[2]);
    assert.equal(x, 0);
});

test('categorized inventory books use individual shelf slots and share the carried book model', async () => {
    const sceneCode = await readFile(new URL('../web/scene.js', import.meta.url), 'utf8');
    assert.equal(sceneCode.includes('inventoryBookTemplate.clone(true)'), true);
    assert.equal(sceneCode.includes('createCategoryBadge(item.category)'), true);
    assert.equal(sceneCode.includes('book.visible = item.id !== activeItemId'), true);
    assert.equal(sceneCode.includes('objectMesh.position.fromArray(taskObjectPosition(state.object.position, onShelf, VISUAL_SCALE))'), true);
    assert.deepEqual(inventoryBookPosition(0), BOOKS_POSITION);
    assert.deepEqual(inventoryBookPosition(4), [BOOKS_POSITION[0] + 0.36, BOOKS_POSITION[1], BOOKS_POSITION[2]]);
    assert.equal(BOOKS_POSITION[1], 0.355);
});

test('moving volume replaces its row slot on a shelf and detaches while carried', () => {
    assert.deepEqual(taskObjectPosition([5, 0, 10], true), [2.5, 0, 5]);
    assert.deepEqual(taskObjectPosition([1, 0, 2], false), [0.5, 0.2, 1]);
});

test('leg phase alternates the left and right tripod groups', () => {
    const phase = 0.4;
    assert.equal(tripodPhase('T1', -1, phase), phase);
    assert.equal(tripodPhase('T3', -1, phase), phase);
    assert.equal(tripodPhase('T2', 1, phase), phase);
    assert.equal(tripodPhase('T1', 1, phase), phase + Math.PI);
    assert.equal(tripodPhase('T2', -1, phase), phase + Math.PI);
    assert.equal(tripodPhase('T3', 1, phase), phase + Math.PI);
});
