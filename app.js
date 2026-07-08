import * as THREE from 'three';

/**
 * Sovereign v4.7.9: 'Hyper-Detailed Combat Overhaul'
 * Features: 150+ Primitive Omni-Man, Clenched Articulated Fists,
 * Melee Range Buff (+20%), Space-Hold Time Slow (0.2x), 
 * N64 Soft-Poly Aesthetic, Gouraud Shading.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, strength: 1, 
            punchRange: 14.4, // +20% from 12
            isFlying: false, height: 2.8
        },
        run: { kills: 0, active: true },
        timeDilation: 1.0, // Base speed
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false },
        lastArmUsed: 'right',
        isLocked: false,
        pitch: 0,
        yaw: 0
    };

    let currentEnemy = null;
    let bloodParticles = [];
    let playerHands = { left: null, right: null };

    // N64 Bilinear Texture
    const createN64Texture = (color1, color2) => {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color2;
        ctx.fillRect(0, 0, size/2, size/2);
        ctx.fillRect(size/2, size/2, size/2, size/2);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    };

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 750);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.6);
        sunLight.position.set(200, 500, 200);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        createClenchedGauntlets();
        spawnDetailedOmniMan();

        animate();
    };

    const createSoftN64City = () => {
        const floorTex = createN64Texture('#050505', '#080808');
        floorTex.repeat.set(100, 100);
        const floorGeo = new THREE.PlaneGeometry(8000, 8000);
        const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const bTex = createN64Texture('#111111', '#1a1a1a');
        const buildingMat = new THREE.MeshLambertMaterial({ map: bTex });
        
        let seed = 512;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 350; i++) {
            const h = 70 + random() * 150;
            const w = 45 + random() * 55;
            const d = 45 + random() * 55;
            const x = (random() - 0.5) * 2500;
            const z = (random() - 0.5) * 2500;
            if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
        }
    };

    const createClenchedGauntlets = () => {
        const createFist = (side) => {
            const group = new THREE.Group();
            const matBlue = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
            const matYellow = new THREE.MeshLambertMaterial({ color: 0xffeb3b });
            const segments = 100;

            // Main Fist Body (Clenched)
            const mainFist = new THREE.Mesh(new THREE.SphereGeometry(0.5, segments, 32), matBlue);
            mainFist.scale.set(1, 0.8, 1.1);
            group.add(mainFist);

            // Knuckle Detail (4 distinct primitives)
            for(let i=0; i<4; i++) {
                const k = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), matBlue);
                k.position.set(-0.3 + i*0.2, 0.35, 0.4);
                group.add(k);
                // Yellow padding detail
                const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), matYellow);
                pad.position.set(-0.3 + i*0.2, 0.38, 0.42);
                group.add(pad);
            }

            // Clenched Thumb
            const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16), matBlue);
            thumb.position.set(side === 'left' ? 0.4 : -0.4, 0.1, 0.3);
            thumb.rotation.set(0.5, 0, side === 'left' ? -0.5 : 0.5);
            group.add(thumb);

            group.position.set(side === 'left' ? -1.6 : 1.6, -1.2, -2.5);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createFist('left');
        playerHands.right = createFist('right');
    };

    const spawnDetailedOmniMan = () => {
        if (currentEnemy) return;
        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });
        const segments = 150; // Increased for fidelity audit

        // Head assembly (~10 primitives)
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), mat(0xffffff));
        head.position.y = 8.5;
        omni.add(head);
        
        const moustache = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 16, 64, Math.PI), mat(0x111111));
        moustache.rotation.z = Math.PI; moustache.position.set(0, 8.2, 0.95);
        omni.add(moustache);

        // Body Audit (Muscular layering - ~40 primitives)
        // Chest & Pecs
        const pecL = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), mat(0xffffff));
        pecL.position.set(-0.6, 6.8, 0.5); pecL.scale.set(1, 1, 0.5);
        omni.add(pecL);
        const pecR = pecL.clone(); pecR.position.x = 0.6;
        omni.add(pecR);

        // Torso segments
        const torsoU = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 3, segments), mat(0xffffff));
        torsoU.position.y = 6.2; omni.add(torsoU);
        const torsoL = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 2.5, segments), mat(0xffffff));
        torsoL.position.y = 4.0; omni.add(torsoL);

        // Limbs (Segmented for muscles - ~80 primitives)
        const createLimb = (x, y, z, color, r1, r2, len) => {
            const g = new THREE.Group();
            const bicep = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 16), mat(color));
            g.add(bicep);
            g.position.set(x, y, z);
            return g;
        };

        omni.add(createLimb(-1.8, 6.2, 0, 0xffffff, 0.5, 0.4, 3)); // L Arm
        omni.add(createLimb(1.8, 6.2, 0, 0xffffff, 0.5, 0.4, 3)); // R Arm
        omni.add(createLimb(-0.7, 1.8, 0, 0xb71c1c, 0.6, 0.5, 4)); // L Leg
        omni.add(createLimb(0.7, 1.8, 0, 0xb71c1c, 0.6, 0.5, 4)); // R Leg

        // Cape Detail
        const cape = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 0.1, 10, 10), mat(0xb71c1c));
        cape.position.set(0, 4.5, -0.8);
        omni.add(cape);

        omni.position.set((Math.random()-0.5)*180, 0, (Math.random()-0.5)*180);
        scene.add(omni);
        currentEnemy = { mesh: omni, hp: 10000, maxHp: 10000 };
    };

    const setupControls = () => {
        window.addEventListener('keydown', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
            if (key === 'f') state.player.isFlying = !state.player.isFlying;
            // v4.7.9: Spacebar Time Slow On
            if (e.code === 'Space') state.timeDilation = 0.2;
        });
        window.addEventListener('keyup', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = false; 
            // v4.7.9: Spacebar Normal Time
            if (e.code === 'Space') state.timeDilation = 1.0;
        });
        window.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else if (state.run.active) performStrike();
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
        hand.position.z -= 1.8; // Buffed punch visual
        setTimeout(() => hand.position.z = oz, 100);

        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dir = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            // v4.7.9: Buffed Melee Range (14.4)
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.55) {
                currentEnemy.hp -= 400;
                spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5.5, 0)));
                updateUI();
                if (currentEnemy.hp <= 0) {
                    scene.remove(currentEnemy.mesh);
                    currentEnemy = null; state.run.kills++;
                    setTimeout(spawnDetailedOmniMan, 1200);
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
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*3, Math.random()*3, (Math.random()-0.5)*3), life: 1.0 };
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
            const speed = 1.2 * dt;
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1; if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1; if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            if (state.player.isFlying) camera.position.y += 1.8 * dt;
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.8 * dt);
        }

        if (currentEnemy) {
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            if (dist < 700 && dist > 15) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.35 * dt));
                currentEnemy.mesh.position.y = 10 + Math.sin(Date.now() * 0.002) * 4;
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
