import * as THREE from 'three';

/**
 * Sovereign v4.8.6: 'Muscle & Cape Overhaul'
 * Features: Primitive Muscle Contouring (Pecs/Delts/Calves), 
 * Multi-Segmented Draping Cape, Refined Head Definition, 
 * Back-of-Hand Fists, Spacebar Time Slow (0.2x), 
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
        scene.fog = new THREE.Fog(0x0a0a0a, 150, 900);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.8);
        sunLight.position.set(300, 800, 300);
        scene.add(sunLight);

        createSoftN64City();
        setupControls();
        createBackOfHandFists();
        spawnPrimitiveOmniMan();

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

            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.8), matBlue);
            group.add(palm);

            for(let i=0; i<4; i++) {
                const x = -0.25 + i * 0.17;
                const knuck = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), matBlue);
                knuck.position.set(x, 0.1, 0.4);
                group.add(knuck);

                const yellowPad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matYellow);
                yellowPad.position.set(x, 0.12, 0.45);
                group.add(yellowPad);
                
                const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.4, 8), matBlue);
                finger.position.set(x, -0.15, 0.35);
                finger.rotation.x = -Math.PI/4;
                group.add(finger);
            }

            const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 8, 8), matBlue);
            thumb.position.set(side === 'left' ? 0.4 : -0.4, -0.05, 0.2);
            thumb.rotation.set(0.1, 0, side === 'left' ? -1.0 : 1.0);
            group.add(thumb);

            group.position.set(side === 'left' ? -1.8 : 1.8, -1.3, -3.0);
            group.rotation.set(-0.3, 0, 0); 
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createFist('left');
        playerHands.right = createFist('right');
    };

    const spawnPrimitiveOmniMan = () => {
        if (currentEnemy) return;
        const omni = new THREE.Group();
        const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: false });
        const whiteMat = mat(0xffffff);
        const redMat = mat(0xb71c1c);
        const darkMat = mat(0x111111);

        // 1. Torso: Primitive-Fit with Muscle Detail (Pecs/Abs)
        const torsoGroup = new THREE.Group();
        const core = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 4.5, 12), whiteMat);
        torsoGroup.add(core);

        // Defined Pecs (Geometric Spheres)
        const pecL = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), whiteMat);
        pecL.position.set(-0.5, 1.5, 0.5);
        pecL.scale.set(1, 0.8, 0.4);
        torsoGroup.add(pecL);
        const pecR = pecL.clone(); pecR.position.x = 0.5;
        torsoGroup.add(pecR);

        torsoGroup.position.y = 5.2;
        omni.add(torsoGroup);

        // 2. Refined Head (Jaw, Mustache, Eyes)
        const headGroup = new THREE.Group();
        headGroup.position.y = 8.2;
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), whiteMat);
        headGroup.add(skull);
        const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 0.6, 8), whiteMat);
        jaw.position.y = -0.4;
        headGroup.add(jaw);

        const eyeGeo = new THREE.BoxGeometry(0.3, 0.08, 0.1);
        const eyeL = new THREE.Mesh(eyeGeo, darkMat);
        eyeL.position.set(-0.35, 0.15, 0.75);
        eyeL.rotation.z = 0.15;
        headGroup.add(eyeL);
        const eyeR = eyeL.clone(); eyeR.position.x = 0.35; eyeR.rotation.z = -0.15;
        headGroup.add(eyeR);

        const moustache = new THREE.Group();
        for(let i=0; i<12; i++) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), darkMat);
            const angle = (i/11) * Math.PI;
            s.position.set(Math.cos(angle)*0.55, -0.2 - Math.abs(Math.sin(angle))*0.12, 0.85);
            moustache.add(s);
        }
        headGroup.add(moustache);
        omni.add(headGroup);

        // 3. Arms: Cylinders with Deltoid Contouring
        const createArm = (side) => {
            const armGroup = new THREE.Group();
            
            // Deltoid (Sphere Joint)
            const delt = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), whiteMat);
            armGroup.add(delt);

            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2, 8), whiteMat);
            upper.position.y = -1;
            armGroup.add(upper);

            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), whiteMat);
            elbow.position.y = -2;
            armGroup.add(elbow);

            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2, 8), whiteMat);
            lower.position.y = -3;
            armGroup.add(lower);

            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), whiteMat);
            hand.position.y = -4;
            armGroup.add(hand);

            armGroup.position.set(side * 1.7, 7.2, 0);
            return armGroup;
        };
        omni.add(createArm(-1));
        omni.add(createArm(1));

        // 4. Legs: Cylinders with Calf Contouring
        const createLeg = (side) => {
            const legGroup = new THREE.Group();
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.5, 8), redMat);
            upper.position.y = -1.25;
            legGroup.add(upper);

            const knee = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), redMat);
            knee.position.y = -2.5;
            legGroup.add(knee);

            // Calf Contouring (Sphere addition)
            const calf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), redMat);
            calf.scale.set(1, 1.2, 0.8);
            calf.position.set(0, -3.5, -0.1);
            legGroup.add(calf);

            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.5, 8), redMat);
            lower.position.y = -3.75;
            legGroup.add(lower);

            const foot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), redMat);
            foot.scale.set(1, 0.5, 1.5);
            foot.position.set(0, -5, 0.3);
            legGroup.add(foot);

            legGroup.position.set(side * 0.6, 3.2, 0);
            return legGroup;
        };
        omni.add(createLeg(-1));
        omni.add(createLeg(1));

        // 5. Overhauled Draping Cape (Multi-Segmented)
        const capeGroup = new THREE.Group();
        const segments = 5;
        for(let i = 0; i < segments; i++) {
            const flap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.1), redMat);
            flap.position.set(-1.2 + i * 0.6, 4.5, -0.8 - Math.sin(i)*0.1);
            flap.rotation.y = Math.sin(i*0.4)*0.2;
            capeGroup.add(flap);
        }
        omni.add(capeGroup);

        omni.position.set((Math.random()-0.5)*180, 0, (Math.random()-0.5)*180);
        scene.add(omni);
        currentEnemy = { mesh: omni, hp: 12000, maxHp: 12000, cape: capeGroup };
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
                currentEnemy.hp -= 800;
                spawnGore(currentEnemy.mesh.position.clone().add(new THREE.Vector3(0, 6.5, 0)));
                updateUI();
                if (currentEnemy.hp <= 0) {
                    scene.remove(currentEnemy.mesh);
                    currentEnemy = null; state.run.kills++;
                    setTimeout(spawnPrimitiveOmniMan, 1200);
                }
            }
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 65; i++) {
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
            
            // Dynamic Cape Draping Logic
            currentEnemy.cape.children.forEach((flap, i) => {
                flap.rotation.x = Math.sin(Date.now() * 0.003 + i) * 0.1;
                flap.position.z = -0.9 - Math.sin(Date.now() * 0.002 + i) * 0.05;
            });

            if (dist < 850 && dist > 15) {
                currentEnemy.mesh.position.add(camera.position.clone().sub(currentEnemy.mesh.position).normalize().multiplyScalar(0.42 * dt));
                currentEnemy.mesh.position.y = 12 + Math.sin(Date.now() * 0.002) * 6;
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
