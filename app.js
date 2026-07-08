import * as THREE from 'three';

/**
 * Sovereign AAA (v4.7.3)
 * Features: 3D Omni-Man Boss, 3D Invincible Gauntlets, Red Gore,
 * Amber Core Aesthetic, 1-NPC Limit, Expanded Combat Radius.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, strength: 1, 
            punchRange: 12, isFlying: false, height: 2.8
        },
        run: { kills: 0, active: true },
        timeDilation: 0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false },
        lastArmUsed: 'right',
        isLocked: false
    };

    let currentEnemy = null;
    let buildings = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d0d0d);
        scene.fog = new THREE.Fog(0x0d0d0d, 120, 750);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xff8c00, 0.6);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.4);
        sunLight.position.set(300, 600, 300);
        scene.add(sunLight);

        createAmberCity();
        setupControls();
        
        // v4.7.3: Spawn Omni-Man 3D
        spawnOmniMan();

        animate();
    };

    const createAmberCity = () => {
        const floorGeo = new THREE.PlaneGeometry(6000, 6000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        let seed = 999;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 400; i++) {
            const h = 60 + random() * 120;
            const w = 30 + random() * 40;
            const d = 30 + random() * 40;
            const x = (random() - 0.5) * 2000;
            const z = (random() - 0.5) * 2000;
            if (Math.abs(x) < 80 && Math.abs(z) < 80) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.5 }));
            line.scale.set(w, h, d);
            line.position.copy(b.position);
            scene.add(line);
        }
    };

    const setupControls = () => {
        window.addEventListener('keydown', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
            if (key === 'f') state.player.isFlying = !state.player.isFlying;
        });
        window.addEventListener('keyup', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = false; 
        });
        window.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else if (state.run.active) performStrike();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        window.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                camera.rotation.y -= e.movementX * 0.002;
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
            }
        });
    };

    const spawnOmniMan = () => {
        if (currentEnemy) return;

        // v4.7.3: 3D OMNI-MAN MODEL (Amber Core Palette)
        const omni = new THREE.Group();
        
        // Head (with hair/mustache cues)
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        head.position.y = 8.5;
        omni.add(head);
        
        // Hair (Gray/Black mix)
        const hair = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        hair.position.y = 9.2;
        omni.add(hair);

        // Mustache (Iconic cue)
        const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        mustache.position.set(0, 8.2, 0.95);
        omni.add(mustache);

        // Torso (White/Red Viltrumite suit)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 4.5, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        torso.position.y = 5.2;
        omni.add(torso);

        // Cape (Red - Amber Glow)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6, 0.1), new THREE.MeshStandardMaterial({ color: 0xb71c1c }));
        cape.position.set(0, 5, -0.65);
        omni.add(cape);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.6, 4, 0.6);
        const lArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
        lArm.position.set(-1.4, 5.5, 0);
        omni.add(lArm);

        const rArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xffffff }));
        rArm.position.set(1.4, 5.5, 0);
        omni.add(rArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.7, 4.5, 0.7);
        const lLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0xb71c1c }));
        lLeg.position.set(-0.6, 2.2, 0);
        omni.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0xb71c1c }));
        rLeg.position.set(0.6, 2.2, 0);
        omni.add(rLeg);

        omni.position.set((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200);
        scene.add(omni);

        currentEnemy = { mesh: omni, hp: 5000, maxHp: 5000, name: 'OMNI-MAN' };
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        animate3DFist(state.lastArmUsed);
        
        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dirToEnemy = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const dot = dirToEnemy.dot(forward);

            if (dist <= state.player.punchRange && dot > 0.65) {
                hitEnemy();
            }
        }
    };

    const hitEnemy = () => {
        currentEnemy.hp -= 250;
        spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
        updateBossUI();
        
        if (currentEnemy.hp <= 0) {
            scene.remove(currentEnemy.mesh);
            currentEnemy = null;
            state.run.kills++;
            setTimeout(spawnOmniMan, 1000);
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.SphereGeometry(0.4, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x990000 });
        for (let i = 0; i < 50; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { 
                vel: new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2), 
                life: 1.0 
            };
            scene.add(p); 
            bloodParticles.push(p);
        }
    };

    const animate3DFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if (fist) {
            fist.style.transform = `translateY(-240px) scale(1.3) rotate(${side === 'left' ? 28 : -28}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const updateBossUI = () => {
        const hpBar = document.getElementById('boss-hp-fill');
        if (hpBar && currentEnemy) {
            hpBar.style.width = `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%`;
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        if (moving) {
            state.timeDilation = state.keys[' '] ? 0.12 : 1.0; 
            const speed = (state.keys[' '] ? 3.4 : 1.0);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            
            if (state.player.isFlying) camera.position.y = Math.min(500, camera.position.y + 1.2);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.4);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            
            if (dist < 500 && dist > 10) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.25 * dt));
                // Hovering
                currentEnemy.mesh.position.y = 5 + Math.sin(Date.now() * 0.003) * 2;
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.02 * dt; 
            p.userData.life -= 0.02 * dt;
            p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { 
                scene.remove(p); 
                bloodParticles.splice(i, 1); 
            }
        });

        document.getElementById('kills').innerText = state.run.kills;
        renderer.render(scene, camera);
    };

    return { init };
})();

window.Fighter = Fighter;
Fighter.init();
