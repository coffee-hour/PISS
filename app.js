import * as THREE from 'three';

/**
 * INVINCIBLE SHOWDOWN v5.4.7
 * 1. Player: Increased movement speed.
 * 2. Settings: Top-left bar with 3 Gore Levels (Low/Med/High).
 * 3. Game Modes: Omni-Man (Boss), Flaxan Invasion (Swarm), Variant (Civilians).
 * 4. Secrets: Password 'CHINA' turns blood/gore white.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, maxHp: 100, speed: 7.5, height: 10.0, flightSpeed: 6.0, isDead: false },
        gameMode: 'boss', // boss, swarm, variant
        goreLevel: 'high', // low, med, high
        goreColor: 0xb71c1c,
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let enemies = [];
    let civilians = [];
    let playerHands = { left: null, right: null };
    let particles = [];

    const createBlock = (w, h, d, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        console.log('Invincible Showdown: Initializing...');
        
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('overlay') || div.id === 'settings-bar') div.remove(); });
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
        deployUI();
        setMode('boss');
        setupInput();
        
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const deployUI = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; width: 250px; pointer-events: none; font-family: 'Courier New', monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; text-align: right; }
            #settings-bar { position: fixed; top: 20px; left: 20px; z-index: 150; font-family: monospace; display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.5); padding: 10px; color: #fff; }
            .bar-container { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; transition: width 0.2s; float: right; }
            #p-fill { background: #c62828; width: 100%; }
            .label { font-size: 10px; font-weight: bold; }
            select, input { background: #222; color: #fff; border: 1px solid #ffbf00; font-family: monospace; font-size: 12px; padding: 2px; }
            #status-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); color: #c62828; display: none; flex-direction: column; justify-content: center; align-items: center; font-family: 'Courier New', monospace; z-index: 200; pointer-events: auto; }
        `;
        document.head.appendChild(style);

        const settings = document.createElement('div');
        settings.id = 'settings-bar';
        settings.innerHTML = `
            <div style="font-weight:bold; color:#ffbf00; margin-bottom:5px;">INVINCIBLE SHOWDOWN</div>
            <div>
                MODE: <select id="mode-select">
                    <option value="boss">OMNI-MAN FIGHT</option>
                    <option value="swarm">FLAXAN INVASION</option>
                    <option value="variant">VARIANT (CIVILIANS)</option>
                </select>
            </div>
            <div>
                GORE: <select id="gore-select">
                    <option value="low">LOW</option>
                    <option value="med">MEDIUM</option>
                    <option value="high" selected>HIGH</option>
                </select>
            </div>
            <div>
                SECRET: <input type="password" id="secret-input" placeholder="???">
            </div>
        `;
        document.body.appendChild(settings);

        document.getElementById('mode-select').onchange = (e) => setMode(e.target.value);
        document.getElementById('gore-select').onchange = (e) => state.goreLevel = e.target.value;
        document.getElementById('secret-input').oninput = (e) => {
            if (e.target.value.toUpperCase() === 'CHINA') {
                state.goreColor = 0xffffff;
                console.log("CENSORSHIP ENABLED");
            } else {
                state.goreColor = 0xb71c1c;
            }
        };

        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div class="label">PLAYER HP</div>
            <div class="bar-container"><div id="p-fill" class="fill"></div></div>
        `;
        document.body.appendChild(hud);

        const overlay = document.createElement('div');
        overlay.id = 'status-overlay';
        overlay.innerHTML = `<div id="status-msg">MISSION FAILED</div><div style="color:#ffbf00; cursor:pointer;" onclick="location.reload()">RELOAD SIMULATION</div>`;
        document.body.appendChild(overlay);
    };

    const setMode = (mode) => {
        state.gameMode = mode;
        enemies.forEach(e => scene.remove(e.group));
        enemies = [];
        civilians.forEach(c => scene.remove(c.group));
        civilians = [];

        if (mode === 'boss') {
            spawnOmniMan();
        } else if (mode === 'swarm') {
            for(let i=0; i<20; i++) spawnFlaxan();
        } else if (mode === 'variant') {
            for(let i=0; i<50; i++) spawnCivilian();
        }
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
        group.add(createBlock(2.2, 2.2, 2.2, 0xffdbac).set({position: new THREE.Vector3(0, 8, 0)}));
        group.add(createBlock(4, 4.5, 2, 0xffffff).set({position: new THREE.Vector3(0, 4.75, 0)}));
        group.add(createBlock(4.5, 8, 0.3, 0xb71c1c).set({position: new THREE.Vector3(0, 4, -1.2)}));
        group.position.set(0, 10, -100);
        scene.add(group);
        enemies.push({ group, hp: 1000, type: 'boss', speed: 0.35, dist: 8 });
    };

    const spawnFlaxan = () => {
        const group = new THREE.Group();
        group.add(createBlock(3, 4, 2, 0x4caf50));
        group.position.set((Math.random()-0.5)*1000, 5, (Math.random()-0.5)*1000);
        scene.add(group);
        enemies.push({ group, hp: 100, type: 'swarm', speed: 0.2, dist: 5 });
    };

    const spawnCivilian = () => {
        const group = new THREE.Group();
        group.add(createBlock(2, 4, 1.5, Math.random() * 0xffffff));
        group.position.set((Math.random()-0.5)*1500, 5, (Math.random()-0.5)*1500);
        scene.add(group);
        civilians.push({ group, hp: 50 });
    };

    const emitBlood = (pos) => {
        let count = state.goreLevel === 'high' ? 20 : (state.goreLevel === 'med' ? 8 : 2);
        for(let i=0; i<count; i++) {
            const p = createBlock(0.2, 0.2, 0.2, state.goreColor);
            p.position.copy(pos);
            const vel = new THREE.Vector3((Math.random()-0.5)*0.5, Math.random()*0.5, (Math.random()-0.5)*0.5);
            scene.add(p);
            particles.push({ mesh: p, vel, life: 1.0 });
        }
    };

    const performAttack = () => {
        if (state.player.isDead) return;
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 4.0;
        setTimeout(() => h.position.z = -2.5, 80);

        [...enemies, ...civilians].forEach((e, idx) => {
            if (e.hp > 0 && camera.position.distanceTo(e.group.position) < 18) {
                emitBlood(e.group.position.clone().add(new THREE.Vector3(0, 4, 0)));
                e.hp -= 40;
                if (e.hp <= 0) {
                    scene.remove(e.group);
                }
            }
        });
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

        enemies.forEach(e => {
            if (e.hp > 0) {
                const toPlayer = camera.position.clone().sub(e.group.position);
                if (toPlayer.length() < 1500) {
                    if (toPlayer.length() > e.dist) {
                        e.group.position.add(toPlayer.normalize().multiplyScalar(e.speed * dt * 60));
                    }
                    e.group.lookAt(camera.position.x, e.group.position.y, camera.position.z);
                }
            }
        });

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
