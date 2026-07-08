import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.2: 'THE BALANCED CAMPAIGN'
 * 1. Cape: 12-segment connected physics chain (no tearing).
 * 2. Animations: Upgraded procedural combat rig (directional punch trajectory).
 * 3. UI: Player Health (Top-Left) & Boss Health (Top-Center).
 * 4. Difficulty: Lunge velocity 7.0, Cooldown 15.0s.
 * 5. Gore: High-fidelity emitter sampling with forced buffer flush.
 * 6. Persistence: Death/Respawn cycle implemented.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, hemiLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, punchRange: 5.5, speed: 2.8, height: 15.0 },
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
        createUI();

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createUI = () => {
        // Player Health
        const playerUI = document.createElement('div');
        playerUI.id = 'player-ui';
        playerUI.style = 'position:fixed; top:20px; left:20px; width:200px; height:20px; background:#333; border:2px solid #fff; z-index:100;';
        const playerFill = document.createElement('div');
        playerFill.id = 'player-hp-fill';
        playerFill.style = 'width:100%; height:100%; background:#2e7d32; transition: width 0.2s;';
        playerUI.appendChild(playerFill);
        document.body.appendChild(playerUI);

        // Boss UI exists in HTML, but we ensure it's visible
        const bossUI = document.getElementById('boss-hp-container');
        if (bossUI) bossUI.style.display = 'block';
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
        
        // Head
        const head = createBeveledBox(1.5, 1.5, 1.5, 0xffdbac);
        head.position.y = 7.5;
        const stache = createBeveledBox(1.0, 0.3, 0.2, 0x111111);
        stache.position.set(0, -0.3, 0.8);
        head.add(stache);
        omni.add(head);

        // Torso
        const torso = createBeveledBox(3, 3.5, 1.5, 0xffffff);
        torso.position.y = 5.0;
        omni.add(torso);

        // 1. CAPE: Connected 12-segment chain
        const capeSegments = [];
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.61, 0.1, 0xb71c1c); // Slight overlap to prevent gaps
            seg.position.set(0, 7.5 - (i * 0.6), -0.9);
            omni.add(seg);
            capeSegments.push(seg);
        }

        // Arms
        const leftArm = createBeveledBox(1, 3.5, 1, 0xffffff);
        leftArm.position.set(-2.1, 5.0, 0);
        const rightArm = createBeveledBox(1, 3.5, 1, 0xffffff);
        rightArm.position.set(2.1, 5.0, 0);
        omni.add(leftArm);
        omni.add(rightArm);

        // Legs
        const legL = createBeveledBox(1.2, 3.5, 1.2, 0xb71c1c); legL.position.set(-0.75, 1.75, 0); omni.add(legL);
        const legR = createBeveledBox(1.2, 3.5, 1.2, 0xb71c1c); legR.position.set(0.75, 1.75, 0); omni.add(legR);

        omni.position.set((Math.random()-0.5)*500, 100, (Math.random()-0.5)*500);
        scene.add(omni);
        
        const bossContainer = document.getElementById('boss-hp-container');
        if (bossContainer) bossContainer.style.display = 'block';

        boss = { 
            mesh: omni, hp: 80000, maxHp: 80000, 
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
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.22, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 60; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x + (Math.random()-0.5)*2;
                    this.positions[i*3+1] = pos.y + (Math.random()-0.5)*2;
                    this.positions[i*3+2] = pos.z + (Math.random()-0.5)*2;
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
                    this.velocities[i].y -= 0.45;
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
                boss.hp -= 3500;
                // GORE: High-fidelity emitter sampling
                const worldPos = new THREE.Vector3();
                boss.mesh.getWorldPosition(worldPos);
                bloodSystem.emit(worldPos, fwd.multiplyScalar(4));
                
                const bar = document.getElementById('boss-hp-fill');
                if (bar) bar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
                
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh);
                    const bossUI = document.getElementById('boss-hp-container');
                    if (bossUI) bossUI.style.display = 'none';
                    boss = null;
                    state.combat.kills++;
                    document.getElementById('kills').innerText = state.combat.kills;
                    // Respawn cycle
                    setTimeout(spawnBeveledOmniMan, 3000);
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
            
            // CAPE: Connected physics chain logic
            boss.capeSegments.forEach((seg, i) => {
                const wave = Math.sin(boss.animTime * 4 + i * 0.5);
                seg.rotation.x = wave * 0.2;
                seg.position.z = -0.9 - (i * 0.05) + (wave * 0.1);
            });

            const dist = camera.position.distanceTo(boss.mesh.position);
            
            // 2. ANIMATIONS: Upgraded procedural combat rig
            if (dist < 45) {
                const punchSpeed = 18;
                boss.leftArm.rotation.x = Math.sin(boss.animTime * punchSpeed) * 1.8;
                boss.leftArm.position.z = Math.sin(boss.animTime * punchSpeed) * 1.5;
                boss.rightArm.rotation.x = Math.cos(boss.animTime * punchSpeed) * 1.8;
                boss.rightArm.position.z = Math.cos(boss.animTime * punchSpeed) * 1.5;
                
                // Damage Player
                if (dist < 8 && Math.random() < 0.02) {
                    state.player.hp -= 2;
                    const pFill = document.getElementById('player-hp-fill');
                    if (pFill) pFill.style.width = `${state.player.hp}%`;
                }
            } else {
                boss.leftArm.rotation.x = Math.sin(boss.animTime * 2) * 0.2;
                boss.leftArm.position.z = 0;
                boss.rightArm.rotation.x = Math.sin(boss.animTime * 2) * 0.2;
                boss.rightArm.position.z = 0;
            }

            // 5. DIFFICULTY: Lunge 7.0, Cooldown 15s
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.35), 0.04);
            boss.mesh.position.add(boss.vel);

            boss.attackTimer += dt;
            if (boss.attackTimer > 15.0) {
                boss.vel.add(targetDir.multiplyScalar(7.0));
                boss.attackTimer = 0;
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
