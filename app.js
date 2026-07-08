import * as THREE from 'three';

/**
 * Sovereign AAA (v4.7.2)
 * Features: Full 3D NPC Model, Red Gore System, Dual-Hand Animation Fix,
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
        scene.fog = new THREE.Fog(0x0d0d0d, 100, 700);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xff8c00, 0.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.3);
        sunLight.position.set(200, 500, 200);
        scene.add(sunLight);

        createAmberCity();
        setupControls();
        
        // v4.7.2: 1-NPC Limit
        spawn3DEnemy();

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
        
        let seed = 888;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 400; i++) {
            const h = 50 + random() * 100;
            const w = 25 + random() * 35;
            const d = 25 + random() * 35;
            const x = (random() - 0.5) * 2000;
            const z = (random() - 0.5) * 2000;
            if (Math.abs(x) < 60 && Math.abs(z) < 60) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.6 }));
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

    const spawn3DEnemy = () => {
        if (currentEnemy) return;

        // v4.7.2: FULL 3D GEOMETRY MODEL
        const group = new THREE.Group();
        
        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff8c00 }));
        head.position.y = 8;
        group.add(head);

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        torso.position.y = 5;
        group.add(torso);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.5, 3.5, 0.5);
        const leftArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xff8c00 }));
        leftArm.position.set(-1.2, 5.5, 0);
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0xff8c00 }));
        rightArm.position.set(1.2, 5.5, 0);
        group.add(rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.6, 4, 0.6);
        const leftLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
        leftLeg.position.set(-0.5, 2, 0);
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }));
        rightLeg.position.set(0.5, 2, 0);
        group.add(rightLeg);

        group.position.set((Math.random()-0.5)*150, 0, (Math.random()-0.5)*150);
        scene.add(group);

        currentEnemy = { mesh: group, hp: 1000 };
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        
        // v4.7.2: Debugged Dual-Hand Behavior
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        animateFist(state.lastArmUsed);
        
        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            const dirToEnemy = currentEnemy.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const dot = dirToEnemy.dot(forward);

            if (dist <= state.player.punchRange && dot > 0.7) {
                hitEnemy();
            }
        }
    };

    const hitEnemy = () => {
        currentEnemy.hp -= 250;
        // v4.7.2: RED GORE SYSTEM
        spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)));
        
        if (currentEnemy.hp <= 0) {
            scene.remove(currentEnemy.mesh);
            currentEnemy = null;
            state.run.kills++;
            setTimeout(spawn3DEnemy, 800);
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.SphereGeometry(0.4, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x990000 }); // Deep Red
        for (let i = 0; i < 40; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { 
                vel: new THREE.Vector3((Math.random()-0.5)*1.8, Math.random()*1.5, (Math.random()-0.5)*1.8), 
                life: 1.0 
            };
            scene.add(p); 
            bloodParticles.push(p);
        }
    };

    const animateFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if (fist) {
            fist.style.transform = `translateY(-220px) scale(1.3) rotate(${side === 'left' ? 25 : -25}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        if (moving) {
            state.timeDilation = state.keys[' '] ? 0.12 : 1.0; 
            const speed = (state.keys[' '] ? 3.2 : 0.95);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            
            if (state.player.isFlying) camera.position.y = Math.min(400, camera.position.y + 1.1);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.3);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        if (currentEnemy) {
            const dist = camera.position.distanceTo(currentEnemy.mesh.position);
            // Dynamic rotation to face player
            currentEnemy.mesh.lookAt(camera.position.x, 0, camera.position.z);
            
            if (dist < 450 && dist > 8) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.22 * dt));
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.018 * dt; 
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
