import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.0: 'FACTIONAL VISUALS & INFRASTRUCTURE'
 * 1. World Infrastructure:
 *    - Full City Environment: Gray asphalt roads and building clusters distributed across the 5000-unit map.
 *    - Sector Circles: Containment zones are integrated within the cityscape.
 * 2. Distinct Faction Rigs:
 *    - Omni-Man: White suit, red cape, mustache, hair, high-res emblem.
 *    - Conquest: Gray suit, red cape, cybernetic eye detail, bald/scarred head proxy.
 *    - Flaxans: Armored humanoid rigs (Yellow/Tan armor with green highlights).
 *    - Sequids: Multi-limbed hive entities (Pink/Magenta central mass with tendril-like geometry).
 * 3. Mechanics: Maintained v5.4.9 stability, flight, and Amber HUD.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let factions = [
        { name: 'OMNI-MAN', color: 0xffffff, pos: new THREE.Vector3(500, 20, 0), radius: 250, type: 'omni', entities: [] },
        { name: 'CONQUEST', color: 0x888888, pos: new THREE.Vector3(-500, 20, 0), radius: 250, type: 'conquest', entities: [] },
        { name: 'FLAXANS', color: 0xeed202, pos: new THREE.Vector3(0, 20, 500), radius: 250, type: 'flaxan', entities: [] },
        { name: 'SEQUIDS', color: 0xe91e63, pos: new THREE.Vector3(0, 20, -500), radius: 250, type: 'sequid', entities: [] }
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

        console.log('Sovereign: Initializing v5.5.0 Factional Visuals...');
        
        // FAILSAFE MOUNTING
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('game')) div.remove(); });
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 3500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 50, 150);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(200, 500, 200);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createCity();
        createPlayerHands();
        factions.forEach(f => spawnFaction(f));
        deployAmberHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        
        animate();
    };

    const createCity = () => {
        // Ground Asphalt
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Gray Road Infrastructure
        const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const createRoad = (w, d, x, z) => {
            const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
            r.rotation.x = -Math.PI / 2;
            r.position.set(x, 0.1, z);
            scene.add(r);
        };
        // Grid pattern roads
        for(let i = -5; i <= 5; i++) {
            createRoad(6000, 50, 0, i * 500); // Horizontal
            createRoad(50, 6000, i * 500, 0); // Vertical
        }

        // Global Building Distribution
        for(let i = 0; i < 400; i++) {
            const x = (Math.random() - 0.5) * 5500;
            const z = (Math.random() - 0.5) * 5500;
            // Don't build on roads or directly at sector centers
            if (Math.abs(x % 500) < 60 || Math.abs(z % 500) < 60) continue;
            
            const h = 40 + Math.random() * 400;
            const b = createBlock(45, h, 45, 0x555555);
            b.position.set(x, h/2, z);
            scene.add(b);
        }

        // Sector Rings (Containment Visuals)
        factions.forEach(f => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(f.radius, 1.5, 8, 64),
                new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.25 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(f.pos.x, 0.5, f.pos.z);
            scene.add(ring);
        });
    };

    const createPlayerHands = () => {
        const createHand = (side) => {
            const h = createBlock(0.8, 0.8, 2.0, 0x1e88e5);
            h.position.set(side === 'left' ? -2.2 : 2.2, -1.8, -2.5);
            camera.add(h);
            return h;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnFaction = (f) => {
        const count = (f.type === 'omni' || f.type === 'conquest') ? 1 : 8;
        for(let i=0; i<count; i++) {
            const group = new THREE.Group();
            
            if(f.type === 'omni') {
                // OMNI-MAN RIG
                group.add(createBlock(2.2, 2.2, 2.2, 0xffdbac).set({position: new THREE.Vector3(0, 8, 0)})); // Head
                group.add(createBlock(1.5, 0.4, 0.4, 0x222222).set({position: new THREE.Vector3(0, 7.5, 1.1)})); // Mustache
                group.add(createBlock(2.4, 0.6, 2.4, 0x222222).set({position: new THREE.Vector3(0, 9.2, 0)})); // Hair
                group.add(createBlock(4, 4.5, 2, 0xffffff).set({position: new THREE.Vector3(0, 4.75, 0)})); // Torso
                group.add(createBlock(2.2, 2.7, 0.1, 0xb71c1c).set({position: new THREE.Vector3(0, 5, 1.05)})); // Emblem
                group.add(createBlock(4.5, 8, 0.3, 0xb71c1c).set({position: new THREE.Vector3(0, 4, -1.2)})); // Cape
                const armL = createBlock(1.8, 4.5, 1.8, 0xffffff); armL.position.set(-3, 5, 0); group.add(armL);
                const armR = createBlock(1.8, 4.5, 1.8, 0xffffff); armR.position.set(3, 5, 0); group.add(armR);
                const legL = createBlock(1.8, 4, 1.8, 0xffffff); legL.position.set(-1.1, 1, 0); group.add(legL);
                const legR = createBlock(1.8, 4, 1.8, 0xffffff); legR.position.set(1.1, 1, 0); group.add(legR);
            } 
            else if(f.type === 'conquest') {
                // CONQUEST RIG
                group.add(createBlock(2.2, 2.2, 2.2, 0xffdbac).set({position: new THREE.Vector3(0, 8, 0)})); // Head
                group.add(createBlock(0.6, 0.6, 0.2, 0xff0000).set({position: new THREE.Vector3(-0.6, 8.2, 1.1)})); // Cyber Eye
                group.add(createBlock(4, 5, 2.5, 0x888888).set({position: new THREE.Vector3(0, 4.5, 0)})); // Gray Torso
                group.add(createBlock(4.5, 8.5, 0.3, 0x8b0000).set({position: new THREE.Vector3(0, 4, -1.3)})); // Dark Cape
                const armL = createBlock(2, 4.5, 2, 0x888888); armL.position.set(-3.2, 5, 0); group.add(armL);
                const armR = createBlock(2, 4.5, 2, 0x888888); armR.position.set(3.2, 5, 0); group.add(armR);
                const legL = createBlock(2, 4, 2, 0x888888); legL.position.set(-1.2, 1, 0); group.add(legL);
                const legR = createBlock(2, 4, 2, 0x888888); legR.position.set(1.2, 1, 0); group.add(legR);
            }
            else if(f.type === 'flaxan') {
                // FLAXAN RIG (Armored Humanoid)
                const torso = createBlock(3, 4, 2, 0xeed202); torso.position.y = 4; group.add(torso);
                const head = createBlock(1.8, 1.8, 1.8, 0x4caf50); head.position.y = 7; group.add(head);
                const armL = createBlock(1.2, 3.5, 1.2, 0xeed202); armL.position.set(-2.2, 4, 0); group.add(armL);
                const armR = createBlock(1.2, 3.5, 1.2, 0xeed202); armR.position.set(2.2, 4, 0); group.add(armR);
                const legL = createBlock(1.2, 3, 1.2, 0x4caf50); legL.position.set(-0.8, 1, 0); group.add(legL);
                const legR = createBlock(1.2, 3, 1.2, 0x4caf50); legR.position.set(0.8, 1, 0); group.add(legR);
            }
            else if(f.type === 'sequid') {
                // SEQUID RIG (Tentacle Mass)
                const core = createBlock(4, 4, 4, 0xe91e63); core.position.y = 4; group.add(core);
                for(let j=0; j<8; j++) {
                    const tentacle = createBlock(0.8, 6, 0.8, 0xff80ab);
                    const ang = (j / 8) * Math.PI * 2;
                    tentacle.position.set(Math.cos(ang) * 3, 4, Math.sin(ang) * 3);
                    tentacle.rotation.z = Math.sin(ang) * 0.5;
                    group.add(tentacle);
                }
            }

            group.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200));
            scene.add(group);
            f.entities.push({ mesh: group, origin: group.position.clone(), hp: 1000, animTime: Math.random() * 5 });
        }
    };

    const deployAmberHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; width: 260px; pointer-events: none; font-family: monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; text-align: right; }
            .bar { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; transition: width 0.2s; float: right; background: #c62828; }
            #target-fill { background: #ffbf00; }
            .label { font-size: 10px; font-weight: bold; opacity: 0.9; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div id="sector-name" style="font-size:16px; font-weight:bold; margin-bottom:5px;">CENTRAL PLAZA</div>
            <div class="label">BIOLOGICAL_STATUS [PLAYER]</div>
            <div class="bar"><div id="p-fill" class="fill" style="width:100%;"></div></div>
            <div id="target-ui" style="display:none; margin-top:10px;">
                <div class="label">TARGET_SIGNAL [ACTIVE]</div>
                <div class="bar"><div id="target-fill" class="fill" style="width:100%;"></div></div>
            </div>
        `;
        document.body.appendChild(hud);
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 4.0;
        setTimeout(() => h.position.z = -2.5, 80);

        factions.forEach(f => {
            f.entities.forEach(e => {
                if(camera.position.distanceTo(e.mesh.position) < 22) {
                    e.hp -= 40;
                    const tFill = document.getElementById('target-fill');
                    if(tFill) tFill.style.width = (e.hp / 1000 * 100) + '%';
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
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
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
            if(state.keys[' ']) camera.position.y += state.player.flightSpeed * dt * 60;
            if(state.keys.control) camera.position.y -= state.player.flightSpeed * dt * 60;
            camera.position.y = Math.max(5, camera.position.y);
        }

        let currentSector = "CENTRAL PLAZA";
        let inCombat = false;

        factions.forEach(f => {
            const d2 = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const playerIn = d2 < f.radius;
            if(playerIn) currentSector = f.name;

            f.entities.forEach(e => {
                e.animTime += dt;
                if(playerIn) {
                    inCombat = true;
                    const toP = camera.position.clone().sub(e.mesh.position);
                    if(toP.length() > 12) e.mesh.position.add(toP.normalize().multiplyScalar(4.5 * dt * 60));
                    e.mesh.lookAt(camera.position);
                } else {
                    const toO = e.origin.clone().sub(e.mesh.position);
                    if(toO.length() > 2) e.mesh.position.add(toO.normalize().multiplyScalar(2.5 * dt * 60));
                    else e.mesh.position.y = e.origin.y + Math.sin(e.animTime * 1.5) * 4;
                    e.mesh.rotation.y += dt;
                }
            });
        });

        const targetUI = document.getElementById('target-ui');
        if(targetUI) targetUI.style.display = inCombat ? 'block' : 'none';
        const sectorHUD = document.getElementById('sector-name');
        if(sectorHUD) sectorHUD.innerText = currentSector;

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
