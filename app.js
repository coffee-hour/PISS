import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.5: 'PROXIMITY & FLIGHT RESTORE'
 * 1. Boss AI: Calibrated stopping distance. Omni-Man now closes the gap to 8 units to ensure melee strikes land.
 * 2. Flight Mechanic: Restored full 3D flight for the player. 
 *    - SPACE to ascend.
 *    - LEFT-CTRL to descend.
 *    - WASD for horizontal translation.
 * 3. Mechanics: Maintained 3-step arc punches, blood particles, and top-right HUD.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        boss: { hp: 1000, maxHp: 1000, animTime: 0, vel: new THREE.Vector3(), isPunching: false, pursuitSpeed: 0.18, stopDist: 8.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let bossGroup = null;
    let bossParts = { rArm: null, lArm: null };
    let playerHands = { left: null, right: null };
    let particles = [];

    const createBlock = (w, h, d, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        console.log('Sovereign: Initializing v5.4.5 Proximity & Flight...');
        
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud')) div.remove(); });
        document.querySelectorAll('style').forEach(s => { if (s.innerHTML.includes('hud')) s.remove(); });

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 2500);

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

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(3000, 60, 0x888888, 0x333333);
        grid.position.y = 0.05;
        scene.add(grid);

        // Minimalist City
        for (let i = 0; i < 80; i++) {
            const h = 50 + Math.random() * 300;
            const b = createBlock(50, h, 50, 0x555555);
            b.position.set((Math.random()-0.5)*2500, h/2, (Math.random()-0.5)*2500);
            if (b.position.length() < 150) continue;
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
            #flight-status { font-size: 9px; color: #ffbf00; margin-top: 5px; opacity: 0.8; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div class="label">BIOLOGICAL STATUS: PLAYER</div>
            <div class="bar-container"><div id="p-fill" class="fill"></div></div>
            <div class="label" style="margin-top:10px;">TARGET: OMNI-MAN</div>
            <div class="bar-container"><div id="o-fill" class="fill"></div></div>
            <div id="flight-status">FLIGHT MODE ACTIVE [SPACE/CTRL]</div>
        `;
        document.body.appendChild(hud);
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
        const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
        const hair = createBlock(2.4, 0.6, 2.4, 0x222222); hair.position.y = 9.2; group.add(hair);
        const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, 7.5, 1.1); group.add(stache);
        const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
        const emblemB = createBlock(2.2, 2.7, 0.1, 0xb71c1c); emblemB.position.set(0, 5, 1.05); group.add(emblemB);
        const emblemD = createBlock(0.8, 2.7, 0.15, 0xffffff); emblemD.position.set(0, 5, 1.06); group.add(emblemD);
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
        group.add(createLeg(1.1)); group.add(createLeg(-1.1));
        const cape = createBlock(4.5, 8, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);
        group.position.set(0, 10, -100);
        scene.add(group);
        bossGroup = group;
    };

    const emitBlood = (pos) => {
        for(let i=0; i<12; i++) {
            const p = createBlock(0.2, 0.2, 0.2, 0xb71c1c);
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.5, Math.random()*0.5, (Math.random()-0.5)*0.5);
            scene.add(p);
            particles.push({ mesh: p, vel, life: 1.0 });
        }
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 4.0;
        setTimeout(() => h.position.z = -2.5, 80);

        if (bossGroup && camera.position.distanceTo(bossGroup.position) < 18) {
            const wp = new THREE.Vector3(); bossGroup.getWorldPosition(wp); wp.y += 5;
            emitBlood(wp);
            state.boss.vel.add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1.8));
            state.boss.hp -= 20;
            const oFill = document.getElementById('o-fill');
            if(oFill) oFill.style.width = (state.boss.hp / state.boss.maxHp * 100) + '%';
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
        document.addEventListener('mousedown', () => { if(!state.isLocked) document.body.requestPointerLock(); else performAttack(); });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
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

        if(state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * dt * 60));

            // FLIGHT RE-IMPLEMENTATION
            if(state.keys[' ']) camera.position.y += state.player.flightSpeed * dt * 60;
            if(state.keys.control) camera.position.y -= state.player.flightSpeed * dt * 60;
            camera.position.y = Math.max(5, camera.position.y);
        }

        if (bossGroup) {
            state.boss.animTime += dt;
            const floatOffset = Math.sin(state.boss.animTime * 2) * 1.5;
            const targetY = camera.position.y + floatOffset;
            bossGroup.position.y = THREE.MathUtils.lerp(bossGroup.position.y, targetY, 0.08);
            
            const toPlayer = camera.position.clone().sub(bossGroup.position);
            const dist = toPlayer.length();
            
            // PROXIMITY CALIBRATION: Close the gap to melee range
            if (dist > state.boss.stopDist) {
                bossGroup.position.add(toPlayer.normalize().multiplyScalar(state.boss.pursuitSpeed * dt * 60));
            }

            bossGroup.position.add(state.boss.vel);
            state.boss.vel.multiplyScalar(0.92);
            bossGroup.lookAt(camera.position.x, bossGroup.position.y, camera.position.z);
            
            if (Math.sin(state.boss.animTime * 4) > 0.8 && !state.boss.isPunching && dist < 15) {
                state.boss.isPunching = true;
                const arm = Math.random() > 0.5 ? bossParts.rArm : bossParts.lArm;
                arm.rotation.x = -Math.PI / 2; // Up
                setTimeout(() => {
                    arm.position.z += 5; // Thrust
                    if (dist < 10) {
                        state.player.hp -= 4;
                        const pFill = document.getElementById('p-fill');
                        if(pFill) pFill.style.width = (state.player.hp / state.player.maxHp * 100) + '%';
                    }
                    setTimeout(() => {
                        arm.rotation.x = 0; arm.position.z = 0;
                        state.boss.isPunching = false;
                    }, 150);
                }, 100);
            }
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
