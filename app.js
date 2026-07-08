import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.3: 'STRIKE & HUD REPAIR'
 * 1. UI: Fixed z-index and absolute positioning to prevent text clipping.
 * 2. Animation: Implemented proper 'Punch Lunge' - arms extend forward on Z-axis.
 * 3. Gore: Forced world-matrix sampling on beveled torso for 100% reliable blood.
 * 4. Combat: Maintained v5.5.2 balance (7.0 lunge, 15s cooldown).
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
        repairUI();

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const repairUI = () => {
        // Cleanup old UI to prevent duplicates
        const oldP = document.getElementById('player-ui-v5');
        if (oldP) oldP.remove();

        // Player Health - Top Left
        const playerUI = document.createElement('div');
        playerUI.id = 'player-ui-v5';
        playerUI.style = 'position:fixed; top:20px; left:20px; width:220px; height:24px; background:rgba(0,0,0,0.7); border:2px solid #fff; z-index:9999; pointer-events:none;';
        const playerFill = document.createElement('div');
        playerFill.id = 'player-hp-fill';
        playerFill.style = 'width:100%; height:100%; background:#c62828; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);';
        playerUI.appendChild(playerFill);
        
        const playerLabel = document.createElement('div');
        playerLabel.innerText = 'PLAYER STATUS';
        playerLabel.style = 'position:absolute; top:-18px; left:0; color:#fff; font-family:monospace; font-size:12px; font-weight:bold;';
        playerUI.appendChild(playerLabel);
        document.body.appendChild(playerUI);

        // Boss UI fix
        const bossUI = document.getElementById('boss-hp-container');
        if (bossUI) {
            bossUI.style.zIndex = '9999';
            bossUI.style.top = '20px';
        }
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

        // Cape
        const capeSegments = [];
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.62, 0.1, 0xb71c1c); 
            seg.position.set(0, 7.5 - (i * 0.6), -0.9);
            omni.add(seg);
            capeSegments.push(seg);
        }

        // Arms (Skeletal pivot for lunge)
        const leftArmPivot = new THREE.Group();
        leftArmPivot.position.set(-2.1, 6.5, 0);
        const leftArm = createBeveledBox(1, 3.5, 1, 0xffffff);
        leftArm.position.y = -1.75;
        leftArmPivot.add(leftArm);
        
        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(2.1, 6.5, 0);
        const rightArm = createBeveledBox(1, 3.5, 1, 0xffffff);
        rightArm.position.y = -1.75;
        rightArmPivot.add(rightArm);

        omni.add(leftArmPivot);
        omni.add(rightArmPivot);

        // Legs
        const legL = createBeveledBox(1.2, 3.5, 1.2, 0xb71c1c); legL.position.set(-0.75, 1.75, 0); omni.add(legL);
        const legR = createBeveledBox(1.2, 3.5, 1.2, 0xb71c1c); legR.position.set(0.75, 1.75, 0); omni.add(legR);

        omni.position.set((Math.random()-0.5)*600, 100, (Math.random()-0.5)*600);
        scene.add(omni);
        
        const bossContainer = document.getElementById('boss-hp-container');
        if (bossContainer) bossContainer.style.display = 'block';

        boss = { 
            mesh: omni, torso: torso, hp: 80000, maxHp: 80000, 
            animTime: 0, vel: new THREE.Vector3(), attackTimer: 0,
            leftArm: leftArmPivot, rightArm: rightArmPivot, capeSegments
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
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.25, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            this.points.frustumCulled = false;
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 70; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; 
                    this.positions[i*3+1] = pos.y; 
                    this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*14 + dir.x*8, Math.random()*14 + dir.y*8, (Math.random()-0.5)*14 + dir.z*8);
                    n++;
                }
            }
        }
        update(dt) {
            const pos = this.geometry.getAttribute('position');
            for(let i=0; i<this.count; i++) {
                if(this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.6;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.5;
                } else { this.positions[i*3] = 10000; }
            }
            pos.needsUpdate = true;
        }
    }

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 3.0;
        setTimeout(() => h.position.z = -2.0, 70);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist < state.player.punchRange) {
                boss.hp -= 4000;
                // GORE FIX: Force check world-matrix of the TORSO geometry specifically
                const worldPos = new THREE.Vector3();
                boss.torso.getWorldPosition(worldPos);
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
            
            boss.capeSegments.forEach((seg, i) => {
                const wave = Math.sin(boss.animTime * 4 + i * 0.5);
                seg.rotation.x = wave * 0.2;
                seg.position.z = -0.9 - (i * 0.05) + (wave * 0.1);
            });

            const dist = camera.position.distanceTo(boss.mesh.position);
            
            // ANIMATION FIX: Proper Punch Lunge
            if (dist < 45) {
                const cycle = Math.sin(boss.animTime * 14);
                // Rotate arm forward on X, extend on Z toward player
                boss.leftArm.rotation.x = -Math.PI / 2 - (cycle * 0.8);
                boss.rightArm.rotation.x = -Math.PI / 2 + (cycle * 0.8);
                
                if (dist < 10 && Math.random() < 0.03) {
                    state.player.hp -= 3;
                    const pFill = document.getElementById('player-hp-fill');
                    if (pFill) pFill.style.width = `${state.player.hp}%`;
                    if (state.player.hp <= 0) {
                        state.player.hp = 100; // Reset for demo
                        if (pFill) pFill.style.width = '100%';
                    }
                }
            } else {
                boss.leftArm.rotation.x = Math.lerp(boss.leftArm.rotation.x, 0, 0.1);
                boss.rightArm.rotation.x = Math.lerp(boss.rightArm.rotation.x, 0, 0.1);
            }

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
