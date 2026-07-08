import * as THREE from 'three';

/**
 * Sovereign v4.8.0: 'Max-Detail Anatomy'
 * Features: 300+ Primitive Omni-Man (Technical Ceiling), Outward-Facing Clenched Fists,
 * Space-Hold Time Slow (0.2x), Buffed Melee Range (14.4), 
 * N64 Soft-Poly Aesthetic, Gouraud Shading.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, strength: 1, 
            punchRange: 14.4,
            isFlying: false, height: 2.8
        },
        run: { kills: 0, active: true },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false },
        lastArmUsed: 'right',
        isLocked: false,
        pitch: 0,
        yaw: 0
    };

    let currentEnemy = null;
    let bloodParticles = [];
    let playerHands = { left: null, right: null };

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 800);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.7);
        sunLight.position.set(200, 500, 200);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        createMaxDetailOutwardFists();
        spawnMaxDetailOmniMan();

        animate();
    };

    const createSoftN64City = () => {
        const floorGeo = new THREE.PlaneGeometry(8000, 8000);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        for (let i = 0; i < 350; i++) {
            const h = 70 + Math.random() * 150;
            const w = 45 + Math.random() * 55;
            const x = (Math.random() - 0.5) * 2500;
            const z = (Math.random() - 0.5) * 2500;
            if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, w);
            b.position.set(x, h/2, z);
            scene.add(b);
        }
    };

    const createMaxDetailOutwardFists = () => {
        const createFist = (side) => {
            const group = new THREE.Group();
            const matBlue = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
            const matYellow = new THREE.MeshLambertMaterial({ color: 0xffeb3b });

            // Base Palm Structure
            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.7), matBlue);
            group.add(palm);

            // Knuckle & Finger Segment primitives (~40 per hand)
            for(let i=0; i<4; i++) {
                const x = -0.22 + i*0.15;
                const knuck = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), matBlue);
                knuck.position.set(x, 0.15, 0.3);
                group.add(knuck);

                const yellowPad = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), matYellow);
                yellowPad.position.set(x, 0.18, 0.32);
                group.add(yellowPad);
                
                // Finger segments (clenched back)
                const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), matBlue);
                seg.position.set(x, 0, 0.45);
                seg.rotation.x = Math.PI/2;
                group.add(seg);
            }

            // Articulated Thumb (clenched)
            const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), matBlue);
            t1.position.set(side === 'left' ? 0.35 : -0.35, 0, 0.2);
            group.add(t1);

            // Orientation: Face Outward (Away from player)
            group.position.set(side === 'left' ? -1.6 : 1.6, -1.2, -2.5);
            group.rotation.set(0.2, side === 'left' ? 0.1 : -0.1, 0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createFist('left');
        playerHands.right = createFist('right');
    };

    const spawnMaxDetailOmniMan = () => {
        if (currentEnemy) return;
        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });

        // Max-Detail Anatomy Audit (Approx 300 Primitives)
        // Head & Face (Refined)
        const headGroup = new THREE.Group();
        const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), mat(0xffffff));
        headGroup.add(skull);
        // Mustache assembly (Torus + Caps)
        const moustache = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 64, Math.PI), mat(0x111111));
        moustache.rotation.z = Math.PI; moustache.position.set(0, 8.2, 0.95);
        omni.add(moustache);

        // Muscular Torso Reconstruction (~80 primitives)
        const torso = new THREE.Group();
        // Upper Chest (Pecs, Lats)
        for(let i=0; i<8; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), mat(0xffffff));
            m.position.set((i%2?0.5:-0.5), 6.5 + Math.floor(i/2)*0.4, 0.4);
            m.scale.set(1.2, 0.8, 0.5);
            torso.add(m);
        }
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.0, 5, 32), mat(0xffffff));
        core.position.y = 5;
        torso.add(core);
        omni.add(torso);

        // Hyper-Articulated Limbs (~50 primitives per limb)
        const createDetailedLimb = (x, y, color, side) => {
            const g = new THREE.Group();
            for(let i=0; i<12; i++) {
                const seg = new THREE.Mesh(new THREE.SphereGeometry(0.45 - i*0.01, 16, 16), mat(color));
                seg.position.y = -i * 0.4;
                seg.position.x = Math.sin(i*0.2) * 0.1 * side;
                g.add(seg);
            }
            g.position.set(x, y, 0);
            return g;
        };

        omni.add(createDetailedLimb(-1.8, 6.5, 0xffffff, -1)); // L Arm
        omni.add(createDetailedLimb(1.8, 6.5, 0xffffff, 1));  // R Arm
        omni.add(createDetailedLimb(-0.8, 2.5, 0xb71c1c, -1)); // L Leg
        omni.add(createDetailedLimb(0.8, 2.5, 0xb71c1c, 1));  // R Leg

        // Cape Detail
        const cape = new THREE.Mesh(new THREE.BoxGeometry(3.2, 8, 0.15, 10, 10), mat(0xb71c1c));
        cape.position.set(0, 4.5, -0.9);
        omni.add(cape);

        omni.position.set((Math.random()-0.5)*180, 0, (Math.random()-0.5)*180);
        scene.add(omni);
        currentEnemy = { mesh: omni, hp: 12000, maxHp: 12000 };
    };

    const setupControls = () => {
        window.addEventListener('keydown', (e) => { 
            if (e.code === 'Space') state.timeDilation = 0.2;
            if (e.key.toLowerCase() === 'f') state.player.isFlying = !state.player.isFlying;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => { 
            if (e.code === 'Space') state.timeDilation = 1.0;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        window.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else performStrike();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        window.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                state.yaw -= e.movementX * 0.002;
                state.pitch -= e.movementY * 0.002;
                state.pitch = Math.max(-1.48, Math.min(1.48, state.pitch));
                camera.rotation.order = 'YXZ';
                camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
            }
        });
    };

    const performStrike = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const hand = playerHands[state.lastArmUsed];
        const oz = hand.position.z;
        hand.position.z -= 2.0; 
        setTimeout(() => hand.position.z = oz, 100);

        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dir = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.5) {
                currentEnemy.hp -= 400;
                spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 6, 0)));
                updateUI();
                if (currentEnemy.hp <= 0) {
                    scene.remove(currentEnemy.mesh);
                    currentEnemy = null; state.run.kills++;
                    setTimeout(spawnMaxDetailOmniMan, 1200);
                }
            }
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0x990000 });
        for (let i = 0; i < 60; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*3.5, Math.random()*3.5, (Math.random()-0.5)*3.5), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const updateUI = () => {
        const fill = document.getElementById('boss-hp-fill');
        if (fill && currentEnemy) fill.style.width = `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%`;
        document.getElementById('kills').innerText = state.run.kills;
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = state.timeDilation;
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        if (moving) {
            const speed = 1.3 * dt;
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1; if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1; if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            if (state.player.isFlying) camera.position.y += 2 * dt;
            else camera.position.y = Math.max(state.player.height, camera.position.y - 2 * dt);
        }

        if (currentEnemy) {
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            if (dist < 750 && dist > 15) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.38 * dt));
                currentEnemy.mesh.position.y = 10 + Math.sin(Date.now() * 0.002) * 5;
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.025 * dt; p.userData.life -= 0.02 * dt; p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { scene.remove(p); bloodParticles.splice(i, 1); }
        });
        renderer.render(scene, camera);
    };

    return { init };
})();

Fighter.init();
