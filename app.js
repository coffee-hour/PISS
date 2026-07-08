import * as THREE from 'three';

/**
 * SOVEREIGN v5.8.2: 'SCENE ISOLATION'
 * 1. UI Stripping: Removed Minimap, Amber HUD, and all 2D overlays to isolate WebGL buffer.
 * 2. Scene-Graph: Re-enabled the full Open World (Omni-Man, Conquest, Civilians, World).
 * 3. Mounting: Retained the #game-container and SYSTEM_ONLINE diagnostic tag.
 * 4. Purpose: Determine if the 2D UI layers were occluding or crashing the WebGL context.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, punchRange: 5.5, speed: 2.8, height: 15.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false },
        isLocked: false,
        pitch: 0, yaw: 0
    };

    let bosses = [];
    let civilians = [];
    let playerHands = { left: null, right: null };

    const createBeveledBox = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: false }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing v5.8.2 Scene Isolation...');
        
        let container = document.getElementById('game-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'game-container';
            container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; background:#000; overflow:hidden;';
            document.body.appendChild(container);
        }

        // Keep diagnostic tag for verification
        const diag = document.createElement('div');
        diag.style = 'position:fixed; bottom:10px; right:10px; color:#ffbf00; font-family:monospace; font-size:10px; z-index:10000; pointer-events:none;';
        diag.innerText = 'SYSTEM_ONLINE // v5.8.2 // UI_STRIPPED';
        document.body.appendChild(diag);

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

        // 2. RENDERER
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 3. OBJECTS
        createWorld();
        createBeveledHands();
        spawnBoss('Omni-Man', 0xffffff, new THREE.Vector3(0, 0, 0));
        spawnBoss('Conquest', 0xdddddd, new THREE.Vector3(800, 0, 800));
        spawnCivilians(40);

        setupInput();
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        animate();
    };

    const createWorld = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);
        for (let i = 0; i < 400; i++) {
            const h = 100 + Math.random() * 600;
            const b = createBeveledBox(80, h, 80, 0xcccccc);
            b.position.set((Math.random()-0.5)*8000, h/2, (Math.random()-0.5)*8000);
            scene.add(b);
        }
    };

    const spawnCivilians = (count) => {
        for(let i=0; i<count; i++) {
            const civ = new THREE.Group();
            civ.add(createBeveledBox(2, 4, 1, 0x4caf50));
            civ.position.set((Math.random()-0.5)*8000, 2, (Math.random()-0.5)*8000);
            scene.add(civ);
            civilians.push({ mesh: civ, vel: new THREE.Vector3((Math.random()-0.5)*0.5, 0, (Math.random()-0.5)*0.5) });
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
        omni.position.copy(pos).add(new THREE.Vector3(0, 150, 0));
        scene.add(omni);
        bosses.push({ mesh: omni, vel: new THREE.Vector3(), targetPos: pos.clone() });
    };

    const createBeveledHands = () => {
        const createHand = (side) => {
            const group = new THREE.Group();
            group.add(createBeveledBox(0.8, 0.8, 1.2, 0x1e88e5));
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if(!state.isLocked) document.body.requestPointerLock();
        });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw = (state.yaw || 0) - e.movementX * 0.0025;
                state.pitch = (state.pitch || 0) - e.movementY * 0.0025;
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
            camera.position.add(dir.multiplyScalar(state.player.speed * dt * 60));
        }

        bosses.forEach(b => {
            if(b.mesh.position.distanceTo(b.targetPos) < 10) {
                b.targetPos.set((Math.random()-0.5)*300, 150, (Math.random()-0.5)*300);
            }
            const tDir = b.targetPos.clone().sub(b.mesh.position).normalize();
            b.mesh.lookAt(b.targetPos);
            b.vel.lerp(tDir.multiplyScalar(0.15), 0.02);
            b.mesh.position.add(b.vel);
        });

        civilians.forEach(c => {
            c.mesh.position.add(c.vel);
            if(Math.abs(c.mesh.position.x) > 4500 || Math.abs(c.mesh.position.z) > 4500) c.vel.multiplyScalar(-1);
        });

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
