// 3D scene for fly-assistant visualization
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene state
let scene, camera, renderer, controls;
let flyMesh, leftShelf, rightShelf, objectMesh;
let currentState = null;

// Update rate
const UPDATE_INTERVAL = 100; // ms

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
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
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
    
    // Create shelves
    createShelves();
    
    // Create fly
    createFly();
    
    // Create object
    createObject();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
}

function createShelves() {
    // Left shelf at (-5, 0, 10)
    const shelfGeometry = new THREE.BoxGeometry(2, 0.2, 2);
    const leftMaterial = new THREE.MeshStandardMaterial({
        color: 0x3366ff,
        roughness: 0.5,
        metalness: 0.3
    });
    leftShelf = new THREE.Mesh(shelfGeometry, leftMaterial);
    leftShelf.position.set(-5, 0.1, 10);
    leftShelf.castShadow = true;
    leftShelf.receiveShadow = true;
    scene.add(leftShelf);
    
    // Support pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const leftPole = new THREE.Mesh(poleGeometry, poleMaterial);
    leftPole.position.set(-5, -1.4, 10);
    leftPole.castShadow = true;
    scene.add(leftPole);
    
    // Right shelf at (5, 0, 10)
    const rightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff6633,
        roughness: 0.5,
        metalness: 0.3
    });
    rightShelf = new THREE.Mesh(shelfGeometry, rightMaterial);
    rightShelf.position.set(5, 0.1, 10);
    rightShelf.castShadow = true;
    rightShelf.receiveShadow = true;
    scene.add(rightShelf);
    
    const rightPole = new THREE.Mesh(poleGeometry, poleMaterial);
    rightPole.position.set(5, -1.4, 10);
    rightPole.castShadow = true;
    scene.add(rightPole);
}

function createFly() {
    // Simple fly representation: body + wings
    const flyGroup = new THREE.Group();
    
    // Body (ellipsoid)
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
    
    // Eyes (simple spheres)
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
    
    // Wings (simple planes)
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
    // Simple sphere for the object
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

function updateFromState(state) {
    if (!state || !state.fly) return;
    
    // Update fly position and orientation
    const fly = state.fly;
    flyMesh.position.set(fly.position[0], 0.5, fly.position[2]);
    flyMesh.rotation.y = -fly.yaw; // Negative because Three.js Y-up convention
    
    // Update object position
    if (state.object) {
        objectMesh.position.set(
            state.object.position[0],
            state.object.position[1] + 0.4, // Raise above shelf
            state.object.position[2]
        );
    }
    
    // Highlight target shelf
    if (state.target_shelf !== undefined) {
        const targetShelf = state.target_shelf === 0 ? leftShelf : rightShelf;
        const otherShelf = state.target_shelf === 0 ? rightShelf : leftShelf;
        
        // Emissive glow on target shelf
        targetShelf.material.emissive = new THREE.Color(0x224422);
        otherShelf.material.emissive = new THREE.Color(0x000000);
    }
}

function updateMetrics(info) {
    if (!info) return;
    
    document.getElementById('target').textContent = 
        info.target_shelf === 0 ? 'Left (Blue)' : 'Right (Orange)';
    document.getElementById('steps').textContent = info.steps || '-';
    document.getElementById('brain_activity').textContent = 
        info.brain_activity?.toLocaleString() || '-';
    document.getElementById('motor_fwd').textContent = 
        info.motor_forward?.toFixed(1) || '-';
    document.getElementById('motor_turn_l').textContent = 
        info.motor_turn_left?.toFixed(1) || '-';
    document.getElementById('motor_turn_r').textContent = 
        info.motor_turn_right?.toFixed(1) || '-';
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
