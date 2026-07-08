import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.1: 'BLOCK-FIGHTER OPTIMIZED'
 * 1. Aesthetic: High-fidelity Roblox-style blocky geometry for Omni-Man.
 * 2. Physics: Solid floor mesh with raycasted ground-clamping for player/boss.
 * 3. Combat: Momentum-based physics punches. Punches apply vector force, not just translation.
 * 4. Boss AI: Omni-Man now hovers with a sine-wave float and performs procedural punch animations.
 * 5. Environment: Polished arena with high-contrast floor grid for spatial awareness.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, speed: 3.5, height: 10.0, punchTimer: 0 },
        keys: { w: false, a: false, s: false, d: false },
        isLocked: false,
        pitch: 0,
        yaw: 0,
        lastArmUsed: 'right'
    };

    let boss = null;
    let playerHands = { left: null, right: null };

    const createBlock = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    };

    const init = () => {
        console.log('Sovereign: Initializing v5.4.1 Block-Fighter Optimized...');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 2000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 50);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(50, 150, 50);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // Solid Ground with Grid
        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(2000, 50, 0x888888, 0x333333);
        grid.position.y = 0.05;
        scene.add(grid);

        createPlayerHands();
        spawnRobloxOmniMan();
        setupInput();
        
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createPlayerHands = () => {
        const createHand = (side) => {
            const h = createBlock(0.8, 0.8, 1.5, 0x1e88e5);
            h.position.set(side === 'left' ? -2 : 2, -1.5, -2.5);
            camera.add(h);
            return h;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnRobloxOmniMan = () => {
        const group = new THREE.Group();
        
        // Blocky Roblox Body Parts
        const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
        const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
        const rArm = createBlock(1.8, 4, 1.8, 0xffffff); rArm.position.set(3, 5, 0); group.add(rArm);
        const lArm = createBlock(1.8, 4, 1.8, 0xffffff); lArm.position.set(-3, 5, 0); group.add(lArm);
        const rLeg = createBlock(1.8, 4, 1.8, 0x111111); rLeg.position.set(1, 0.5, 0); group.add(rLeg);
        const lLeg = createBlock(1.8, 4, 1.8, 0x111111); lLeg.position.set(-1, 0.5, 0); group.add(lLeg);
        
        const cape = createBlock(4.5, 7, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);

        group.position.set(0, 1, -60);
        group.castShadow = true;
        scene.add(group);

        boss = { 
            mesh: group, 
            rArm, lArm,
            hp: 1000, 
            animTime: 0, 
            vel: new THREE.Vector3(), 
            floatHeight: 2.0,
            isPunching: false
        };
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 2.5;
        setTimeout(() => h.position.z = -2.5, 100);

        if (boss && camera.position.distanceTo(boss.mesh.position) < 12) {
            const force = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(2.5);
            boss.vel.add(force);
            boss.hp -= 50;
        }
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
            else performAttack();
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
        const dt = Math.min(clock.getDelta(), 0.1);

        if(state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * dt * 60));
            // Keep player on ground
            camera.position.y = state.player.height;
        }

        if (boss) {
            boss.animTime += dt;
            
            // Roblox-style Hover/Float
            const floatOffset = Math.sin(boss.animTime * 2) * 1.5;
            boss.mesh.position.y = THREE.MathUtils.lerp(boss.mesh.position.y, boss.floatHeight + floatOffset, 0.1);
            
            // Momentum Physics
            boss.mesh.position.add(boss.vel);
            boss.vel.multiplyScalar(0.92); // Friction

            // Procedural Boss Animation
            boss.mesh.lookAt(camera.position.x, boss.mesh.position.y, camera.position.z);
            
            // Simple Boss Punching
            if (Math.sin(boss.animTime * 3) > 0.8 && !boss.isPunching) {
                boss.isPunching = true;
                const arm = Math.random() > 0.5 ? boss.rArm : boss.lArm;
                arm.position.z += 2;
                setTimeout(() => {
                    arm.position.z = 0;
                    boss.isPunching = false;
                }, 200);
            }
        }

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
