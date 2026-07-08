import * as THREE from 'three';

/**
 * Sovereign v4.7.6: 'N64 Nostalgia Fidelity'
 * Features: N64-Authentic Low-Poly Models, Vertex Lighting (Lambert), 
 * True Vertical Pitch Control, 1-NPC Boss Encounter, Red Gore.
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
        isLocked: false,
        pitch: 0,
        yaw: 0
    };

    let currentEnemy = null;
    let buildings = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 100, 500); // Tighter fog for N64 feel

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, state.player.height, 0);

        // N64 Style: No PBR, simple rendering
        renderer = new THREE.WebGLRenderer({ antialias: false }); 
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        // Vertex Lighting (Lambert) emulation
        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.2);
        sunLight.position.set(100, 200, 100);
        scene.add(sunLight);

        createN64City();
        setupControls();
        spawnN64OmniMan();

        animate();
    };

    const createN64City = () => {
        const floorGeo = new THREE.PlaneGeometry(5000, 5000);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // Low-poly blocky buildings
        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        
        let seed = 64;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 300; i++) {
            const h = 40 + random() * 100;
            const w = 30 + random() * 40;
            const d = 30 + random() * 40;
            const x = (random() - 0.5) * 1800;
            const z = (random() - 0.5) * 1800;
            if (Math.abs(x) < 100 && Math.abs(z) < 100) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            // Chunky wireframes
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00 }));
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
                state.yaw -= e.movementX * 0.003; // N64 sensitivity feel
                state.pitch -= e.movementY * 0.003;
                state.pitch = Math.max(-1.48, Math.min(1.48, state.pitch));
                
                camera.rotation.order = 'YXZ';
                camera.rotation.y = state.yaw;
                camera.rotation.x = state.pitch;
                camera.rotation.z = 0;
            }
        });
    };

    const spawnN64OmniMan = () => {
        if (currentEnemy) return;

        // v4.7.6: N64-STYLE LOW-POLY MODEL
        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

        // Head (Low-poly 8x8 sphere)
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), mat(0xffffff));
        head.position.y = 8.5;
        omni.add(head);
        
        // Mustache (Sharp Polygonal Box)
        const stache = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), mat(0x111111));
        stache.position.set(0, 8.2, 0.9);
        omni.add(stache);

        // Torso (Chunky Box)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.5, 1.3), mat(0xffffff));
        torso.position.y = 5.2;
        omni.add(torso);

        // Cape (N64-Flat Box)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7.5, 0.1), mat(0xb71c1c));
        cape.position.set(0, 4.5, -0.7);
        omni.add(cape);

        // Limbs (Low-poly 4-sided cylinders = Boxes)
        const limbGeo = new THREE.BoxGeometry(0.5, 4.5, 0.5);
        const lArm = new THREE.Mesh(limbGeo, mat(0xffffff));
        lArm.position.set(-1.4, 5.5, 0);
        omni.add(lArm);

        const rArm = new THREE.Mesh(limbGeo, mat(0xffffff));
        rArm.position.set(1.4, 5.5, 0);
        omni.add(rArm);

        const legGeo = new THREE.BoxGeometry(0.7, 5, 0.7);
        const lLeg = new THREE.Mesh(legGeo, mat(0xb71c1c));
        lLeg.position.set(-0.6, 2, 0);
        omni.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, mat(0xb71c1c));
        rLeg.position.set(0.6, 2, 0);
        omni.add(rLeg);

        omni.position.set((Math.random()-0.5)*150, 0, (Math.random()-0.5)*150);
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
        currentEnemy.hp -= 300;
        spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
        updateBossUI();
        
        if (currentEnemy.hp <= 0) {
            scene.remove(currentEnemy.mesh);
            currentEnemy = null;
            state.run.kills++;
            setTimeout(spawnN64OmniMan, 1000);
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4); // Chunky particles
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 40; i++) {
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
            fist.style.transform = `translateY(-240px) scale(1.3) rotate(${side === 'left' ? 25 : -25}deg)`;
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
            const speed = (state.keys[' '] ? 3.2 : 1.0);
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
            
            if (dist < 600 && dist > 12) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.25 * dt));
                currentEnemy.mesh.position.y = 8 + Math.sin(Date.now() * 0.003) * 2;
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
