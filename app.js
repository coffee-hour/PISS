import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.0: 'INVINCIBLE INITIAL'
 * 1. Origin: The first 3D Three.js "Invincible" fighter iteration.
 * 2. World: 2000-unit square arena, clear blue sky, grey ground.
 * 3. Combat: Basic melee punch logic (Left Click) and movement.
 * 4. Rig: Initial R6 block-man rig for Omni-Man.
 * 5. Lighting: High-contrast Directional light.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, speed: 3.0, height: 10.0 },
        keys: { w: false, a: false, s: false, d: false },
        isLocked: false,
        pitch: 0,
        yaw: 0
    };

    let boss = null;

    const init = () => {
        console.log('Sovereign: Restoring v5.4.0 Invincible Initial...');
        
        // CLEANUP
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud')) div.remove(); });

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 50);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(50, 100, 50);
        scene.add(sunLight);

        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x888888 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Simple City Blocks
        for (let i = 0; i < 50; i++) {
            const h = 50 + Math.random() * 200;
            const b = new THREE.Mesh(new THREE.BoxGeometry(40, h, 40), new THREE.MeshLambertMaterial({ color: 0x555555 }));
            b.position.set((Math.random()-0.5)*1500, h/2, (Math.random()-0.5)*1500);
            scene.add(b);
        }

        spawnInitialOmniMan();
        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const spawnInitialOmniMan = () => {
        const group = new THREE.Group();
        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ color: 0xffdbac }));
        head.position.y = 8;
        group.add(head);
        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        torso.position.y = 4.5;
        group.add(torso);
        // Cape
        const cape = new THREE.Mesh(new THREE.BoxGeometry(4.2, 6, 0.2), new THREE.MeshLambertMaterial({ color: 0xb71c1c }));
        cape.position.set(0, 4.5, -1.1);
        group.add(cape);

        group.position.set(0, 0, -50);
        scene.add(group);
        boss = { mesh: group, hp: 100 };
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
            else if(boss && camera.position.distanceTo(boss.mesh.position) < 10) {
                console.log('HIT');
                boss.mesh.position.z -= 2;
            }
        });
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
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
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
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
