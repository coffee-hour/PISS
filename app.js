import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.1: 'CALIBRATED CONQUEST'
 * 1. AI Tuning: Reduced Omni-Man's flight and lunge speed for balanced combat.
 * 2. Maintained v5.5.0: Beveled geometry, cape physics, and punch cycles.
 * 3. Combat: Precision tracking with lower velocity caps.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, hemiLight;
    
    let state = {
        player: { hp: 100, punchRange: 5.5, speed: 2.8, height: 15.0 },
        combat: { kills: 0 },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false },
        isLocked: false,
        pitch: 0,
        yaw: 0,
        lastArmUsed: 'right'
    };

    let boss = null;
    let playerHands = { left: null, right: null };
    let bloodSystem = null;

    const createBeveledBox = (w, h, d, color) => {
        const geometry = new THREE.BoxGeometry(w, h, d);
        return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color, flatShading: false }));
    };

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 50, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(100, 300, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createArena();
        createBeveledHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        spawnBeveledOmniMan();

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        for (let i = 0; i < 300; i++) {
            const h = 100 + Math.random() * 500;
            const b = new THREE.Mesh(new THREE.BoxGeometry(80, h, 80), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
            b.position.set((Math.random()-0.5)*4000, h/2, (Math.random()-0.5)*4000);
            if (b.position.length() < 300) continue;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createBeveledHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
        const createHand = (side) => {
            const group = new THREE.Group();
            const fist = createBeveledBox(0.8, 0.8, 1.2, 0x1e88e5);
            group.add(fist);
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
            group.rotation.set(0.2, 0, 0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnBeveledOmniMan = () => {
        if (boss) return;
        const omni = new THREE.Group();
        const white = 0xffffff;
        const red = 0xb71c1c;
        const skin = 0xffdbac;
        const black = 0x111111;

        const head = createBeveledBox(1.5, 1.5, 1.5, skin);
        head.position.y = 7.5;
        const stache = createBeveledBox(1.0, 0.3, 0.2, black);
        stache.position.set(0, -0.3, 0.8);
        head.add(stache);
        omni.add(head);

        const torso = createBeveledBox(3, 3.5, 1.5, white);
        torso.position.y = 5.0;
        omni.add(torso);

        const capeGroup = new THREE.Group();
        const capeSegments = [];
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.6, 0.1, red);
            seg.position.set(0, 7.5 - (i * 0.6), -0.9);
            capeGroup.add(seg);
            capeSegments.push(seg);
        }
        omni.add(capeGroup);

        const leftArm = createBeveledBox(1, 3.5, 1, white);
        leftArm.position.set(-2.1, 5.0, 0);
        const rightArm = createBeveledBox(1, 3.5, 1, white);
        rightArm.position.set(2.1, 5.0, 0);
        omni.add(leftArm);
        omni.add(rightArm);

        const legL = createBeveledBox(1.2, 3.5, 1.2, red); legL.position.set(-0.75, 1.75, 0); omni.add(legL);
        const legR = createBeveledBox(1.2, 3.5, 1.2, red); legR.position.set(0.75, 1.75, 0); omni.add(legR);

        omni.position.set((Math.random()-0.5)*300, 100, (Math.random()-0.5)*300);
        scene.add(omni);
        
        boss = { 
            mesh: omni, hp: 60000, maxHp: 60000, 
            animTime: 0, vel: new THREE.Vector3(), attackTimer: 0,
            leftArm, rightArm, capeSegments
        };
    };

    class BloodParticleSystem {
        constructor(scene) {
            this.count = 2000;
            this.geometry = new THREE.BufferGeometry();
            this.positions = new Float32Array(this.count * 3);
            this.velocities = Array.from({length: this.count}, () => new THREE.Vector3());
            this.lifetimes = new Float32Array(this.count);
            for(let i=0; i<this.count; i++) this.positions[i*3] = 10000;
            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.2, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 60; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*12 + dir.x*7, Math.random()*12 + dir.y*7, (Math.random()-0.5)*12 + dir.z*7);
                    n++;
                }
            }
        }
        update(dt) {
            const pos = this.geometry.getAttribute('position');
            for(let i=0; i<this.count; i++) {
                if(this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.5;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.4;
                } else { this.positions[i*3] = 10000; }
            }
            pos.needsUpdate = true;
        }
    }

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 2.5;
        setTimeout(() => h.position.z = -2.0, 70);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist < state.player.punchRange) {
                boss.hp -= 2500;
                bloodSystem.emit(boss.mesh.position, fwd.multiplyScalar(4));
                const bar = document.getElementById('boss-hp-fill');
                if (bar) bar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh); boss = null;
                    state.combat.kills++; document.getElementById('kills').innerText = state.combat.kills;
                    setTimeout(spawnBeveledOmniMan, 1500);
                }
            }
        }
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Space') state.timeDilation = 0.2;
            if(e.shiftKey) state.keys.shift = true;
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if(e.code === 'Space') state.timeDilation = 1.0;
            if(!e.shiftKey) state.keys.shift = false;
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if(!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw -= e.movementX * 0.0025; state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;

        if (state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            const s = state.player.speed * (state.keys.shift ? 4.0 : 1.0);
            camera.position.add(dir.multiplyScalar(s * dt * 60));
        }

        if (boss) {
            boss.animTime += dt;
            boss.mesh.lookAt(camera.position);
            
            boss.capeSegments.forEach((seg, i) => {
                seg.rotation.x = Math.sin(boss.animTime * 3 + i * 0.4) * 0.25;
                seg.position.z = -0.9 - Math.sin(boss.animTime * 2 + i * 0.3) * 0.3;
            });

            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist < 40) {
                boss.leftArm.rotation.x = Math.sin(boss.animTime * 15) * 1.5;
                boss.rightArm.rotation.x = Math.cos(boss.animTime * 15) * 1.5;
            } else {
                boss.leftArm.rotation.x = Math.sin(boss.animTime * 2) * 0.2;
                boss.rightArm.rotation.x = Math.sin(boss.animTime * 2) * 0.2;
            }

            // AI SPEED TUNING: Reduced tracking and lunge velocities
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.45), 0.04); // Reduced from 0.75 / 0.05
            boss.mesh.position.add(boss.vel);

            boss.attackTimer += dt;
            if (boss.attackTimer > 3.5) { // Increased cooldown from 2.5
                boss.vel.add(targetDir.multiplyScalar(10.0)); // Reduced lunge from 16.0
                boss.attackTimer = 0;
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
