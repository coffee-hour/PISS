import * as THREE from 'three';

/**
 * SOVEREIGN v5.6.1: 'CLEAN SLATE REVERT'
 * 1. Engine: Full Three.js 3D Engine restored.
 * 2. Spawn Logic: Cleaned to exactly 1 Omni-Man entity. No swarms.
 * 3. Stability: Maintained Vertex Proxy for Omni-Man to prevent GPU crashes.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    
    let state = {
        initialized: false,
        player: { hp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0
    };

    let omni = null;

    const createProxy = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        const container = document.getElementById('game-container');

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 500, 4000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 50, 150);

        renderer = new THREE.WebGLRenderer({ antialias: false, precision: 'lowp' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(1.0);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(200, 500, 200);
        scene.add(sun);

        // Ground & Grid
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);
        scene.add(new THREE.GridHelper(6000, 20, 0x333333, 0x333333));

        // Spawn Single Omni-Man
        omni = new THREE.Group();
        omni.add(createProxy(4, 8, 2, 0xffffff)); // Body
        omni.add(createProxy(1.5, 0.4, 0.4, 0x222222).set({position: new THREE.Vector3(0, 3, 1.1)})); // Mustache
        omni.add(createProxy(4.2, 8, 0.2, 0xb71c1c).set({position: new THREE.Vector3(0, 0, -1.1)})); // Cape
        omni.position.set(0, 20, -100);
        scene.add(omni);
        omni.userData = { origin: omni.position.clone(), hp: 1000, anim: 0 };

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => { 
            const k = e.key.toLowerCase();
            if(state.keys.hasOwnProperty(k)) state.keys[k] = true;
            if(e.code === 'Space') state.keys[' '] = true;
            if(e.code === 'ControlLeft') state.keys.control = true;
        });
        document.addEventListener('keyup', (e) => { 
            const k = e.key.toLowerCase();
            if(state.keys.hasOwnProperty(k)) state.keys[k] = false;
            if(e.code === 'Space') state.keys[' '] = false;
            if(e.code === 'ControlLeft') state.keys.control = false;
        });
        document.addEventListener('mousedown', () => { if(!state.isLocked) document.body.requestPointerLock(); });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw -= e.movementX * 0.003; state.pitch -= e.movementY * 0.003;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const onWindowResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.1);

        if(state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * dt * 60));
            if(state.keys[' ']) camera.position.y += state.player.flightSpeed * dt * 60;
            if(state.keys.control) camera.position.y -= state.player.flightSpeed * dt * 60;
            camera.position.y = Math.max(5, camera.position.y);
        }

        if(omni) {
            omni.userData.anim += dt;
            const dist = camera.position.distanceTo(omni.position);
            if(dist < 600) {
                const toP = camera.position.clone().sub(omni.position);
                if(toP.length() > 15) omni.position.add(toP.normalize().multiplyScalar(4 * dt * 60));
                omni.lookAt(camera.position);
            } else {
                omni.position.y = omni.userData.origin.y + Math.sin(omni.userData.anim * 1.5) * 4;
            }
        }

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
