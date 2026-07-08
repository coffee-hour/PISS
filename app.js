import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.8: 'EXTREME GORE & EXECUTION'
 * 1. Reversion: Restored clean boss build from v5.4.6.
 * 2. Extreme Gore: Increased particle density to 50 per hit (5x increase).
 * 3. Death Animation: Implemented "Rip Apart" logic for boss death.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0, isDead: false },
        boss: { 
            hp: 1000, maxHp: 1000, animTime: 0, vel: new THREE.Vector3(), 
            isPunching: false, pursuitSpeed: 0.35, stopDist: 8.0, 
            isDead: false, isRipping: false, ripTimer: 0, respawnTimer: 0, boundaryRadius: 1500 
        },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let bossGroup = null;
    let bossParts = { rArm: null, lArm: null, lLeg: null, rLeg: null, head: null, torso: null, cape: null };
    let playerHands = { left: null, right: null };
    let particles = [];

    const createBlock = (w, h, d, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        console.log('Sovereign: Initializing v5.4.8 Extreme Gore & Execution...');
        
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('overlay')) div.remove(); });
        document.querySelectorAll('style').forEach(s => { if (s.innerHTML.includes('hud') || s.innerHTML.includes('overlay')) s.remove(); });

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 50, 150);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(50, 300, 50);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(5000, 100, 0x888888, 0x333333);
        grid.position.y = 0.05;
        scene.add(grid);

        for (let i = 0; i < 100; i++) {
            const h = 50 + Math.random() * 400;
            const b = createBlock(60, h, 60, 0x555555);
            b.position.set((Math.random()-0.5)*4000, h/2, (Math.random()-0.5)*4000);
            if (b.position.length() < 200) continue;
            scene.add(b);
        }

        createPlayerHands();
        spawnOmniMan();
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const deployHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; width: 250px; pointer-events: none; font-family: 'Courier New', monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; text-align: right; }
            .bar-container { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; transition: width 0.2s; float: right; }
            #p-fill { background: #c62828; width: 100%; }
            #o-fill { background: #ffbf00; width: 100%; }
            .label { font-size: 10px; font-weight: bold; }
            #status-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); color: #c62828; display: none; flex-direction: column; justify-content: center; align-items: center; font-family: 'Courier New', monospace; z-index: 200; pointer-events: auto; }
            #status-msg { font-size: 48px; font-weight: bold; margin-bottom: 20px; }
            #respawn-timer { position: fixed; bottom: 40px; width: 100%; text-align: center; color: #ffbf00; font-family: monospace; font-size: 14px; display: none; }
        `;
        document.head.appendChild(style);

        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div class="label">PLAYER HP</div>
            <div class="bar-container"><div id="p-fill" class="fill"></div></div>
            <div id="boss-hud-section">
                <div class="label" style="margin-top:10px;">OMNI-MAN HP</div>
                <div class="bar-container"><div id="o-fill" class="fill"></div></div>
            </div>
        `;
        document.body.appendChild(hud);

        const overlay = document.createElement('div');
        overlay.id = 'status-overlay';
        overlay.innerHTML = `<div id="status-msg">MISSION FAILED</div><div style="color:#ffbf00; cursor:pointer;" onclick="location.reload()">RELOAD SIMULATION</div>`;
        document.body.appendChild(overlay);

        const respawn = document.createElement('div');
        respawn.id = 'respawn-timer';
        respawn.innerText = 'TARGET RESPAWN IN: 15s';
        document.body.appendChild(respawn);
    };

    const createPlayerHands = () => {
        const createHand = (side) => {
            const h = createBlock(0.8, 0.8, 1.5, 0x1e88e5);
            h.position.set(side === 'left' ? -2.2 : 2.2, -1.8, -2.5);
            camera.add(h);
            return h;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnOmniMan = () => {
        const group = new THREE.Group();
        
        bossParts.head = createBlock(2.2, 2.2, 2.2, 0xffdbac); bossParts.head.position.y = 8; group.add(bossParts.head);
        const hair = createBlock(2.4, 0.6, 2.4, 0x222222); hair.position.y = 1.2; bossParts.head.add(hair);
        const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, -0.5, 1.1); bossParts.head.add(stache);
        
        bossParts.torso = createBlock(4, 4.5, 2, 0xffffff); bossParts.torso.position.y = 4.75; group.add(bossParts.torso);
        const emblemB = createBlock(2.2, 2.7, 0.1, 0xb71c1c); emblemB.position.set(0, 0.25, 1.05); bossParts.torso.add(emblemB);
        const emblemD = createBlock(0.8, 2.7, 0.15, 0xffffff); emblemD.position.set(0, 0.25, 1.06); bossParts.torso.add(emblemD);
        
        const createArm = (x) => {
            const a = new THREE.Group();
            const u = createBlock(1.8, 3, 1.8, 0xffffff); u.position.y = -1.5; a.add(u);
            const g = createBlock(1.9, 1.5, 1.9, 0xb71c1c); g.position.y = -3.5; a.add(g);
            a.position.set(x, 7, 0); return a;
        };
        bossParts.rArm = createArm(3); group.add(bossParts.rArm);
        bossParts.lArm = createArm(-3); group.add(bossParts.lArm);
        
        const createLeg = (x) => {
            const l = new THREE.Group();
            const u = createBlock(1.8, 3, 1.8, 0xffffff); u.position.y = -1.5; l.add(u);
            const b = createBlock(1.9, 1.5, 1.9, 0xb71c1c); b.position.y = -3.5; l.add(b);
            l.position.set(x, 2.5, 0); return l;
        };
        bossParts.rLeg = createLeg(1.1); group.add(bossParts.rLeg);
        bossParts.lLeg = createLeg(-1.1); group.add(bossParts.lLeg);
        
        bossParts.cape = createBlock(4.5, 8, 0.3, 0xb71c1c); bossParts.cape.position.set(0, 4, -1.2); group.add(bossParts.cape);
        
        group.position.set(0, 10, -100);
        scene.add(group);
        bossGroup = group;
        state.boss.isDead = false;
        state.boss.isRipping = false;
        state.boss.hp = state.boss.maxHp;
        
        const bossHUD = document.getElementById('boss-hud-section');
        if(bossHUD) bossHUD.style.display = 'block';
        const oFill = document.getElementById('o-fill');
        if(oFill) oFill.style.width = '100%';
    };

    const emitBlood = (pos, count = 50) => {
        for(let i=0; i<count; i++) {
            const p = createBlock(0.2, 0.2, 0.2, 0xb71c1c);
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.8, Math.random()*0.8, (Math.random()-0.5)*0.8);
            scene.add(p);
            particles.push({ mesh: p, vel, life: 1.5 });
        }
    };

    const performAttack = () => {
        if (state.player.isDead) return;
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 4.0;
        setTimeout(() => h.position.z = -2.5, 80);

        if (bossGroup && !state.boss.isDead && camera.position.distanceTo(bossGroup.position) < 18) {
            const wp = new THREE.Vector3(); bossGroup.getWorldPosition(wp); wp.y += 5;
            emitBlood(wp, 50); // 5x gore increase
            state.boss.vel.add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1.5));
            state.boss.hp -= 40;
            const oFill = document.getElementById('o-fill');
            if(oFill) oFill.style.width = (state.boss.hp / state.boss.maxHp * 100) + '%';
            
            if (state.boss.hp <= 0) {
                state.boss.isDead = true;
                state.boss.isRipping = true;
                state.boss.ripTimer = 3.0;
                const bossHUD = document.getElementById('boss-hud-section');
                if(bossHUD) bossHUD.style.display = 'none';
            }
        }
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => { 
            const k = e.key.toLowerCase();
            if(state.keys.hasOwnProperty(k)) state.keys[k] = true;
            if(e.code === 'Space') state.keys[' '] = true;
            if(e.code === 'ControlLeft') state.keys.control = true;
        });
        document.addEventListener('keyup', (e) => { 
            const k = e.key.toLowerCase();
            if(state.keys.hasOwnProperty(k)) state.keys[k] = false;
            if(e.code === 'Space') state.keys[' '] = false;
            if(e.code === 'ControlLeft') state.keys.control = false;
        });
        document.addEventListener('mousedown', () => { if(!state.isLocked && !state.player.isDead) document.body.requestPointerLock(); else performAttack(); });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked && !state.player.isDead) {
                state.yaw -= e.movementX * 0.003; state.pitch -= e.movementY * 0.003;
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
        const dt = Math.min(clock.getDelta(), 0.1);

        if(state.isLocked && !state.player.isDead) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * dt * 60));
            if(state.keys[' ']) camera.position.y += state.player.flightSpeed * dt * 60;
            if(state.keys.control) camera.position.y -= state.player.flightSpeed * dt * 60;
            camera.position.y = Math.max(5, camera.position.y);
        }

        // Death/Respawn Logic
        if (state.boss.isDead) {
            if (state.boss.isRipping) {
                state.boss.ripTimer -= dt;
                
                // RIPPING ANIMATION: Scale components away from center
                const speed = 10 * dt;
                bossParts.head.position.y += speed * 2;
                bossParts.head.rotation.x += speed;
                bossParts.rArm.position.x += speed * 2;
                bossParts.lArm.position.x -= speed * 2;
                bossParts.rLeg.position.x += speed;
                bossParts.rLeg.position.y -= speed * 2;
                bossParts.lLeg.position.x -= speed;
                bossParts.lLeg.position.y -= speed * 2;
                bossParts.cape.position.z -= speed * 3;
                bossParts.torso.scale.multiplyScalar(0.98);
                
                const wp = new THREE.Vector3(); bossGroup.getWorldPosition(wp);
                emitBlood(wp, 10); // Continuous blood spray during rip
                
                if (state.boss.ripTimer <= 0) {
                    state.boss.isRipping = false;
                    scene.remove(bossGroup);
                    bossGroup = null;
                    state.boss.respawnTimer = 15;
                    const respawnHUD = document.getElementById('respawn-timer');
                    if(respawnHUD) respawnHUD.style.display = 'block';
                }
            } else {
                state.boss.respawnTimer -= dt;
                const respawnHUD = document.getElementById('respawn-timer');
                if(respawnHUD) respawnHUD.innerText = `TARGET RESPAWN IN: ${Math.ceil(state.boss.respawnTimer)}s`;
                if (state.boss.respawnTimer <= 0) {
                    if(respawnHUD) respawnHUD.style.display = 'none';
                    spawnOmniMan();
                }
            }
        }

        if (bossGroup && !state.boss.isDead) {
            state.boss.animTime += dt;
            const floatOffset = Math.sin(state.boss.animTime * 2) * 1.5;
            
            const distFromOrigin = bossGroup.position.length();
            const playerDistFromOrigin = camera.position.length();
            
            if (playerDistFromOrigin < state.boss.boundaryRadius) {
                const toPlayer = camera.position.clone().sub(bossGroup.position);
                const dist = toPlayer.length();
                bossGroup.position.y = THREE.MathUtils.lerp(bossGroup.position.y, camera.position.y + floatOffset, 0.08);
                if (dist > state.boss.stopDist) {
                    bossGroup.position.add(toPlayer.normalize().multiplyScalar(state.boss.pursuitSpeed * dt * 60));
                }
                bossGroup.lookAt(camera.position.x, bossGroup.position.y, camera.position.z);
                
                if (Math.sin(state.boss.animTime * 5) > 0.85 && !state.boss.isPunching && dist < 15) {
                    state.boss.isPunching = true;
                    const arm = Math.random() > 0.5 ? bossParts.rArm : bossParts.lArm;
                    arm.rotation.x = -Math.PI / 2;
                    setTimeout(() => {
                        arm.position.z += 6;
                        if (dist < 10 && !state.player.isDead) {
                            state.player.hp -= 10;
                            const pFill = document.getElementById('p-fill');
                            if(pFill) pFill.style.width = Math.max(0, state.player.hp) + '%';
                            if (state.player.hp <= 0) {
                                state.player.isDead = true;
                                document.getElementById('status-overlay').style.display = 'flex';
                                document.exitPointerLock();
                            }
                        }
                        setTimeout(() => {
                            arm.rotation.x = 0; arm.position.z = 0;
                            state.boss.isPunching = false;
                        }, 150);
                    }, 80);
                }
            } else {
                const toOrigin = new THREE.Vector3(0, 20, 0).sub(bossGroup.position);
                if (toOrigin.length() > 10) {
                    bossGroup.position.add(toOrigin.normalize().multiplyScalar(state.boss.pursuitSpeed * dt * 30));
                    bossGroup.lookAt(0, 20, 0);
                }
            }
            
            bossGroup.position.add(state.boss.vel);
            state.boss.vel.multiplyScalar(0.92);
        }

        for(let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]; p.life -= dt;
            p.mesh.position.add(p.vel); p.vel.y -= 0.015;
            if(p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
        }

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
