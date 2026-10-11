// 3D scene for fly-assistant visualization with BookcaseShelf & File system
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFly as createFlyModel, REST } from './fly-model.js';
import { BOOKS_POSITION, SHELF_LABEL_SIZE, inventoryBookPosition, shelfLabelPosition, taskObjectPosition, tripodPhase } from './scene-layout.js';

// Scene state
let scene, camera, renderer;
let flyMesh, leftShelf, rightShelf, objectMesh;
let flyModel, flySpeed = 0, previousFlyPosition = null, lastFlySample = 0, gaitPhase = 0;
let lastAnimationFrame = performance.now();
let taskBookMesh;
let taskBookRestPosition;
let inventoryBookTemplate;
const inventoryBookMeshes = new Map();
let activeCategoryBadge;
let leftShelfBookcase, rightShelfBookcase;
const assetLoader = new GLTFLoader();
let currentState = null;
let currentDepth = 1;
let cameraTarget = new THREE.Vector3(0, 0.4, 2.5);
let cameraVelocity = new THREE.Vector3();
let followFly = false;
const cameraKeys = new Set();
let pointer = null;
let touchPoints = new Map();
let lastPinch = null;

// Update rate
const UPDATE_INTERVAL = 100; // ms
const VISUAL_SCALE = 0.5;

// BookcaseShelf class for open shelves, adjustable size, and nesting depth scaling
class BookcaseShelf {
    constructor(scene, position, name = "Shelf", path = "/", depth = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.name = name;
        this.path = path;
        this.depth = depth;
        
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        this.files = [];
        this.subfolders = [];
        
        this.buildShelf();
        this.scene.add(this.group);
    }
    
    computeDimensions() {
        // Nesting depth scaling rule:
        // Depth 0: Large bookcase bay (4.0 x 3.0 x 1.5)
        // Depth 1: Shelf tier (2.2 x 1.5 x 1.2)
        // Depth 2+: Nested compartment / drawer scaling by 0.75^depth
        const scale = Math.pow(0.75, this.depth);
        if (this.depth === 0) {
            return { width: 4.5, height: 3.2, depth: 1.6, tiers: 3 };
        } else if (this.depth === 1) {
            return { width: 2.4, height: 1.6, depth: 1.2, tiers: 2 };
        } else {
            return { 
                width: Math.max(0.8, 2.4 * scale), 
                height: Math.max(0.5, 1.6 * scale), 
                depth: Math.max(0.5, 1.2 * scale), 
                tiers: 1 
            };
        }
    }
    
    buildShelf() {
        const dim = this.computeDimensions();
        const w = dim.width;
        const h = dim.height;
        const d = dim.depth;
        const thickness = 0.08;
        
        // Materials (wood/metallic tone varying with nesting depth)
        const hue = 0.08 + (this.depth * 0.08) % 0.4;
        const woodColor = new THREE.Color().setHSL(hue, 0.5, 0.4);
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: woodColor,
            roughness: 0.6,
            metalness: 0.15
        });
        
        const backingMaterial = new THREE.MeshStandardMaterial({
            color: woodColor.clone().multiplyScalar(0.65),
            roughness: 0.8
        });
        
        // Back panel
        const backGeom = new THREE.BoxGeometry(w, h, thickness * 0.5);
        const backPanel = new THREE.Mesh(backGeom, backingMaterial);
        backPanel.position.set(0, h / 2, -d / 2);
        backPanel.receiveShadow = true;
        this.group.add(backPanel);
        
        // Left side panel
        const sideGeom = new THREE.BoxGeometry(thickness, h, d);
        const leftSide = new THREE.Mesh(sideGeom, panelMaterial);
        leftSide.position.set(-w / 2 + thickness / 2, h / 2, 0);
        leftSide.castShadow = true;
        leftSide.receiveShadow = true;
        this.group.add(leftSide);
        
        // Right side panel
        const rightSide = new THREE.Mesh(sideGeom, panelMaterial);
        rightSide.position.set(w / 2 - thickness / 2, h / 2, 0);
        rightSide.castShadow = true;
        rightSide.receiveShadow = true;
        this.group.add(rightSide);
        
        // Top board
        const horizGeom = new THREE.BoxGeometry(w, thickness, d);
        const topBoard = new THREE.Mesh(horizGeom, panelMaterial);
        topBoard.position.set(0, h - thickness / 2, 0);
        topBoard.castShadow = true;
        topBoard.receiveShadow = true;
        this.group.add(topBoard);
        
        // Bottom board
        const bottomBoard = new THREE.Mesh(horizGeom, panelMaterial);
        bottomBoard.position.set(0, thickness / 2, 0);
        bottomBoard.castShadow = true;
        bottomBoard.receiveShadow = true;
        this.group.add(bottomBoard);
        
        // Intermediate shelf tiers
        const tiers = dim.tiers;
        for (let i = 1; i < tiers; i++) {
            const tierY = (h / tiers) * i;
            const shelfBoard = new THREE.Mesh(horizGeom, panelMaterial);
            shelfBoard.position.set(0, tierY, 0);
            shelfBoard.castShadow = true;
            shelfBoard.receiveShadow = true;
            this.group.add(shelfBoard);
        }
        
        // Support poles underneath for top-level shelves
        if (this.depth <= 1) {
            const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6 });
            const leftPole = new THREE.Mesh(poleGeom, poleMat);
            leftPole.position.set(-w / 2 + 0.2, -0.75, 0);
            leftPole.castShadow = true;
            this.group.add(leftPole);
            
            const rightPole = new THREE.Mesh(poleGeom, poleMat);
            rightPole.position.set(w / 2 - 0.2, -0.75, 0);
            rightPole.castShadow = true;
            this.group.add(rightPole);
        }
        
        // Add folder label & nesting visualization sprite
        this.createLabel();
        
        // Re-add existing files if any
        const existingFiles = [...this.files];
        this.files = [];
        existingFiles.forEach(f => this.addFileObject(f.data));
    }
    
    createLabel() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(20, 24, 33, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        
        ctx.strokeStyle = '#4af';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, 256, 64);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`📁 ${this.name} (L${this.depth})`, 128, 22);
        
        ctx.fillStyle = '#4af';
        ctx.font = '13px sans-serif';
        ctx.fillText(this.path, 128, 46);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        const dim = this.computeDimensions();
        sprite.position.fromArray(shelfLabelPosition(dim.height));
        sprite.scale.set(...SHELF_LABEL_SIZE, 1);
        this.group.add(sprite);
        this.labelSprite = sprite;
    }
    
    updateDepth(newDepth) {
        this.depth = newDepth;
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }
        this.buildShelf();
    }
    
    addFileObject(fileData) {
        // fileData: { name, size, markers: { color, tag }, state }
        const fileGroup = new THREE.Group();
        fileGroup.userData.fileData = fileData;
        fileGroup.userData.kind = 'file';
        
        // Book / Document geometry
        const w = 0.22;
        const h = 0.32;
        const th = 0.08;
        const geom = new THREE.BoxGeometry(w, h, th);
        
        const color = fileData.markers?.color || 0x3366ff;
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.2
        });
        
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        fileGroup.add(mesh);
        
        // Spine marker badge
        const badgeGeom = new THREE.BoxGeometry(w * 0.8, 0.06, th * 1.15);
        const badgeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: fileData.markers?.emissive || 0x222222
        });
        const badge = new THREE.Mesh(badgeGeom, badgeMat);
        badge.position.set(0, 0.08, 0);
        fileGroup.add(badge);
        
        // Position on shelf tiers
        const fileIdx = this.files.length;
        const dim = this.computeDimensions();
        const startX = -dim.width / 2 + 0.35;
        const xOffset = startX + (fileIdx % 4) * 0.4;
        const shelfTier = Math.floor(fileIdx / 4);
        const yOffset = 0.22 + shelfTier * 0.6;
        
        fileGroup.position.set(xOffset, yOffset, 0);
        this.group.add(fileGroup);
        
        this.files.push({
            data: fileData,
            mesh: fileGroup
        });
    }
    
    clearFiles() {
        this.files.forEach(f => this.group.remove(f.mesh));
        this.files = [];
    }
}

// Initialize Three.js scene
function initScene() {
    const container = document.getElementById('container');
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x22252b);
    scene.fog = new THREE.Fog(0x1a1a1a, 20, 50);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 3.2, -4);
    camera.lookAt(cameraTarget);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Camera uses explicit pointer and keyboard handling so trackpad gestures remain predictable.
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
    scene.add(gridHelper);
    
    // Create shelves and objects
    createShelves();
    createFly();
    createObject();
    
    // Setup UI event listeners
    setupUI();
    setupCameraControls();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function createShelves() {
    // Left Bookcase Shelf at (-5, 0, 10)
    leftShelfBookcase = new BookcaseShelf(
        scene,
        new THREE.Vector3(-5 * VISUAL_SCALE, 0, 10 * VISUAL_SCALE),
        "Documents",
        "/root/documents",
        currentDepth
    );
    leftShelfBookcase.addFileObject({ name: "q3_report.pdf", size: 2048, markers: { color: 0x3366ff, tag: "finance" }, state: "on_shelf" });
    leftShelfBookcase.addFileObject({ name: "architecture.md", size: 1024, markers: { color: 0x22aa55, tag: "docs" }, state: "on_shelf" });
    
    // Right Bookcase Shelf at (5, 0, 10)
    rightShelfBookcase = new BookcaseShelf(
        scene,
        new THREE.Vector3(5 * VISUAL_SCALE, 0, 10 * VISUAL_SCALE),
        "Projects",
        "/root/projects",
        currentDepth
    );
    rightShelfBookcase.addFileObject({ name: "fly_model.py", size: 4096, markers: { color: 0xff6633, tag: "code" }, state: "on_shelf" });
    rightShelfBookcase.addFileObject({ name: "weights.bin", size: 16384, markers: { color: 0xffaa00, tag: "model" }, state: "on_shelf" });
    
    leftShelf = leftShelfBookcase.group;
    rightShelf = rightShelfBookcase.group;
    loadShelfAssets();
}

async function loadShelfAssets() {
    try {
        const [shelfAsset, bookAsset] = await Promise.all([
            assetLoader.loadAsync('./assets/shelf-01/Shelf_01.gltf'),
            assetLoader.loadAsync('./assets/books/books.gltf')
        ]);
        inventoryBookTemplate = bookAsset.scene.getObjectByName('book_encyclopedia_set_01_book01');
        if (!inventoryBookTemplate) throw new Error('Transferable volume is missing from the local book model');
        const shelves = [leftShelfBookcase, rightShelfBookcase];
        for (const shelf of shelves) {
            shelf.clearFiles();
            for (const child of [...shelf.group.children]) {
                if (child === shelf.labelSprite) continue;
                child.traverse(node => {
                    node.geometry?.dispose();
                    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) material?.dispose();
                });
                shelf.group.remove(child);
            }
            const cabinet = shelfAsset.scene.clone(true);
            cabinet.rotation.y = Math.PI;
            cabinet.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = false; } });
            const cabinetHeight = new THREE.Box3().setFromObject(cabinet).getSize(new THREE.Vector3()).y;
            shelf.labelSprite.position.fromArray(shelfLabelPosition(cabinetHeight));
            shelf.group.add(cabinet);

        }
        taskBookMesh = inventoryBookTemplate.clone(true);
        taskBookRestPosition = taskBookMesh.position.clone();
        objectMesh.add(taskBookMesh);
        activeCategoryBadge = createCategoryBadge('PROJECTS');
        activeCategoryBadge.position.set(0, 0.22, 0);
        objectMesh.add(activeCategoryBadge);
        objectMesh.visible = true;
    } catch (error) {
        const status = document.getElementById('status');
        status.textContent = `Local 3D asset error: ${error.message}`;
        status.className = 'error';
    }
}

function createCategoryBadge(category) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = '#17452d';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#8ee3a6';
    context.lineWidth = 5;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    context.fillStyle = '#ffffff';
    context.font = 'bold 36px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(category.toUpperCase(), canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    badge.scale.set(0.28, 0.07, 1);
    return badge;
}

function updateInventory(inventory, activeItemId) {
    if (!inventoryBookTemplate) return;
    if (!Array.isArray(inventory)) {
        for (const book of inventoryBookMeshes.values()) book.visible = false;
        return;
    }
    const shelves = [leftShelfBookcase, rightShelfBookcase];
    const slots = [0, 0];
    for (const item of inventory) {
        const shelfIndex = item.shelf;
        const shelf = shelves[shelfIndex];
        let book = inventoryBookMeshes.get(item.id);
        if (!book) {
            book = new THREE.Group();
            const model = inventoryBookTemplate.clone(true);
            book.add(model);
            const badge = createCategoryBadge(item.category);
            badge.position.set(0, 0.22, 0);
            book.add(badge);
            book.scale.setScalar(0.5);
            inventoryBookMeshes.set(item.id, book);
        }
        if (book.parent !== shelf.group) {
            book.parent?.remove(book);
            shelf.group.add(book);
        }
        const slot = slots[shelfIndex]++;
        book.position.fromArray(inventoryBookPosition(slot));
        book.visible = item.id !== activeItemId;
        book.userData.fileData = { name: item.name, markers: { tag: item.category } };
        book.userData.state = item.status === 'sorted' ? 'Sorted into Projects' : 'Misfiled: Projects';
    }
}

function createFly() {
    flyModel = createFlyModel();
    flyMesh = flyModel.root;
    flyMesh.scale.setScalar(0.06);
    flyMesh.userData.kind = 'fly';
    flyMesh.position.set(0, 0.5, 0);
    scene.add(flyMesh);
}

function createObject() {
    objectMesh = new THREE.Group();
    objectMesh.userData.fileData = { name: 'q3_report.pdf', size: 2048, markers: { tag: 'finance' } };
    objectMesh.userData.kind = 'task-object';
    objectMesh.visible = false;
    scene.add(objectMesh);
}

function setupUI() {
    const depthSlider = document.getElementById('depth-slider');
    if (depthSlider) {
        depthSlider.addEventListener('input', (e) => {
            currentDepth = parseInt(e.target.value);
            document.getElementById('depth-val').textContent = currentDepth;
            
            if (leftShelfBookcase) leftShelfBookcase.updateDepth(currentDepth);
            if (rightShelfBookcase) rightShelfBookcase.updateDepth(currentDepth);
        });
    }
}

function setupCameraControls() {
    const canvas = renderer.domElement;
    const updateLook = () => {
        const offset = camera.position.clone().sub(cameraTarget);
        const radius = Math.max(0.8, offset.length());
        const yaw = Math.atan2(offset.x, offset.z);
        const pitch = Math.asin(THREE.MathUtils.clamp(offset.y / radius, -0.98, 0.98));
        camera.position.set(
            cameraTarget.x + radius * Math.cos(pitch) * Math.sin(yaw),
            cameraTarget.y + radius * Math.sin(pitch),
            cameraTarget.z + radius * Math.cos(pitch) * Math.cos(yaw)
        );
        camera.lookAt(cameraTarget);
    };
    const pan = (dx, dy) => {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        const shift = right.multiplyScalar(-dx * 0.012).add(up.multiplyScalar(dy * 0.012));
        camera.position.add(shift);
        cameraTarget.add(shift);
    };
    canvas.addEventListener('pointerdown', event => {
        canvas.setPointerCapture(event.pointerId);
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, downX: event.clientX, downY: event.clientY, button: event.button };
        if (touchPoints.size === 2) {
            const points = [...touchPoints.values()];
            lastPinch = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        }
    });
    canvas.addEventListener('pointermove', event => {
        if (!touchPoints.has(event.pointerId)) return;
        const previous = touchPoints.get(event.pointerId);
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPoints.size >= 2) {
            const points = [...touchPoints.values()];
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            if (lastPinch !== null) camera.position.addScaledVector(camera.position.clone().sub(cameraTarget).normalize(), (lastPinch - distance) * 0.025);
            lastPinch = distance;
            pan(event.clientX - previous.x, event.clientY - previous.y);
        } else if (pointer?.id === event.pointerId) {
            const dx = event.clientX - pointer.x;
            const dy = event.clientY - pointer.y;
            if (pointer.button === 2 || event.shiftKey) pan(dx, dy);
            else {
                const offset = camera.position.clone().sub(cameraTarget);
                offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.005);
                camera.position.copy(cameraTarget).add(offset);
                const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
                camera.position.addScaledVector(right, dy * 0.004);
                updateLook();
            }
            pointer.x = event.clientX;
            pointer.y = event.clientY;
        }
        camera.lookAt(cameraTarget);
    });
    const endPointer = event => {
        const moved = pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY) > 5;
        if (!moved && touchPoints.size === 1) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1), camera);
            const hit = raycaster.intersectObjects(scene.children, true).find(item => {
                let node = item.object;
                while (node && !node.userData.fileData && node !== flyMesh) node = node.parent;
                return node && (node.userData.fileData || node === flyMesh);
            });
            if (hit) {
                let node = hit.object;
                while (node && !node.userData.fileData && node !== flyMesh) node = node.parent;
                if (node?.userData.fileData) showFile(node.userData.fileData, node.userData.state);
                else document.getElementById('task-state').textContent = 'Selected: fly';
            }
        }
        touchPoints.delete(event.pointerId);
        if (pointer?.id === event.pointerId) pointer = null;
        if (!pointer && touchPoints.size === 1) {
            const [id, point] = [...touchPoints.entries()][0];
            pointer = { id, x: point.x, y: point.y, downX: point.x, downY: point.y, button: 0 };
        }
        if (touchPoints.size < 2) lastPinch = null;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('wheel', event => {
        event.preventDefault();
        camera.position.addScaledVector(camera.position.clone().sub(cameraTarget).normalize(), event.deltaY * 0.006);
        camera.lookAt(cameraTarget);
    }, { passive: false });
    canvas.addEventListener('dblclick', event => {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1), camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const hit = hits.find(item => {
            let node = item.object;
            while (node && !node.userData.fileData && node !== flyMesh) node = node.parent;
            return node && (node.userData.fileData || node === flyMesh);
        });
        if (!hit) return;
        let root = hit.object;
        while (root && !root.userData.fileData && root !== flyMesh) root = root.parent;
        cameraTarget.copy(root.getWorldPosition(new THREE.Vector3()));
        if (root.userData.fileData) showFile(root.userData.fileData, root.userData.state);
        camera.lookAt(cameraTarget);
    });
    window.addEventListener('keydown', event => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
        const key = event.key.toLowerCase();
        if ('wasdqe'.includes(key)) { event.preventDefault(); cameraKeys.add(key); }
        if (event.key === 'Shift') cameraKeys.add('shift');
    });
    window.addEventListener('keyup', event => {
        cameraKeys.delete(event.key.toLowerCase());
        if (event.key === 'Shift') cameraKeys.delete('shift');
    });
    document.getElementById('camera-reset').addEventListener('click', () => {
        cameraTarget.set(0, 0.4, 2.5);
        camera.position.set(0, 3.2, -4);
        cameraVelocity.set(0, 0, 0);
        camera.lookAt(cameraTarget);
    });
    document.getElementById('camera-follow').addEventListener('click', event => {
        followFly = !followFly;
        event.currentTarget.textContent = `Follow fly: ${followFly ? 'on' : 'off'}`;
        event.currentTarget.setAttribute('aria-pressed', String(followFly));
    });
    document.getElementById('panel-toggle').addEventListener('click', event => {
        const hidden = document.body.classList.toggle('panel-hidden');
        event.currentTarget.textContent = hidden ? 'Show controls' : 'Hide panel';
        event.currentTarget.setAttribute('aria-label', hidden ? 'Show controls' : 'Hide controls');
    });
    document.getElementById('sim-start').addEventListener('click', () => sendControl({ action: 'start', mode: document.getElementById('sim-mode').value }));
    document.getElementById('sim-stop').addEventListener('click', () => sendControl({ action: 'stop' }));
    document.getElementById('sim-reset').addEventListener('click', () => sendControl({ action: 'reset' }));
}

async function sendControl(command) {
    try {
        const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `API ${response.status}`);
        document.getElementById('status').textContent = `Control accepted: ${command.action}`;
        document.getElementById('status').className = 'connected';
    } catch (error) {
        document.getElementById('status').textContent = `Control error: ${error.message}`;
        document.getElementById('status').className = 'error';
    }
}

function showFile(file, state = file.state) {
    document.getElementById('meta-name').textContent = file.name || 'Simulation object';
    document.getElementById('meta-size').textContent = file.size == null ? '—' : `${(file.size / 1024).toFixed(file.size >= 1024 ? 1 : 0)} MB`;
    document.getElementById('meta-tag').textContent = file.markers?.tag || '—';
    document.getElementById('meta-state').textContent = state || 'In simulation';
}

function updateFromState(state, info) {
    if (!state || !state.fly) return;
    updateInventory(info.inventory, info.active_item_id);
    objectMesh.visible = Array.isArray(info.inventory) ? info.active_item_id != null : true;
    if (activeCategoryBadge) activeCategoryBadge.visible = Boolean(info.active_item);
    
    // Update fly position and orientation
    const fly = state.fly;
    const now = performance.now();
    if (info.steps <= 1) {
        flySpeed = 0;
        previousFlyPosition = null;
    } else if (previousFlyPosition && lastFlySample) {
        const elapsed = Math.max((now - lastFlySample) / 1000, 0.01);
        const dx = fly.position[0] - previousFlyPosition[0];
        const dz = fly.position[2] - previousFlyPosition[2];
        const speed = Math.hypot(dx, dz) / elapsed;
        flySpeed = THREE.MathUtils.lerp(flySpeed, speed < 4 ? speed : 0, 0.45);
    }
    previousFlyPosition = fly.position.slice();
    lastFlySample = now;
    flyMesh.position.set(fly.position[0] * VISUAL_SCALE, 0, fly.position[2] * VISUAL_SCALE);
    
    // Update object position
    if (state.object) {
        const onShelf = !state.object.is_carried && !state.object.delivered;
        objectMesh.position.fromArray(taskObjectPosition(state.object.position, onShelf, VISUAL_SCALE));
        if (taskBookMesh) {
            taskBookMesh.position.copy(taskBookRestPosition);
            if (onShelf) taskBookMesh.position.add(new THREE.Vector3(...BOOKS_POSITION));
        }
        objectMesh.userData.state = state.object.delivered ? 'Delivered' : state.object.is_carried ? 'Carried by fly' : 'On source shelf';
    }
    
    // Highlight target shelf
    if (state.target_shelf !== undefined) {
        const targetShelfGroup = state.target_shelf === 0 ? leftShelf : rightShelf;
        const otherShelfGroup = state.target_shelf === 0 ? rightShelf : leftShelf;
        
        targetShelfGroup.traverse(child => {
            if (child.material && child !== leftShelfBookcase.labelSprite && child !== rightShelfBookcase.labelSprite) {
                child.material.emissive = new THREE.Color(0x113311);
            }
        });
        otherShelfGroup.traverse(child => {
            if (child.material && child !== leftShelfBookcase.labelSprite && child !== rightShelfBookcase.labelSprite) {
                child.material.emissive = new THREE.Color(0x000000);
            }
        });
    }
}

function updateMetrics(info) {
    if (!info) return;
    
    document.getElementById('target').textContent = 
        info.target_shelf === 0 ? 'Left (Documents)' : 'Right (Projects)';
    if (info.total_items) document.getElementById('inventory-progress').textContent = `${info.delivered_items || 0} / ${info.total_items}`;
    document.getElementById('steps').textContent = info.steps || '-';
    document.getElementById('brain_activity').textContent = 
        info.brain_activity?.toLocaleString() || '-';
    document.getElementById('motor_fwd').textContent = 
        info.motor_forward?.toFixed(1) || '-';
    document.getElementById('motor_turn_l').textContent = 
        info.motor_turn_left?.toFixed(1) || '-';
    document.getElementById('motor_turn_r').textContent = 
        info.motor_turn_right?.toFixed(1) || '-';
    
    const sourceShelf = info.target_shelf === 0 ? 1 : 0;
    const currentShelf = info.object_carried ? info.target_shelf : sourceShelf;
    const task = info.task_status || (info.object_delivered ? 'Book delivered' : info.object_is_carried ? 'Carrying book' : info.running ? 'Finding next book' : 'Ready to sort');
    if (info.active_item) showFile({ ...info.active_item, markers: { tag: info.active_item.category } }, info.object_is_carried ? 'Carried by fly' : 'Misfiled: Projects');
    else if (info.total_items) showFile({ name: 'No misfiled books left', markers: { tag: '—' } }, 'Sorting complete');
    const sourcePath = currentShelf === 0 ? 'Documents' : 'Projects';
    const destinationPath = info.target_shelf === 0 ? 'Documents' : 'Projects';
    document.getElementById('task-state').textContent = `Task: ${task}${info.total_items ? ` · ${sourcePath} → ${destinationPath}` : ''}`;
    const training = info.training;
    document.getElementById('training-progress').textContent = training
        ? `Generation ${training.generation + 1} · best-policy success ${(training.best_policy_success * 100).toFixed(1)}%`
        : info.training_status === 'complete' ? 'Training complete' : info.mode === 'train' ? 'Training starting…' : 'Training idle';
}

async function pollState() {
    try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error(`API ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        currentState = data.world;
        
        updateFromState(currentState, data);
        updateMetrics(data);
        if (followFly && currentState?.fly) {
            cameraTarget.lerp(new THREE.Vector3(currentState.fly.position[0] * VISUAL_SCALE, 0.25, currentState.fly.position[2] * VISUAL_SCALE), 0.12);
        }
        
        const status = document.getElementById('status');
        if (data.status === 'error') {
            status.textContent = `Simulation error: ${data.error || 'unknown error'}`;
            status.className = 'error';
        } else if (data.running) {
            status.textContent = data.task_status === 'delivered' ? 'File delivered' : 'Simulation running';
            status.className = 'connected';
        } else if (data.status === 'stopped') {
            status.textContent = 'Simulation stopped';
            status.className = '';
        } else if (data.status === 'completed') {
            status.textContent = 'Sorting complete — 4 books on Projects';
            status.className = 'connected';
        } else {
            status.textContent = 'Loading neural simulation…';
            status.className = '';
        }
    } catch (error) {
        document.getElementById('status').textContent = `Disconnected: ${error.message}`;
        document.getElementById('status').className = 'error';
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const elapsed = Math.min((now - lastAnimationFrame) / 1000, 0.05);
    lastAnimationFrame = now;
    if (flyModel && currentState?.fly) {
        const time = now / 1000;
        const motion = THREE.MathUtils.clamp(flySpeed / 0.6, 0, 1);
        gaitPhase += elapsed * Math.PI * 2 * (2 + motion * 4);
        const wingPhase = time * Math.PI * 36;
        flyModel.apply({
            ...REST,
            yaw: currentState.fly.yaw,
            pitch: REST.pitch + motion * Math.sin(gaitPhase) * 0.04,
            headYaw: Math.sin(time * 1.7) * 0.025,
            antenna: Math.sin(time * 2.4) * 0.08,
            abdPitch: REST.abdPitch + motion * Math.sin(gaitPhase + 0.8) * 0.025,
            wingSpreadL: motion * 0.9,
            wingSpreadR: motion * 0.9,
            wingElevL: motion * Math.sin(wingPhase) * 0.35,
            wingElevR: motion * Math.sin(wingPhase + Math.PI) * 0.35,
        });
        for (const leg of flyModel.legs) {
            const phase = tripodPhase(leg.name, leg.side, gaitPhase);
            const swing = Math.sin(phase) * motion;
            const lift = Math.max(0, Math.cos(phase)) * motion;
            leg.coxa.rotation.z += swing * 0.18;
            leg.femur.rotation.z += swing * 0.2;
            leg.tibia.rotation.z -= lift * 0.24;
            leg.tarsus.rotation.z += lift * 0.12;
        }
    }
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    right.y = 0;
    right.normalize();
    const direction = new THREE.Vector3();
    if (cameraKeys.has('w')) direction.add(forward);
    if (cameraKeys.has('s')) direction.sub(forward);
    if (cameraKeys.has('d')) direction.add(right);
    if (cameraKeys.has('a')) direction.sub(right);
    if (cameraKeys.has('e')) direction.y += 1;
    if (cameraKeys.has('q')) direction.y -= 1;
    if (direction.lengthSq()) direction.normalize();
    cameraVelocity.lerp(direction.multiplyScalar(cameraKeys.has('shift') ? 2.5 : 0.75), 0.16);
    camera.position.addScaledVector(cameraVelocity, 0.016);
    cameraTarget.addScaledVector(cameraVelocity, 0.016);
    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
}

// Initialize and start
initScene();
setInterval(pollState, UPDATE_INTERVAL);
pollState(); // Initial fetch
