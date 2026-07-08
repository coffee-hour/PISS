import * as THREE from 'three';

/**
 * SOVEREIGN v5.8.2: 'RAW CORE'
 * 1. UI Stripping: Removed all DOM UI elements (Amber HUD, Minimap, Bars).
 * 2. Root Focus: WebGL canvas is the sole focus to isolate rendering failure.
 * 3. 3D World: Maintained full world geometry, 10k terrain, and obsidian barriers.
 * 4. Rigs: Maintained Omni-Man, Conquest, and Player rig in unlit-proxy format.
 * 5. Lighting: Ambient + Directional array.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { speed: 2.8, height: 15.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false },
        isLocked: false,
        pitch: 0, yaw: 0
    };

    let bosses = [];

    const createBeveledBox = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: false }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing v5.8.2 Raw Core...');
        
        // 1. SCENE
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 5000);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(100, 300, 100);
        scene.add(sunLight);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, state.player.height, 100);

        // 2. RENDERER (SOLE ROOT ELEMENT)
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100vw';
        renderer.domElement.style.height = '100vh';
        renderer.domElement.style.zIndex = '0';
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 3. WORLD DATA
        createWorld();
        spawnBoss('Omni-Man', 0xffffff, new THREE.Vector3(0, 150, 0));
        spawnBoss('Conquest', 0xdddddd, new THREE.Vector3(800, 150, 800));

        setupInput();
        window.addEventListener('resize', onWindowResize, false);
        
        // FORCED RESIZE DEFER
        setTimeout(() => onWindowResize(), 100);

        animate();
    };

    const createWorld = () => {
        // 10,000 unit terrain
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Obsidian Barriers
        const wallMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const wallGeo = new THREE.BoxGeometry(10000, 200, 20);
        for(let i=0; i<4; i++) {
            const w = new THREE.Mesh(wallGeo, wallMat);
            const angle = (i * Math.PI) / 2;
            w.position.set(Math.cos(angle)*5000, 100, Math.sin(angle)*5000);
            w.rotation.y = -angle;
            scene.add(w);
        }

        // City Geometry
        for (let i = 0; i < 400; i++) {
            const h = 100 + Math.random() * 600;
            const b = createBeveledBox(80, h, 80, 0xcccccc);
            b.position.set((Math.random()-0.5)*8000, h/2, (Math.random()-0.5)*8000);
            scene.add(b);
        }
    };

    const spawnBoss = (name, color, pos) => {
        const omni = new THREE.Group();
        const skin = 0xffdbac; const red = 0xb71c1c;
        omni.add(createBeveledBox(1.5, 1.5, 1.5, skin).set({position: new THREE.Vector3(0, 7.5, 0)}));
        const torso = createBeveledBox(3, 3.5, 1.5, color); torso.position.y = 5.0; omni.add(torso);
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.62, 0.1, red);
            seg.position.set(0, 7.5 - (i * 0.6), -0.9); omni.add(seg);
        }
        omni.position.copy(pos);
        scene.add(omni);
        bosses.push({ mesh: omni, vel: new THREE.Vector3() });
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
            if(e.shiftKey) state.keys.shift = true;
        });
        document.addEventListener('keyup', (e) => {
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
            if(!e.shiftKey) state.keys.shift = false;
        });
        document.addEventListener('mousedown', () => {
            if(!state.isLocked) document.body.requestPointerLock();
        });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw -= e.movementX * 0.0025; state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        if(state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * (state.keys.shift ? 5 : 1) * dt * 60));
        }

        bosses.forEach(b => {
            b.mesh.lookAt(camera.position);
            const tDir = camera.position.clone().sub(b.mesh.position).normalize();
            b.vel.lerp(tDir.multiplyScalar(0.2), 0.04);
            b.mesh.position.add(b.vel);
        });

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
