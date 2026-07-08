import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.2: 'BLOOD & CHARACTER POLISH'
 * 1. Omni-Man v2: Added red gloves, boots, chest emblem, and the signature mustache.
 * 2. Combat: Fists now perform a forward thrust. Added red blood particle effects on impact.
 * 3. HUD: Re-implemented the Amber HUD with dual Health Bars (Player & Omni-Man).
 * 4. Physics: Maintained momentum-based knockback and hover AI.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, speed: 3.5, height: 10.0 },
        boss: { hp: 1000, maxHp: 1000, animTime: 0, vel: new THREE.Vector3(), isPunching: false },
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
        console.log('Sovereign: Initializing v5.4.2 Blood & Polish...');
        
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

        // Floor
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(2000, 50, 0x888888, 0x333333);
        grid.position.y = 0.05;
        scene.add(grid);

        createPlayerHands();
        spawnPolishedOmniMan();
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const deployHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; left: 20px; width: 300px; pointer-events: none; font-family: 'Courier New', monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; }
            .bar-container { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 12px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; transition: width 0.2s; }
            #p-fill { background: #c62828; width: 100%; }
            #o-fill { background: #ffbf00; width: 100%; }
            .label { font-size: 10px; font-weight: bold; }
        `;
        document.head.appendChild(style);

        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div class="label">PLAYER</div>
            <div class="bar-container"><div id="p-fill" class="fill"></div></div>
            <div class="label" style="margin-top:10px;">OMNI-MAN</div>
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

    const spawnPolishedOmniMan = () => {
        const group = new THREE.Group();
        
        // Head & Mustache
        const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
        const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, 7.5, 1.1); group.add(stache);
        
        // Torso & Emblem
        const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
        const emblem = createBlock(2, 2.5, 0.1, 0xb71c1c); emblem.position.set(0, 5, 1.05); group.add(emblem);
        
        // Arms & Gloves
        const createArm = (x) => {
            const a = new THREE.Group();
            const upper = createBlock(1.8, 3, 1.8, 0xffffff); upper.position.y = -1.5; a.add(upper);
            const glove = createBlock(1.9, 1.5, 1.9, 0xb71c1c); glove.position.y = -3.5; a.add(glove);
            a.position.set(x, 7, 0);
            return a;
        };
        bossParts.rArm = createArm(3); group.add(bossParts.rArm);
        bossParts.lArm = createArm(-3); group.add(bossParts.lArm);

        // Legs & Boots
        const createLeg = (x) => {
            const l = new THREE.Group();
            const upper = createBlock(1.8, 3, 1.8, 0x111111); upper.position.y = -1.5; l.add(upper);
            const boot = createBlock(1.9, 1.5, 1.9, 0xb71c1c); boot.position.y = -3.5; l.add(boot);
            l.position.set(x, 2.5, 0);
            return l;
        };
        group.add(createLeg(1.1)); group.add(createLeg(-1.1));
        
        const cape = createBlock(4.5, 8, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);

        group.position.set(0, 5, -60);
        scene.add(group);
        bossGroup = group;
    };

    const emitBlood = (pos) => {
        for(let i=0; i<15; i++) {
            const p = createBlock(0.3, 0.3, 0.3, 0xb71c1c);
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
        setTimeout(() => h.position.z = -2.5, 100);

        if (bossGroup && camera.position.distanceTo(bossGroup.position) < 15) {
            const hitPos = bossGroup.position.clone().add(new THREE.Vector3(0, 5, 0));
            emitBlood(hitPos);
            state.boss.vel.add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(3.0));
            state.boss.hp -= 25;
            document.getElementById('o-fill').style.width = (state.boss.hp / state.boss.maxHp * 100) + '%';
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
            const floatOffset = Math.sin(state.boss.animTime * 2) * 2.0;
            bossGroup.position.y = THREE.MathUtils.lerp(bossGroup.position.y, 5.0 + floatOffset, 0.1);
            bossGroup.position.add(state.boss.vel);
            state.boss.vel.multiplyScalar(0.92);
            bossGroup.lookAt(camera.position.x, bossGroup.position.y, camera.position.z);
            
            // Forward Thrust Boss Punch
            if (Math.sin(state.boss.animTime * 3) > 0.85 && !state.boss.isPunching) {
                state.boss.isPunching = true;
                const arm = Math.random() > 0.5 ? bossParts.rArm : bossParts.lArm;
                const origZ = arm.position.z;
                arm.position.z += 5;
                setTimeout(() => { arm.position.z = origZ; state.boss.isPunching = false; }, 200);
            }
        }

        // Particle Lifecycle
        for(let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            p.mesh.position.add(p.vel);
            p.vel.y -= 0.02;
            if(p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
        }

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
