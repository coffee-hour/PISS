import * as THREE from 'three';

/**
 * Sovereign v4.8.3: 'Fist Rotation Update'
 * Features: Back-of-Hand First-Person Orientation, 600+ Primitive Omni-Man,
 * Spacebar Time Slow (0.2x), 14.4-unit Range, N64 Soft-Poly Aesthetic.
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
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 900);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.9);
        sunLight.position.set(300, 800, 300);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        createBackOfHandFists();
        spawnFighterCloneOmniMan();

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
            const h = 80 + Math.random() * 200;
            const w = 50 + Math.random() * 70;
            const x = (Math.random() - 0.5) * 2500;
            const z = (Math.random() - 0.5) * 2500;
            if (Math.abs(x) < 200 && Math.abs(z) < 200) continue;
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, w);
            b.position.set(x, h/2, z);
            scene.add(b);
        }
    };

    const createBackOfHandFists = () => {
        const createFist = (side) => {
            const group = new THREE.Group();
            const matBlue = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
            const matYellow = new THREE.MeshLambertMaterial({ color: 0xffeb3b });

            // Core Fist Mesh
            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.8), matBlue);
            group.add(palm);

            // Knuckles pointed FORWARD (Z-axis)
            for(let i=0; i<4; i++) {
                const x = -0.25 + i * 0.17;
                const knuck = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), matBlue);
                knuck.position.set(x, 0.1, 0.4); // Knuckles at the front
                group.add(knuck);

                const yellowPad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matYellow);
                yellowPad.position.set(x, 0.12, 0.45);
                group.add(yellowPad);
                
                // Finger segments curled AWAY/DOWN
                const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 8), matBlue);
                finger.position.set(x, -0.15, 0.35);
                finger.rotation.x = -Math.PI/4;
                group.add(finger);
            }

            // Clenched Thumb
            const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 8, 8), matBlue);
            thumb.position.set(side === 'left' ? 0.4 : -0.4, -0.05, 0.2);
            thumb.rotation.set(0.1, 0, side === 'left' ? -1.0 : 1.0);
            group.add(thumb);

            // Orientation: Back of hand faces camera, knuckles forward
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.3, -3.0);
            group.rotation.set(-0.3, 0, 0); // Slight downward tilt to show back of hand
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createFist('left');
        playerHands.right = createFist('right');
    };

    const spawnFighterCloneOmniMan = () => {
        if (currentEnemy) return;
        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });

        // Head assembly
        const head = new THREE.Group();
        const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), mat(0xffffff));
        skull.position.y = 8.5;
        head.add(skull);

        for(let i=0; i<2; i++) {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), mat(0xffffff));
            cheek.position.set(i === 0 ? 0.7 : -0.7, 8.4, 0.6);
            cheek.rotation.y = i === 0 ? 0.5 : -0.5;
            head.add(cheek);
        }

        const stache = new THREE.Group();
        for(let i=0; i<15; i++) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(0x111111));
            const angle = (i/14) * Math.PI;
            s.position.set(Math.cos(angle)*0.6, 8.2 - Math.abs(Math.sin(angle))*0.15, 0.95);
            stache.add(s);
        }
        head.add(stache);
        omni.add(head);

        // Torso
        const torso = new THREE.Group();
        const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.1), mat(0xeeeeee));
        sternum.position.set(0, 6, 0.7);
        torso.add(sternum);

        for(let i=0; i<12; i++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), mat(0xffffff));
            m.position.set((i%2?0.6:-0.6), 6.6 + Math.floor(i/2)*0.35, 0.5);
            m.scale.set(1.15, 0.85, 0.45);
            torso.add(m);
        }
        for(let i=0; i<10; i++) {
            const ab = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), mat(0xffffff));
            ab.position.set((i%2?0.35:-0.35), 5.2 - Math.floor(i/2)*0.5, 0.65);
            ab.scale.set(1, 0.7, 0.5);
            torso.add(ab);
        }
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.15, 5.5, 64), mat(0xffffff));
        core.position.y = 5.2;
        torso.add(core);
        omni.add(torso);

        // Limbs
        const createLimbClone = (x, y, color, side) => {
            const g = new THREE.Group();
            for(let i=0; i<35; i++) {
                const seg = new THREE.Mesh(new THREE.SphereGeometry(0.5 - i*0.012, 12, 12), mat(color));
                seg.position.y = -i * 0.2;
                seg.position.x = Math.sin(i*0.22) * 0.18 * side;
                seg.scale.set(1.1, 1, 0.9);
                g.add(seg);
            }
            g.position.set(x, y, 0);
            return g;
        };

        omni.add(createLimbClone(-2.0, 6.8, 0xffffff, -1)); // L Arm
        omni.add(createLimbClone(2.0, 6.8, 0xffffff, 1));  // R Arm
        omni.add(createLimbClone(-0.9, 2.8, 0xb71c1c, -1)); // L Leg
        omni.add(createLimbClone(0.9, 2.8, 0xb71c1c, 1));  // R Leg

        const cape = new THREE.Group();
        for(let i=0; i<8; i++) {
            const flap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.1), mat(0xb71c1c));
            flap.position.set(-1.75 + i*0.5, 4.5, -1.0 - Math.sin(i*0.5)*0.2);
            flap.rotation.y = Math.sin(i*0.4)*0.3;
            cape.add(flap);
        }
        omni.add(cape);

        omni.position.set((Math.random()-0.5)*180, 0, (Math.random()-0.5)*180);
        scene.add(omni);
        currentEnemy = { mesh: omni, hp: 20000, maxHp: 20000 };
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
        hand.position.z -= 2.6;
        setTimeout(() => hand.position.z = oz, 100);

        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dir = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.45) {
                currentEnemy.hp -= 600;
                spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 6.8, 0)));
                updateUI();
                if (currentEnemy.hp <= 0) {
                    scene.remove(currentEnemy.mesh);
                    currentEnemy = null; state.run.kills++;
                    setTimeout(spawnFighterCloneOmniMan, 1200);
                }
            }
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 75; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*4.5, Math.random()*4.5, (Math.random()-0.5)*4.5), life: 1.0 };
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
            const speed = 1.4 * dt;
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1; if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1; if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            if (state.player.isFlying) camera.position.y += 2.2 * dt;
            else camera.position.y = Math.max(state.player.height, camera.position.y - 2.2 * dt);
        }

        if (currentEnemy) {
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            if (dist < 850 && dist > 15) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.42 * dt));
                currentEnemy.mesh.position.y = 14 + Math.sin(Date.now() * 0.002) * 6;
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.03 * dt; p.userData.life -= 0.02 * dt; p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { scene.remove(p); bloodParticles.splice(i, 1); }
        });
        renderer.render(scene, camera);
    };

    return { init };
})();

Fighter.init();
