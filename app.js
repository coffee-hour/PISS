import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.9: 'VISUAL & RIG RESTORATION'
 * 1. Failsafe Mount: Retaining the #game-container and 100ms deferred resize for Chromebook stability.
 * 2. Visual Restoration:
 *    - Restored First-Person Player Hands (proxies).
 *    - Restored High-Res Omni-Man Rig (Hair, Mustache, Emblem, White Suit).
 *    - Restored Amber HUD Health Bars (Player & Target).
 * 3. Environment: Restored City Streets and Building layout in sectors.
 * 4. Containment: Maintained 200-unit aggro fields and sector logic.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        boss: { hp: 1000, maxHp: 1000, pursuitSpeed: 0.2, stopDist: 10.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let factions = [
        { name: 'Omni-Man', color: 0xffffff, pos: new THREE.Vector3(500, 20, 0), radius: 200, type: 'omni', entities: [] },
        { name: 'Conquest', color: 0xdddddd, pos: new THREE.Vector3(-500, 20, 0), radius: 200, type: 'omni', entities: [] },
        { name: 'Flaxans', color: 0x4caf50, pos: new THREE.Vector3(0, 20, 500), radius: 200, type: 'mob', entities: [] },
        { name: 'Sequids', color: 0xe91e63, pos: new THREE.Vector3(0, 20, -500), radius: 200, type: 'mob', entities: [] }
    ];

    let playerHands = { left: null, right: null };
    let particles = [];

    const createBlock = (w, h, d, color, opacity = 1) => {
        const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Restoring v5.4.9 Visuals & Rigs...');
        
        // MOUNTING FAILSAFE
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('overlay') || div.id.includes('game')) div.remove(); });
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 50, 200);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(100, 500, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createWorld();
        createPlayerHands();
        factions.forEach(f => spawnFaction(f));
        deployAmberHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        
        animate();
    };

    const createWorld = () => {
        // Ground & Streets
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const grid = new THREE.GridHelper(5000, 50, 0x444444, 0x333333);
        grid.position.y = 0.1;
        scene.add(grid);

        // Building Clusters per Sector
        factions.forEach(f => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(f.radius, 1, 8, 64),
                new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.3 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(f.pos.x, 0.5, f.pos.z);
            scene.add(ring);

            for(let i=0; i<15; i++) {
                const h = 50 + Math.random() * 300;
                const b = createBlock(40, h, 40, 0x555555);
                b.position.set(f.pos.x + (Math.random()-0.5)*350, h/2, f.pos.z + (Math.random()-0.5)*350);
                if (b.position.distanceTo(f.pos) < 60) continue;
                scene.add(b);
            }
        });
    };

    const createPlayerHands = () => {
        const createHand = (side) => {
            const h = createBlock(0.8, 0.8, 1.8, 0x1e88e5);
            h.position.set(side === 'left' ? -2.2 : 2.2, -1.8, -2.5);
            camera.add(h);
            return h;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnFaction = (f) => {
        const count = f.type === 'omni' ? 1 : 4;
        for(let i=0; i<count; i++) {
            const group = new THREE.Group();
            if(f.type === 'omni') {
                // RESTORE HIGH-RES OMNI-MAN RIG
                const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
                const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, 7.5, 1.1); group.add(stache);
                const hair = createBlock(2.4, 0.6, 2.4, 0x222222); hair.position.y = 9.2; group.add(hair);
                const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
                const emblemB = createBlock(2.2, 2.7, 0.1, 0xb71c1c); emblemB.position.set(0, 5, 1.05); group.add(emblemB);
                const emblemD = createBlock(0.8, 2.7, 0.15, 0xffffff); emblemD.position.set(0, 5, 1.06); group.add(emblemD);
                const createArm = (x) => {
                    const a = new THREE.Group();
                    const u = createBlock(1.8, 3, 1.8, 0xffffff); u.position.y = -1.5; a.add(u);
                    const g = createBlock(1.9, 1.5, 1.9, 0xb71c1c); g.position.y = -3.5; a.add(g);
                    a.position.set(x, 7, 0); return a;
                };
                group.add(createArm(3)); group.add(createArm(-3));
                const createLeg = (x) => {
                    const l = new THREE.Group();
                    const u = createBlock(1.8, 3, 1.8, 0xffffff); u.position.y = -1.5; l.add(u);
                    const b = createBlock(1.9, 1.5, 1.9, 0xb71c1c); b.position.y = -3.5; l.add(b);
                    l.position.set(x, 2.5, 0); return l;
                };
                group.add(createLeg(1.1)); group.add(createLeg(-1.1));
                const cape = createBlock(4.5, 8, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);
            } else {
                group.add(createBlock(4, 4, 4, f.color));
            }
            group.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*100, 0, (Math.random()-0.5)*100));
            scene.add(group);
            f.entities.push({
                mesh: group,
                origin: group.position.clone(),
                state: 'passive',
                animTime: Math.random() * 5,
                hp: 1000
            });
        }
    };

    const deployAmberHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; width: 250px; pointer-events: none; font-family: monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; text-align: right; }
            .bar { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; transition: width 0.2s; float: right; }
            #p-fill { background: #c62828; width: 100%; }
            #o-fill { background: #ffbf00; width: 100%; }
            #sector-name { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
            .label { font-size: 10px; font-weight: bold; opacity: 0.8; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div id="sector-name">CENTRAL PLAZA</div>
            <div class="label">PLAYER HP</div>
            <div class="bar"><div id="p-fill" class="fill"></div></div>
            <div id="target-ui" style="display:none; margin-top:10px;">
                <div class="label">TARGET STATUS</div>
                <div class="bar"><div id="o-fill" class="fill"></div></div>
            </div>
        `;
        document.body.appendChild(hud);
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 3.5;
        setTimeout(() => h.position.z = -2.5, 80);

        factions.forEach(f => {
            f.entities.forEach(e => {
                if(camera.position.distanceTo(e.mesh.position) < 18) {
                    e.hp -= 50;
                    const oFill = document.getElementById('o-fill');
                    if(oFill) oFill.style.width = (e.hp / 1000 * 100) + '%';
                }
            });
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
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
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
            if(state.keys[' ']) camera.position.y += state.player.flightSpeed * dt * 60;
            if(state.keys.control) camera.position.y -= state.player.flightSpeed * dt * 60;
            camera.position.y = Math.max(5, camera.position.y);
        }

        let activeSector = "CENTRAL PLAZA";
        let hasAggroTarget = false;

        factions.forEach(f => {
            const distToCenter = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const playerInField = distToCenter < f.radius;
            if(playerInField) activeSector = f.name;

            f.entities.forEach(e => {
                e.animTime += dt;
                if(playerInField) {
                    hasAggroTarget = true;
                    const toPlayer = camera.position.clone().sub(e.mesh.position);
                    if(toPlayer.length() > 10) e.mesh.position.add(toPlayer.normalize().multiplyScalar(4 * dt * 60));
                    e.mesh.lookAt(camera.position);
                } else {
                    const toOrigin = e.origin.clone().sub(e.mesh.position);
                    if(toOrigin.length() > 2) e.mesh.position.add(toOrigin.normalize().multiplyScalar(2 * dt * 60));
                    else e.mesh.position.y = e.origin.y + Math.sin(e.animTime * 2) * 5;
                    e.mesh.rotation.y += dt;
                }
            });
        });

        const targetUI = document.getElementById('target-ui');
        if(targetUI) targetUI.style.display = hasAggroTarget ? 'block' : 'none';
        const sectorHUD = document.getElementById('sector-name');
        if(sectorHUD) sectorHUD.innerText = activeSector;

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
