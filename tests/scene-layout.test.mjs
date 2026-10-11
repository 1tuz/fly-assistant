import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BOOKS_POSITION, SHELF_LABEL_SIZE, shelfLabelPosition, taskObjectPosition, tripodPhase } from '../web/scene-layout.js';

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

test('book row sits on a shelf within the cabinet instead of intersecting its textured mesh', async () => {
    const sceneCode = await readFile(new URL('../web/scene.js', import.meta.url), 'utf8');
    assert.equal(sceneCode.includes('books.position.fromArray(BOOKS_POSITION)'), true);
    assert.equal(sceneCode.includes('objectMesh.position.fromArray(taskObjectPosition(state.object.position, onShelf, VISUAL_SCALE))'), true);
    assert.equal(sceneCode.includes('if (index === 0) books.getObjectByName(movingBook.name)'), false);
    const [shelf, books] = await Promise.all([
        readFile(new URL('../web/assets/shelf-01/Shelf_01.gltf', import.meta.url), 'utf8').then(JSON.parse),
        readFile(new URL('../web/assets/books/books.gltf', import.meta.url), 'utf8').then(JSON.parse),
    ]);
    const shelfBounds = shelf.accessors[shelf.meshes[0].primitives[0].attributes.POSITION];
    const front = -shelfBounds.max[2];
    const back = -shelfBounds.min[2];

    for (const node of books.nodes) {
        const mesh = books.meshes[node.mesh];
        const bounds = books.accessors[mesh.primitives[0].attributes.POSITION];
        const zMin = BOOKS_POSITION[2] + (node.translation?.[2] ?? 0) + bounds.min[2];
        const zMax = BOOKS_POSITION[2] + (node.translation?.[2] ?? 0) + bounds.max[2];
        const yMin = BOOKS_POSITION[1] + (node.translation?.[1] ?? 0) + bounds.min[1];
        const yMax = BOOKS_POSITION[1] + (node.translation?.[1] ?? 0) + bounds.max[1];
        assert.ok(zMin >= front && zMax <= back, `${node.name} lies outside the shelf depth`);
        assert.ok(yMin >= 0.3549 && yMax < 0.629, `${node.name} does not fit on the bottom book tier`);
    }
    assert.equal(sceneCode.includes('books.getObjectByName(movingBook.name)?.removeFromParent()'), true);
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
