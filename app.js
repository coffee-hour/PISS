import * as THREE from 'three';

/**
 * Sovereign v4.7.7: 'N64 Soft-Poly Aesthetic'
 * Features: N64 'Soft-Poly' (Gouraud Shading), Bilinear Texture Filtering,
 * Rounded Low-Poly Omni-Man, True Vertical Pitch Control, Red Gore.
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

    // N64 Bilinear Texture Emulation
    const createN64Texture = (color1, color2) => {
        const size = 32; // Low res
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color2;
        ctx.fillRect(0, 0, size/2, size/2);
        ctx.fillRect(size/2, size/2, size/2, size/2);
        const tex = new THREE.CanvasTexture(canvas);
        // Bilinear Filtering (Classic N64 blur)
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(100, 100);
        return tex;
    };

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 120, 600);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true }); 
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.4);
        sunLight.position.set(150, 250, 150);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        spawnSoftOmniMan();

        animate();
    };

    const createSoftN64City = () => {
        const floorTex = createN64Texture('#050505', '#080808');
        const floorGeo = new THREE.PlaneGeometry(5000, 5000);
        const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const bTex = createN64Texture('#111111', '#1a1a1a');
        bTex.repeat.set(2, 5);
        const buildingMat = new THREE.MeshLambertMaterial({ map: bTex });
        
        let seed = 128;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 300; i++) {
            const h = 50 + random() * 120;
            const w = 35 + random() * 45;
            const d = 35 + random() * 45;
            const x = (random() - 0.5) * 2000;
            const z = (random() - 0.5) * 2000;
            if (Math.abs(x) < 120 && Math.abs(z) < 120) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.3 }));
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
                state.yaw -= e.movementX * 0.0025;
                state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.48, Math.min(1.48, state.pitch));
                
                camera.rotation.order = 'YXZ';
                camera.rotation.y = state.yaw;
                camera.rotation.x = state.pitch;
                camera.rotation.z = 0;
            }
        });
    };

    const spawnSoftOmniMan = () => {
        if (currentEnemy) return;

        // v4.7.7: N64 'SOFT-POLY' MODEL (Gouraud-style soft shading)
        const omni = new THREE.Group();
        // Lambert without flatShading creates Gouraud-style soft vertex lighting
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });

        // Head (Rounded low-poly 12x12 sphere)
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), mat(0xffffff));
        head.position.y = 8.5;
        omni.add(head);
        
        // Mustache (Rounded Box)
        const stache = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.2), mat(0x111111));
        stache.position.set(0, 8.2, 0.9);
        omni.add(stache);

        // Torso (Rounded Cylinder-ish)
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1, 4.5, 8), mat(0xffffff));
        torso.position.y = 5.2;
        omni.add(torso);

        // Cape (N64-Flat)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7.5, 0.1), mat(0xb71c1c));
        cape.position.set(0, 4.5, -0.7);
        omni.add(cape);

        // Limbs (Low-poly cylinders with soft shading)
        const limbGeo = new THREE.CylinderGeometry(0.35, 0.3, 4.5, 6);
        const lArm = new THREE.Mesh(limbGeo, mat(0xffffff));
        lArm.position.set(-1.5, 5.5, 0);
        omni.add(lArm);

        const rArm = new THREE.Mesh(limbGeo, mat(0xffffff));
        rArm.position.set(1.5, 5.5, 0);
        omni.add(rArm);

        const legGeo = new THREE.CylinderGeometry(0.45, 0.4, 5, 6);
        const lLeg = new THREE.Mesh(legGeo, mat(0xb71c1c));
        lLeg.position.set(-0.7, 2, 0);
        omni.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, mat(0.7, 2, 0));
        rLeg.position.set(0.7, 2, 0);
        omni.add(rLeg);

        omni.position.set((Math.random()-0.5)*160, 0, (Math.random()-0.5)*160);
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

            if (dist <= state.player.punchRange && dot > 0.6) {
                hitEnemy();
            }
        }
    };

    const hitEnemy = () => {
        currentEnemy.hp -= 350;
        spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
        updateBossUI();
        
        if (currentEnemy.hp <= 0) {
            scene.remove(currentEnemy.mesh);
            currentEnemy = null;
            state.run.kills++;
            setTimeout(spawnSoftOmniMan, 1200);
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4); 
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 45; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { 
                vel: new THREE.Vector3((Math.random()-0.5)*2.6, Math.random()*2.6, (Math.random()-0.5)*2.6), 
                life: 1.0 
            };
            scene.add(p); 
            bloodParticles.push(p);
        }
    };

    const animate3DFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if (fist) {
            fist.style.transform = `translateY(-260px) scale(1.3) rotate(${side === 'left' ? 28 : -28}deg)`;
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
            const speed = (state.keys[' '] ? 3.4 : 1.1);
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
            
            if (dist < 650 && dist > 14) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.28 * dt));
                currentEnemy.mesh.position.y = 10 + Math.sin(Date.now() * 0.003) * 3;
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
