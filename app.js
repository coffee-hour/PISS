import * as THREE from 'three';

/**
 * SOVEREIGN v5.6.0: 'RPG EXPANSION ROLLBACK'
 * 1. Stability Rollback: Reverting to the last known stable render state.
 * 2. Terrain: Standard arena size (5000 units), no roaming/area aggro.
 * 3. Specials: Restored X (Thunderclap), N (Sonic Dash), Z (Eye Beam) with cooldowns.
 * 4. RPG System: Leveling and XP tracking restored to the Amber HUD.
 * 5. Lighting: Stable Directional + Hemisphere light array.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, hemiLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, punchRange: 5.5, speed: 2.8, height: 15.0, level: 1, xp: 0, nextXp: 5000 },
        combat: { kills: 0 },
        specials: {
            X: { name: 'Thunderclap', cd: 8, timer: 0 },
            N: { name: 'Sonic Dash', cd: 5, timer: 0 },
            Z: { name: 'Eye Beam', cd: 12, timer: 0 }
        },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false, x: false, n: false, z: false },
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
        
        // Force basic container layout
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '0';
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
        deployRPG_HUD();

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const deployRPG_HUD = () => {
        // Cleanup existing HUDs
        ['rpg-master-hud', 'amber-master-hud', 'rpg-master-hud-v571', 'rpg-master-hud-v572'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        const style = document.createElement('style');
        style.innerHTML = `
            .rpg-hud {
                position: fixed;
                z-index: 9999;
                pointer-events: none;
                font-family: 'Courier New', monospace;
                text-transform: uppercase;
                color: #ffbf00;
            }
            .amber-bar {
                background: rgba(15, 15, 15, 0.9);
                border: 1px solid #ffbf00;
                height: 10px;
                border-radius: 2px;
                overflow: hidden;
            }
            .amber-fill {
                height: 100%;
                background: #ffbf00;
                width: 0%;
                transition: width 0.3s;
            }
            .special-node {
                display: inline-block;
                width: 60px;
                background: rgba(0,0,0,0.8);
                border: 1px solid #ffbf00;
                margin-right: 5px;
                text-align: center;
                font-size: 10px;
                padding: 4px;
            }
        `;
        document.head.appendChild(style);

        const hud = document.createElement('div');
        hud.id = 'rpg-master-hud';
        hud.className = 'rpg-hud';
        hud.style.top = '20px';
        hud.style.left = '20px';
        hud.innerHTML = \`
            <div style="font-size:14px; font-weight:bold;">LVL <span id="p-lvl">1</span> // SOVEREIGN</div>
            <div class="amber-bar" style="width:250px; margin: 5px 0;">
                <div id="p-hp-fill" class="amber-fill" style="width:100%; background:#c62828;"></div>
            </div>
            <div class="amber-bar" style="width:250px; height:6px;">
                <div id="p-xp-fill" class="amber-fill" style="width:0%;"></div>
            </div>
            <div id="specials-container" style="margin-top:10px;">
                <div class="special-node">X<br><span id="cd-x">READY</span></div>
                <div class="special-node">N<br><span id="cd-n">READY</span></div>
                <div class="special-node">Z<br><span id="cd-z">READY</span></div>
            </div>
        \`;
        document.body.appendChild(hud);
    };

    const createArena = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        for (let i = 0; i < 300; i++) {
            const h = 100 + Math.random() * 500;
            const b = new THREE.Mesh(new THREE.BoxGeometry(80, h, 80), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
            b.position.set((Math.random()-0.5)*4000, h/2, (Math.random()-0.5)*4000);
            if (b.position.length() < 300) continue;
            scene.add(b);
        }
    };

    const createBeveledHands = () => {
        const createHand = (side) => {
            const group = new THREE.Group();
            const fist = createBeveledBox(0.8, 0.8, 1.2, 0x1e88e5);
            group.add(fist);
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
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
        const head = createBeveledBox(1.5, 1.5, 1.5, 0xffdbac); head.position.y = 7.5;
        const torso = createBeveledBox(3, 3.5, 1.5, 0xffffff); torso.position.y = 5.0;
        omni.add(head); omni.add(torso);
        
        const capeSegments = [];
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.62, 0.1, 0xb71c1c); 
            seg.position.set(0, 7.5 - (i * 0.6), -0.9);
            omni.add(seg); capeSegments.push(seg);
        }

        const lPivot = new THREE.Group(); lPivot.position.set(-2.1, 6.5, 0);
        const lArm = createBeveledBox(1, 3.5, 1, 0xffffff); lArm.position.y = -1.75; lPivot.add(lArm);
        const rPivot = new THREE.Group(); rPivot.position.set(2.1, 6.5, 0);
        const rArm = createBeveledBox(1, 3.5, 1, 0xffffff); rArm.position.y = -1.75; rPivot.add(rArm);
        omni.add(lPivot); omni.add(rPivot);

        omni.position.set((Math.random()-0.5)*600, 150, (Math.random()-0.5)*600);
        scene.add(omni);
        
        boss = { 
            mesh: omni, torso, hp: 100000, maxHp: 100000, 
            animTime: 0, vel: new THREE.Vector3(), gravity: 0, attackTimer: 0,
            leftArm: lPivot, rightArm: rPivot, capeSegments
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
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.3, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            this.points.frustumCulled = false;
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 80; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*15 + dir.x*10, Math.random()*15 + dir.y*10, (Math.random()-0.5)*15 + dir.z*10);
                    n++;
                }
            }
        }
        update(dt) {
            const posAttr = this.geometry.getAttribute('position');
            for(let i=0; i<this.count; i++) {
                if(this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.5;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.5;
                } else { this.positions[i*3] = 10000; }
            }
            posAttr.needsUpdate = true;
        }
    }

    const triggerSpecial = (key) => {
        const spec = state.specials[key];
        if (spec.timer > 0 || !boss) return;
        spec.timer = spec.cd;

        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        if (key === 'X') { // Thunderclap
            boss.hp -= 20000;
            boss.gravity = -2.5; 
            bloodSystem.emit(boss.mesh.position, fwd.multiplyScalar(2));
        } else if (key === 'N') { // Sonic Dash
            camera.position.add(fwd.multiplyScalar(50));
        } else if (key === 'Z') { // Eye Beam
            boss.hp -= 35000;
            bloodSystem.emit(boss.mesh.position, fwd.multiplyScalar(8));
        }
        checkBossDeath();
    };

    const checkBossDeath = () => {
        if (boss && boss.hp <= 0) {
            scene.remove(boss.mesh);
            boss = null;
            state.player.xp += 2500;
            if (state.player.xp >= state.player.nextXp) {
                state.player.level++;
                state.player.xp = 0;
                state.player.nextXp *= 1.2;
                const lvlEl = document.getElementById('p-lvl');
                if(lvlEl) lvlEl.innerText = state.player.level;
            }
            const xpFill = document.getElementById('p-xp-fill');
            if(xpFill) xpFill.style.width = \`\${(state.player.xp / state.player.nextXp) * 100}%\`;
            setTimeout(spawnBeveledOmniMan, 4000);
        }
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 3.0;
        setTimeout(() => h.position.z = -2.0, 70);
        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist < state.player.punchRange) {
                boss.hp -= 5000;
                boss.gravity = -1.5; 
                const worldPos = new THREE.Vector3();
                boss.torso.getWorldPosition(worldPos);
                bloodSystem.emit(worldPos, new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(5));
                checkBossDeath();
            }
        }
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            const k = e.key.toUpperCase();
            if(k === ' ') state.timeDilation = 0.2;
            if(e.shiftKey) state.keys.shift = true;
            if(state.specials[k]) triggerSpecial(k);
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if(e.key === ' ') state.timeDilation = 1.0;
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
            camera.position.add(dir.multiplyScalar(state.player.speed * (state.keys.shift ? 4 : 1) * dt * 60));
        }

        if (boss) {
            boss.animTime += dt;
            boss.mesh.lookAt(camera.position);
            
            if (boss.mesh.position.y > 1) {
                boss.gravity += 0.05;
                boss.mesh.position.y -= boss.gravity;
            } else {
                boss.mesh.position.y = 1;
                boss.gravity = 0;
            }

            ['X','N','Z'].forEach(k => {
                const s = state.specials[k];
                if(s.timer > 0) {
                    s.timer -= dt;
                    const el = document.getElementById(\`cd-\${k.toLowerCase()}\`);
                    if(el) el.innerText = Math.ceil(s.timer) + 's';
                } else {
                    const el = document.getElementById(\`cd-\${k.toLowerCase()}\`);
                    if(el) el.innerText = 'READY';
                }
            });

            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist < 45) {
                const cycle = Math.sin(boss.animTime * 14);
                boss.leftArm.rotation.x = -Math.PI / 2 - (cycle * 0.8);
                boss.rightArm.rotation.x = -Math.PI / 2 + (cycle * 0.8);
            }
            
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.3), 0.04);
            boss.mesh.position.add(boss.vel);
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
