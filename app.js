import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.0: 'FACTIONAL VISUALS & INFRASTRUCTURE'
 * 1. Environment: Expanded city-wide infrastructure. Gray roads and buildings now populate the entire 5000-unit arena, not just containment zones.
 * 2. Distinct Faction Rigs:
 *    - Omni-Man: Classic white/red suit, mustache, hair.
 *    - Conquest: Larger, armored gray rig with distinctive scarring/cape.
 *    - Sequids: Pink hive-mind cluster with procedural tentacle-fists.
 *    - Flaxans: Armored green humanoid rigs (replacing tiny blobs).
 * 3. Layout: Maintained the v5.4.9 sector/containment logic and Chromebook failsafes.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let factions = [
        { name: "OMNI-MAN'S VOID", color: 0xffffff, pos: new THREE.Vector3(500, 20, 0), radius: 250, type: 'omniman', entities: [] },
        { name: "CONQUEST'S COURT", color: 0x999999, pos: new THREE.Vector3(-500, 20, 0), radius: 250, type: 'conquest', entities: [] },
        { name: "FLAXAN SECTOR", color: 0x4caf50, pos: new THREE.Vector3(0, 20, 500), radius: 250, type: 'flaxan', entities: [] },
        { name: "SEQUID HIVE", color: 0xe91e63, pos: new THREE.Vector3(0, 20, -500), radius: 250, type: 'sequid', entities: [] }
    ];

    let playerHands = { left: null, right: null };

    const createBlock = (w, h, d, color) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        // FAILSAFE MOUNTING
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('game')) div.remove(); });
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 200, 4000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 100, 300);

        renderer = new THREE.WebGLRenderer({ antialias: true });
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

        createCityInfrastructure();
        createPlayerHands();
        factions.forEach(f => spawnFaction(f));
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        
        animate();
    };

    const createCityInfrastructure = () => {
        // City-wide Ground & Roads
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Gray Roads Grid
        const grid = new THREE.GridHelper(6000, 40, 0x444444, 0x444444);
        grid.position.y = 0.1;
        scene.add(grid);

        // Populate buildings throughout the city
        for(let i=0; i<300; i++) {
            const h = 40 + Math.random() * 400;
            const b = createBlock(40, h, 40, 0x333333);
            b.position.set((Math.random()-0.5)*5000, h/2, (Math.random()-0.5)*5000);
            // Skip buildings that clash with faction spawn points
            let tooClose = false;
            factions.forEach(f => { if (b.position.distanceTo(f.pos) < 100) tooClose = true; });
            if(!tooClose) scene.add(b);
        }

        // Sector Markers (Containment Rings)
        factions.forEach(f => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(f.radius, 1.5, 8, 64),
                new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.3 })
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
        const count = (f.type === 'omniman' || f.type === 'conquest') ? 1 : 8;
        for(let i=0; i<count; i++) {
            const group = new THREE.Group();
            
            if (f.type === 'omniman') {
                // Omni-Man High-Res Rig
                const head = createBlock(2.2, 2.2, 2.2, 0xffdbac); head.position.y = 8; group.add(head);
                const stache = createBlock(1.5, 0.4, 0.4, 0x222222); stache.position.set(0, 7.5, 1.1); group.add(stache);
                const hair = createBlock(2.4, 0.6, 2.4, 0x222222); hair.position.y = 9.2; group.add(hair);
                const torso = createBlock(4, 4.5, 2, 0xffffff); torso.position.y = 4.75; group.add(torso);
                const emblem = createBlock(2.2, 2.5, 0.1, 0xb71c1c); emblem.position.set(0, 5, 1.05); group.add(emblem);
                const rArm = createBlock(1.8, 4, 1.8, 0xffffff); rArm.position.set(3, 5, 0); group.add(rArm);
                const lArm = createBlock(1.8, 4, 1.8, 0xffffff); lArm.position.set(-3, 5, 0); group.add(lArm);
                const cape = createBlock(4.5, 8, 0.3, 0xb71c1c); cape.position.set(0, 4, -1.2); group.add(cape);
                const rLeg = createBlock(1.8, 4, 1.8, 0xffffff); rLeg.position.set(1.1, 1, 0); group.add(rLeg);
                const lLeg = createBlock(1.8, 4, 1.8, 0xffffff); lLeg.position.set(-1.1, 1, 0); group.add(lLeg);
            } 
            else if (f.type === 'conquest') {
                // Conquest Armored Rig
                const head = createBlock(2.5, 2.5, 2.5, 0xdddbac); head.position.y = 8.5; group.add(head);
                const armor = createBlock(5, 5, 3, 0x666666); armor.position.y = 5.0; group.add(armor);
                const rArm = createBlock(2.2, 4.5, 2.2, 0x666666); rArm.position.set(3.8, 5, 0); group.add(rArm);
                const lArm = createBlock(2.2, 4.5, 2.2, 0x666666); lArm.position.set(-3.8, 5, 0); group.add(lArm);
                const cape = createBlock(5.5, 9, 0.3, 0x111111); cape.position.set(0, 4.5, -1.6); group.add(cape);
            }
            else if (f.type === 'flaxan') {
                // Flaxan Armored Humanoid
                const fTorso = createBlock(3, 4, 1.5, 0x2e7d32); fTorso.position.y = 4; group.add(fTorso);
                const fHead = createBlock(1.8, 1.8, 1.8, 0x4caf50); fHead.position.y = 7; group.add(fHead);
                const fHelm = createBlock(2, 0.5, 2, 0x1b5e20); fHelm.position.y = 8; group.add(fHelm);
            }
            else if (f.type === 'sequid') {
                // Sequid Hive Rig
                const core = createBlock(4, 4, 4, 0xe91e63); group.add(core);
                for(let j=0; j<4; j++) {
                    const tentacle = createBlock(1, 4, 1, 0xc2185b);
                    tentacle.position.set((j-1.5)*2, -3, (Math.random()-0.5)*2);
                    group.add(tentacle);
                }
            }

            group.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*120, 0, (Math.random()-0.5)*120));
            scene.add(group);
            f.entities.push({ mesh: group, origin: group.position.clone(), animTime: Math.random() * 5, hp: 1000 });
        }
    };

    const deployHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; font-family: monospace; color: #ffbf00; text-align: right; z-index: 100; pointer-events: none; text-transform: uppercase; }
            .bar { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; width: 250px; }
            .fill { height: 100%; transition: width 0.2s; float: right; background: #c62828; width: 100%; }
            #sector-label { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div id="sector-label">CENTRAL PLAZA</div>
            <div style="font-size:10px;">PLAYER_BIO_STATUS</div>
            <div class="bar"><div id="p-fill" class="fill"></div></div>
            <div id="target-ui" style="display:none; margin-top:10px;">
                <div style="font-size:10px;">TARGET_INTEGRITY</div>
                <div class="bar"><div id="o-fill" class="fill" style="background:#ffbf00;"></div></div>
            </div>
        `;
        document.body.appendChild(hud);
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true; if(e.code === 'Space') state.keys[' '] = true; if(e.code === 'ControlLeft') state.keys.control = true; });
        document.addEventListener('keyup', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false; if(e.code === 'Space') state.keys[' '] = false; if(e.code === 'ControlLeft') state.keys.control = false; });
        document.addEventListener('mousedown', () => { if(!state.isLocked) document.body.requestPointerLock(); else performMelee(); });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => { if(state.isLocked) { state.yaw -= e.movementX * 0.003; state.pitch -= e.movementY * 0.003; state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch)); camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); } });
    };

    const performMelee = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed]; h.position.z -= 4.0; setTimeout(() => h.position.z = -2.5, 80);
        factions.forEach(f => f.entities.forEach(e => { if(camera.position.distanceTo(e.mesh.position) < 18) e.hp -= 80; }));
    };

    const onWindowResize = () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); };

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
        let targetAggro = false;
        factions.forEach(f => {
            const dist = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const active = dist < f.radius;
            if(active) currentSector = f.name;
            f.entities.forEach(e => {
                e.animTime += dt;
                if(active) {
                    targetAggro = true;
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

        const label = document.getElementById('sector-label'); if(label) label.innerText = currentSector;
        const targetUI = document.getElementById('target-ui'); if(targetUI) targetUI.style.display = targetAggro ? 'block' : 'none';

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
