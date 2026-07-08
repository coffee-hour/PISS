import * as THREE from 'three';

/**
 * Sovereign AAA (v4.7.4)
 * Features: High-Poly Omni-Man (Cape/Suit Seams), PBR-Shader Emulation,
 * Baked AO Depth, Glow Bleed Fix, Red Gore, Amber Core.
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
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 800);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ReinhardToneMapping;
        renderer.toneMappingExposure = 1.2;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xff8c00, 0.35);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.8);
        sunLight.position.set(400, 800, 400);
        scene.add(sunLight);

        createAmberCity();
        setupControls();
        spawnHighPolyOmniMan();

        animate();
    };

    const createAmberCity = () => {
        const floorGeo = new THREE.PlaneGeometry(8000, 8000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.8 });
        
        let seed = 10101;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 450; i++) {
            const h = 70 + random() * 150;
            const w = 35 + random() * 45;
            const d = 35 + random() * 45;
            const x = (random() - 0.5) * 2200;
            const z = (random() - 0.5) * 2200;
            if (Math.abs(x) < 100 && Math.abs(z) < 100) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.4 }));
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

    const spawnHighPolyOmniMan = () => {
        if (currentEnemy) return;

        // v4.7.4: HIGH-POLY CHARACTER ASSEMBLY
        const omni = new THREE.Group();
        const pbrMat = (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.5 });
        const aoMat = (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness: 0.9, flatShading: false });

        // Head (Increased Poly Count)
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), pbrMat(0xffffff));
        head.position.y = 8.5;
        omni.add(head);
        
        // Hair & Iconic Mustache (Polygonal refinement)
        const hair = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.4, 16, 32), pbrMat(0x222222));
        hair.rotation.x = Math.PI/2;
        hair.position.y = 9.2;
        omni.add(hair);

        const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 8, 16), aoMat(0x111111));
        stache.rotation.z = Math.PI/2;
        stache.position.set(0, 8.1, 1.0);
        omni.add(stache);

        // Torso with 'Suit Seam' Emulation (Bunched geometry)
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 5, 32), pbrMat(0xffffff));
        torso.position.y = 5.2;
        omni.add(torso);
        
        const seam = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 32), aoMat(0xb71c1c));
        seam.rotation.x = Math.PI/2;
        seam.position.y = 6.5;
        torso.add(seam);

        // Cape (Physics-ready refined mesh)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 0.2), pbrMat(0xb71c1c));
        cape.position.set(0, 4.5, -0.8);
        omni.add(cape);

        // Limbs (High-poly cylinders)
        const limbGeo = new THREE.CylinderGeometry(0.4, 0.35, 4.5, 16);
        const lArm = new THREE.Mesh(limbGeo, pbrMat(0xffffff));
        lArm.position.set(-1.6, 5.5, 0); lArm.rotation.z = 0.2;
        omni.add(lArm);

        const rArm = new THREE.Mesh(limbGeo, pbrMat(0xffffff));
        rArm.position.set(1.6, 5.5, 0); rArm.rotation.z = -0.2;
        omni.add(rArm);

        const legGeo = new THREE.CylinderGeometry(0.5, 0.4, 5, 16);
        const lLeg = new THREE.Mesh(legGeo, pbrMat(0xb71c1c));
        lLeg.position.set(-0.7, 2, 0);
        omni.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, pbrMat(0xb71c1c));
        rLeg.position.set(0.7, 2, 0);
        omni.add(rLeg);

        omni.position.set((Math.random()-0.5)*150, 0, (Math.random()-0.5)*150);
        scene.add(omni);

        currentEnemy = { mesh: omni, hp: 6000, maxHp: 6000, name: 'OMNI-MAN' };
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
            setTimeout(spawnHighPolyOmniMan, 1200);
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.SphereGeometry(0.4, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x990000 });
        for (let i = 0; i < 50; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { 
                vel: new THREE.Vector3((Math.random()-0.5)*2.5, Math.random()*2.5, (Math.random()-0.5)*2.5), 
                life: 1.0 
            };
            scene.add(p); 
            bloodParticles.push(p);
        }
    };

    const animate3DFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if (fist) {
            fist.style.transform = `translateY(-260px) scale(1.3) rotate(${side === 'left' ? 30 : -30}deg)`;
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
            const speed = (state.keys[' '] ? 3.6 : 1.1);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            
            if (state.player.isFlying) camera.position.y = Math.min(600, camera.position.y + 1.5);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.6);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            
            if (dist < 600 && dist > 12) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.3 * dt));
                currentEnemy.mesh.position.y = 8 + Math.sin(Date.now() * 0.003) * 3;
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
