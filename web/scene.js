// 3D scene for fly-assistant visualization with BookcaseShelf & File system
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene state
let scene, camera, renderer, controls;
let flyMesh, leftShelf, rightShelf, objectMesh;
let leftShelfBookcase, rightShelfBookcase;
let currentState = null;
let currentDepth = 1;

// Update rate
const UPDATE_INTERVAL = 100; // ms

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
        sprite.position.set(0, dim.height + 0.45, 0);
        sprite.scale.set(1.8, 0.45, 1);
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
    scene.background = new THREE.Color(0x1a1a1a);
    scene.fog = new THREE.Fog(0x1a1a1a, 20, 50);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 8, -12);
    camera.lookAt(0, 0, 5);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 5);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function createShelves() {
    // Left Bookcase Shelf at (-5, 0, 10)
    leftShelfBookcase = new BookcaseShelf(
        scene,
        new THREE.Vector3(-5, 0, 10),
        "Documents",
        "/root/documents",
        currentDepth
    );
    leftShelfBookcase.addFileObject({ name: "q3_report.pdf", size: 2048, markers: { color: 0x3366ff, tag: "finance" }, state: "on_shelf" });
    leftShelfBookcase.addFileObject({ name: "architecture.md", size: 1024, markers: { color: 0x22aa55, tag: "docs" }, state: "on_shelf" });
    
    // Right Bookcase Shelf at (5, 0, 10)
    rightShelfBookcase = new BookcaseShelf(
        scene,
        new THREE.Vector3(5, 0, 10),
        "Projects",
        "/root/projects",
        currentDepth
    );
    rightShelfBookcase.addFileObject({ name: "fly_model.py", size: 4096, markers: { color: 0xff6633, tag: "code" }, state: "on_shelf" });
    rightShelfBookcase.addFileObject({ name: "weights.bin", size: 16384, markers: { color: 0xffaa00, tag: "model" }, state: "on_shelf" });
    
    leftShelf = leftShelfBookcase.group;
    rightShelf = rightShelfBookcase.group;
}

function createFly() {
    const flyGroup = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    bodyGeometry.scale(1, 0.8, 1.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.6,
        metalness: 0.4
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    flyGroup.add(body);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: 0xff3333,
        emissive: 0x330000,
        roughness: 0.3
    });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.2, 0.1, 0.3);
    flyGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.2, 0.1, 0.3);
    flyGroup.add(rightEye);
    
    // Wings
    const wingGeometry = new THREE.PlaneGeometry(0.6, 0.3);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        roughness: 0.2
    });
    
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.4, 0.05, 0);
    leftWing.rotation.y = -Math.PI / 4;
    flyGroup.add(leftWing);
    
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.4, 0.05, 0);
    rightWing.rotation.y = Math.PI / 4;
    flyGroup.add(rightWing);
    
    flyGroup.position.set(0, 0.5, 0);
    flyMesh = flyGroup;
    scene.add(flyMesh);
}

function createObject() {
    const objectGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const objectMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x444400
    });
    objectMesh = new THREE.Mesh(objectGeometry, objectMaterial);
    objectMesh.castShadow = true;
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

function updateFromState(state) {
    if (!state || !state.fly) return;
    
    // Update fly position and orientation
    const fly = state.fly;
    flyMesh.position.set(fly.position[0], 0.5, fly.position[2]);
    flyMesh.rotation.y = -fly.yaw;
    
    // Update object position
    if (state.object) {
        objectMesh.position.set(
            state.object.position[0],
            state.object.position[1] + 0.4,
            state.object.position[2]
        );
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
    document.getElementById('steps').textContent = info.steps || '-';
    document.getElementById('brain_activity').textContent = 
        info.brain_activity?.toLocaleString() || '-';
    document.getElementById('motor_fwd').textContent = 
        info.motor_forward?.toFixed(1) || '-';
    document.getElementById('motor_turn_l').textContent = 
        info.motor_turn_left?.toFixed(1) || '-';
    document.getElementById('motor_turn_r').textContent = 
        info.motor_turn_right?.toFixed(1) || '-';
    
    document.getElementById('current-path').textContent = 
        info.target_shelf === 0 ? '/root/documents' : '/root/projects';
}

async function pollState() {
    try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error('API error');
        
        const data = await response.json();
        currentState = data.world;
        
        updateFromState(currentState);
        updateMetrics(data);
        
        document.getElementById('status').textContent = 'Connected';
        document.getElementById('status').className = 'connected';
    } catch (error) {
        document.getElementById('status').textContent = 'Disconnected';
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
    controls.update();
    renderer.render(scene, camera);
}

// Initialize and start
initScene();
setInterval(pollState, UPDATE_INTERVAL);
pollState(); // Initial fetch
