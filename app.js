import * as THREE from 'three';

/**
 * SOVEREIGN v5.0.1: 'Skeletal & Particle Deep-Dive'
 * 1. Fully Articulated Hand skeletal rigging (3-segment phalanges per finger).
 * 2. High-Performance GPU Particle-Buffer Blood System (2k cap, gravity-reactant).
 * 3. Physics-aligned hit velocity interpolation.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, punchRange: 14.4, speed: 1.5, isFlying: false, height: 2.8 },
        combat: { kills: 0, active: true },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false },
        isLocked: false,
        pitch: 0,
        yaw: 0,
        lastArmUsed: 'right'
    };

    let boss = null;
    let playerHands = { left: null, right: null };
    let bloodSystem = null;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0b);
        scene.fog = new THREE.Fog(0x0a0a0b, 50, 1000);

        camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 3000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 2.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createArena();
        createArticulatedHands();
        bloodSystem = new BloodParticleSystem(scene);
        spawnBoss();
        setupInput();

        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        const groundGeo = new THREE.PlaneGeometry(5000, 5000, 20, 20);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
        for (let i = 0; i < 400; i++) {
            const h = 40 + Math.random() * 250;
            const w = 40 + Math.random() * 60;
            const x = (Math.random() - 0.5) * 3000;
            const z = (Math.random() - 0.5) * 3000;
            if (Math.abs(x) < 300 && Math.abs(z) < 300) continue;
            const b = new THREE.Mesh(boxGeo, boxMat);
            b.scale.set(w, h, w);
            b.position.set(x, h/2, z);
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createArticulatedHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
        const createHand = (side) => {
            const group = new THREE.Group();
            
            // Palm
            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.8), mat);
            group.add(palm);

            // Fully Articulated Fingers (3-segment phalanges)
            const fingerOffsets = [-0.3, -0.1, 0.1, 0.3, 0.45]; // index to thumb
            fingerOffsets.forEach((xOffset, i) => {
                const fingerRoot = new THREE.Group();
                fingerRoot.position.set(xOffset, 0, 0.4);
                if (i === 4) { // Thumb positioning
                    fingerRoot.position.set(side === 'left' ? 0.45 : -0.45, 0, 0.1);
                    fingerRoot.rotation.y = side === 'left' ? 0.6 : -0.6;
                }

                let prevSegment = fingerRoot;
                for(let s=0; s<3; s++) {
                    const segGroup = new THREE.Group();
                    const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.3), mat);
                    segMesh.rotation.x = Math.PI / 2;
                    segMesh.position.z = 0.15;
                    segGroup.add(segMesh);
                    prevSegment.add(segGroup);
                    if (s > 0) segGroup.position.z = 0.3;
                    prevSegment = segGroup;
                }
                group.add(fingerRoot);
            });

            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -1.8);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    class BloodParticleSystem {
        constructor(scene) {
            this.count = 2000;
            this.geometry = new THREE.BufferGeometry();
            this.positions = new Float32Array(this.count * 3);
            this.velocities = Array.from({length: this.count}, () => new THREE.Vector3());
            this.lifetimes = new Float32Array(this.count);

            for(let i=0; i<this.count; i++) this.positions[i*3] = 10000; // init offscreen

            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
            this.material = new THREE.PointsMaterial({
                color: 0xaa0000,
                size: 0.12,
                transparent: true,
                blending: THREE.NormalBlending
            });

            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }

        emit(pos, impactVel) {
            let emitted = 0;
            for (let i = 0; i < this.count && emitted < 60; i++) {
                if (this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x;
                    this.positions[i*3+1] = pos.y;
                    this.positions[i*3+2] = pos.z;
                    this.velocities[i].set(
                        (Math.random() - 0.5) * 6 + impactVel.x * 0.4,
                        Math.random() * 6 + impactVel.y * 0.4,
                        (Math.random() - 0.5) * 6 + impactVel.z * 0.4
                    );
                    emitted++;
                }
            }
        }

        update(dt) {
            const posAttr = this.geometry.getAttribute('position');
            for (let i = 0; i < this.count; i++) {
                if (this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.8;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.25; // gravity simulate
                } else {
                    this.positions[i*3] = 10000;
                }
            }
            posAttr.needsUpdate = true;
        }
    }

    const spawnBoss = () => {
        if (boss) return;
        const group = new THREE.Group();
        const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 4, 8, 16), mat(0xffffff));
        body.position.y = 5;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), mat(0xffffff));
        head.position.y = 8.5;
        group.add(head);
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), mat(0xb71c1c));
        cape.position.set(0, 5, -1.2);
        cape.rotation.x = 0.1;
        group.add(cape);
        group.position.set((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200);
        scene.add(group);
        boss = { mesh: group, hp: 15000, maxHp: 15000 };
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') state.timeDilation = 0.2;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') state.timeDilation = 1.0;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                state.yaw -= e.movementX * 0.002;
                state.pitch -= e.movementY * 0.002;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const hand = playerHands[state.lastArmUsed];
        const initialZ = hand.position.z;
        hand.position.z -= 2.2;
        setTimeout(() => hand.position.z = initialZ, 80);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.5) {
                boss.hp -= 1200;
                updateUI();
                bloodSystem.emit(boss.mesh.position.clone().add(new THREE.Vector3(0, 7, 0)), forward.multiplyScalar(5));
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh);
                    boss = null;
                    state.combat.kills++;
                    updateUI();
                    setTimeout(spawnBoss, 1000);
                }
            }
        }
    };

    const updateUI = () => {
        const fill = document.getElementById('boss-hp-fill');
        if (fill && boss) fill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
        document.getElementById('kills').innerText = state.combat.kills;
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;

        if (state.isLocked) {
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            moveDir.y = 0;
            camera.position.add(moveDir.multiplyScalar(state.player.speed * state.timeDilation * 50 * 0.016));
        }

        if (boss) {
            boss.mesh.lookAt(camera.position.x, 0, camera.position.z);
            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist > 15 && dist < 1200) {
                const step = boss.mesh.position.clone().sub(camera.position).normalize().multiplyScalar(-0.45 * state.timeDilation);
                boss.mesh.position.add(step);
                boss.mesh.position.y = 10 + Math.sin(Date.now() * 0.002) * 6;
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };

    return { init };
})();

Sovereign.init();
