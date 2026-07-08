import * as THREE from 'three';

/**
 * Sovereign v4.7.8: 'Hyper-Articulated N64'
 * Features: High-Segment Soft-Poly Models (~100 radial segments), 
 * Articulated 3D Gauntlets (Fingers/Knuckles), Gouraud Shading,
 * Bilinear Texture Filtering, True Vertical Pitch, 1-NPC.
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
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 700);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.5);
        sunLight.position.set(200, 400, 200);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        createPlayerGauntlets();
        spawnArticulatedOmniMan();

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
        
        let seed = 256;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 350; i++) {
            const h = 60 + random() * 140;
            const w = 40 + random() * 50;
            const d = 40 + random() * 50;
            const x = (random() - 0.5) * 2500;
            const z = (random() - 0.5) * 2500;
            if (Math.abs(x) < 150 && Math.abs(z) < 150) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.25 }));
            line.scale.set(w, h, d);
            line.position.copy(b.position);
            scene.add(line);
        }
    };

    const createPlayerGauntlets = () => {
        const createHand = (side) => {
            const group = new THREE.Group();
            const matBlue = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
            const matYellow = new THREE.MeshLambertMaterial({ color: 0xffeb3b });

            // Palm (High-segment cylinder)
            const palm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.8, 32), matBlue);
            palm.rotation.x = Math.PI / 2;
            group.add(palm);

            // Fingers (Articulated with knuckles)
            const fingerGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16);
            for(let i = 0; i < 4; i++) {
                const fingerGroup = new THREE.Group();
                const base = new THREE.Mesh(fingerGeo, matBlue);
                const tip = new THREE.Mesh(fingerGeo, matYellow);
                tip.position.y = 0.3;
                fingerGroup.add(base);
                fingerGroup.add(tip);
                
                fingerGroup.position.set(-0.3 + i * 0.2, 0.4, 0.2);
                fingerGroup.rotation.x = -0.5;
                group.add(fingerGroup);
            }

            // Thumb
            const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16), matBlue);
            thumb.position.set(side === 'left' ? 0.45 : -0.45, 0.2, 0);
            thumb.rotation.z = side === 'left' ? -0.8 : 0.8;
            group.add(thumb);

            group.position.set(side === 'left' ? -1.5 : 1.5, -1, -2.5);
            camera.add(group);
            return group;
        };

        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnArticulatedOmniMan = () => {
        if (currentEnemy) return;

        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });
        // v4.7.8: High Segment Count (~100 radial segments for body)
        const segments = 100;

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments), mat(0xffffff));
        head.position.y = 8.5;
        omni.add(head);
        
        // Mustache (Rounded Box)
        const stache = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 16, segments, Math.PI), mat(0x111111));
        stache.rotation.z = Math.PI;
        stache.position.set(0, 8.2, 0.95);
        omni.add(stache);

        // Torso (Detailed segments)
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 5, segments), mat(0xffffff));
        torso.position.y = 5.2;
        omni.add(torso);

        // Cape
        const cape = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.5, 0.1, 10, 10), mat(0xb71c1c));
        cape.position.set(0, 4.5, -0.7);
        omni.add(cape);

        // Limbs (Smooth high-poly)
        const limbGeo = new THREE.CylinderGeometry(0.4, 0.35, 4.5, 32);
        const limbs = [
            { pos: [-1.6, 5.5, 0], rot: [0, 0, 0.2] },
            { pos: [1.6, 5.5, 0], rot: [0, 0, -0.2] },
            { pos: [-0.7, 2, 0], rot: [0, 0, 0], color: 0xb71c1c },
            { pos: [0.7, 2, 0], rot: [0, 0, 0], color: 0xb71c1c }
        ];

        limbs.forEach(l => {
            const mesh = new THREE.Mesh(limbGeo, mat(l.color || 0xffffff));
            mesh.position.set(...l.pos);
            mesh.rotation.set(...l.rot);
            omni.add(mesh);
        });

        omni.position.set((Math.random()-0.5)*150, 0, (Math.random()-0.5)*150);
        scene.add(omni);
        currentEnemy = { mesh: omni, hp: 8000, maxHp: 8000 };
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
                state.yaw -= e.movementX * 0.002;
                state.pitch -= e.movementY * 0.002;
                state.pitch = Math.max(-1.48, Math.min(1.48, state.pitch));
                camera.rotation.order = 'YXZ';
                camera.rotation.y = state.yaw;
                camera.rotation.x = state.pitch;
            }
        });
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        
        // v4.7.8: 3D Gauntlet Animation
        const hand = playerHands[state.lastArmUsed];
        const originalZ = hand.position.z;
        hand.position.z -= 1.5;
        hand.rotation.x -= 0.5;
        setTimeout(() => {
            hand.position.z = originalZ;
            hand.rotation.x += 0.5;
        }, 100);

        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dir = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.6) {
                currentEnemy.hp -= 300;
                spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
                updateUI();
                if (currentEnemy.hp <= 0) {
                    scene.remove(currentEnemy.mesh);
                    currentEnemy = null;
                    state.run.kills++;
                    setTimeout(spawnArticulatedOmniMan, 1200);
                }
            }
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 50; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*2.5, Math.random()*2.5, (Math.random()-0.5)*2.5), life: 1.0 };
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
            if (state.player.isFlying) camera.position.y = Math.min(800, camera.position.y + 1.5);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.6);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        if (currentEnemy) {
            currentEnemy.mesh.lookAt(camera.position.x, currentEnemy.mesh.position.y, camera.position.z);
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            if (dist < 600 && dist > 14) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.3 * dt));
                currentEnemy.mesh.position.y = 10 + Math.sin(Date.now() * 0.003) * 3;
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.02 * dt; p.userData.life -= 0.02 * dt; p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { scene.remove(p); bloodParticles.splice(i, 1); }
        });

        renderer.render(scene, camera);
    };

    return { init };
})();

window.Fighter = Fighter.init();
