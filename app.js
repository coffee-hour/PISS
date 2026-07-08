import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.4: 'CHARACTER RIG & ANIMATION OVERHAUL'
 * 1. Omni-Man v3: 
 *    - Updated legs to White (matching upper suit).
 *    - Added Hair geometry (Black blocky hair cap).
 *    - Refined High-Res chest emblem (Composite box structure).
 * 2. Combat Animation: 
 *    - Implemented a 3-step punch arc: 90-degree Upward rotation -> Forward Thrust -> Return Down.
 * 3. Mechanics: Maintained pursuit AI, blood particles, and top-right HUD.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, speed: 4.2, height: 10.0 },
        boss: { hp: 1000, maxHp: 1000, animTime: 0, vel: new THREE.Vector3(), isPunching: false, pursuitSpeed: 0.15 },
        keys: { w: false, a: false, s: false, d: false },
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
        console.log('Sovereign: Initializing v5.4.4 Character & Animation Overhaul...');
        
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud')) div.remove(); });
        document.querySelectorAll('style').forEach(s => { if (s.innerHTML.includes('hud')) s.remove(); });

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 2000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 50);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(50, 150, 50);
        sunLight.castShadow = true;
        scene.add(sunLight);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(2000, 50, 0x888888, 0x333333);
        grid.position.y = 0.05;
        scene.add(grid);

        for (let i = 0; i < 60; i++) {
            const h = 50 + Math.random() * 250;
            const b = createBlock(40, h, 40, 0x555555);
            b.position.set((Math.random()-0.5)*1800, h/2, (Math.random()-0.5)*1800);
            if (b.position.length() < 100) continue;
            scene.add(b);
        }

        createPlayerHands();
        spawnOverhauledOmniMan();
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
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div class="label">PLAYER HP</div>
            <div class="bar-container"><div id="p-fill" class="fill"></div></div>
            <div class="label" style="margin-top:10px;">OMNI-MAN HP</div>
            <div class="bar-container"><div id="o-fill" class="fill"></div></div>
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

    const spawnOverhauledOmniMan = () => {
        const group = new THREE.Group();
        
        // Head & Mustache & Hair
        const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
        const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, 7.5, 1.1); group.add(stache);
        const hair = createBlock(2.4, 0.6, 2.4, 0x222222); hair.position.y = 9.2; group.add(hair);
        
        // Torso & Refined Emblem
        const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
        const emblemBase = createBlock(2.2, 2.7, 0.1, 0xb71c1c); emblemBase.position.set(0, 5, 1.05); group.add(emblemBase);
        const emblemDetail = createBlock(0.8, 2.7, 0.15, 0xffffff); emblemDetail.position.set(0, 5, 1.06); group.add(emblemDetail);
        
        // Arms & Gloves
        const createArm = (x) => {
            const a = new THREE.Group();
            const upper = createBlock(1.8, 3, 1.8, 0xffffff); upper.position.y = -1.5; a.add(upper);
            const glove = createBlock(1.9, 1.5, 1.9, 0xb71c1c); glove.position.y = -3.5; a.add(glove);
            a.position.set(x, 7, 0); return a;
        };
        bossParts.rArm = createArm(3); group.add(bossParts.rArm);
        bossParts.lArm = createArm(-3); group.add(bossParts.lArm);

        // Legs (Now White) & Boots
        const createLeg = (x) => {
            const l = new THREE.Group();
            const upper = createBlock(1.8, 3, 1.8, 0xffffff); upper.position.y = -1.5; l.add(upper);
            const boot = createBlock(1.9, 1.5, 1.9, 0xb71c1c); boot.position.y = -3.5; l.add(boot);
            l.position.set(x, 2.5, 0); return l;
        };
        group.add(createLeg(1.1)); group.add(createLeg(-1.1));
        
        const cape = createBlock(4.5, 8, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);

        group.position.set(0, 5, -100);
        scene.add(group);
        bossGroup = group;
    };

    const emitBlood = (pos) => {
        for(let i=0; i<10; i++) {
            const p = createBlock(0.2, 0.2, 0.2, 0xb71c1c);
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.4, Math.random()*0.4, (Math.random()-0.5)*0.4);
            scene.add(p);
            particles.push({ mesh: p, vel, life: 0.8 });
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
            state.boss.vel.add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1.5));
            state.boss.hp -= 20;
            const oFill = document.getElementById('o-fill');
            if(oFill) oFill.style.width = (state.boss.hp / state.boss.maxHp * 100) + '%';
        }
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true; });
        document.addEventListener('keyup', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false; });
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
            camera.position.y = state.player.height;
        }

        if (bossGroup) {
            state.boss.animTime += dt;
            const floatOffset = Math.sin(state.boss.animTime * 2) * 1.5;
            bossGroup.position.y = THREE.MathUtils.lerp(bossGroup.position.y, 5.0 + floatOffset, 0.1);
            
            const toPlayer = camera.position.clone().sub(bossGroup.position);
            const dist = toPlayer.length();
            if (dist > 15) {
                bossGroup.position.add(toPlayer.normalize().multiplyScalar(state.boss.pursuitSpeed * dt * 60));
            }

            bossGroup.position.add(state.boss.vel);
            state.boss.vel.multiplyScalar(0.9);
            bossGroup.lookAt(camera.position.x, bossGroup.position.y, camera.position.z);
            
            // Overhauled 3-Step Arc Punch Animation
            const punchCycle = (state.boss.animTime * 4) % (Math.PI * 2);
            if (punchCycle > 0 && punchCycle < 1.5 && !state.boss.isPunching && dist < 20) {
                state.boss.isPunching = true;
                const arm = Math.random() > 0.5 ? bossParts.rArm : bossParts.lArm;
                
                // Step 1: Upward 90deg Rotation
                arm.rotation.x = -Math.PI / 2;
                
                setTimeout(() => {
                    // Step 2: Forward Thrust
                    arm.position.z += 5;
                    if (dist < 12) {
                        state.player.hp -= 3;
                        const pFill = document.getElementById('p-fill');
                        if(pFill) pFill.style.width = (state.player.hp / state.player.maxHp * 100) + '%';
                    }
                    
                    setTimeout(() => {
                        // Step 3: Return Down
                        arm.rotation.x = 0;
                        arm.position.z = 0;
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
