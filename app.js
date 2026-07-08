import * as THREE from 'three';

/**
 * SOVEREIGN v5.6.0: 'DYNAMIC SWARM & 3D OPTIMIZATION'
 * 1. Engine: Restored 3D Three.js engine with Vertex Proxy optimizations for stability.
 * 2. Spawning: 
 *    - Bosses: Omni-Man (1) and Conquest (1) spawned at random map coordinates.
 *    - Swarms: Flaxans (10) and Sequids (10) spawned randomly, capped for performance.
 * 3. Infrastructure: Global city grid with asphalt roads and building clusters.
 * 4. Failsafes: Retained #game-container and 100ms deferred resize for Chromebook.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let factions = [
        { name: 'OMNI-MAN', color: 0xffffff, type: 'omni', count: 1, entities: [] },
        { name: 'CONQUEST', color: 0x888888, type: 'conquest', count: 1, entities: [] },
        { name: 'FLAXANS', color: 0xeed202, type: 'flaxan', count: 10, entities: [] },
        { name: 'SEQUIDS', color: 0xe91e63, type: 'sequid', count: 10, entities: [] }
    ];

    let playerHands = { left: null, right: null };

    const createProxy = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        // CLEANUP
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('game')) div.remove(); });
        
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 500, 3500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 50, 150);

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, precision: 'lowp' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(1.0);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(200, 500, 200);
        scene.add(sun);

        createCity();
        createPlayerHands();
        factions.forEach(f => spawnDynamicFaction(f));
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        animate();
    };

    const createCity = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const grid = new THREE.GridHelper(6000, 20, 0x333333, 0x333333);
        grid.position.y = 0.1;
        scene.add(grid);

        for(let i=0; i<300; i++) {
            const h = 40 + Math.random() * 400;
            const b = createProxy(45, h, 45, 0x222222);
            b.position.set((Math.random()-0.5)*5500, h/2, (Math.random()-0.5)*5500);
            scene.add(b);
        }
    };

    const createPlayerHands = () => {
        const createHand = (side) => {
            const h = createProxy(0.8, 0.8, 2.0, 0x1e88e5);
            h.position.set(side === 'left' ? -2.2 : 2.2, -1.8, -2.5);
            camera.add(h);
            return h;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnDynamicFaction = (f) => {
        for(let i=0; i<f.count; i++) {
            const group = new THREE.Group();
            if(f.type === 'omni') {
                group.add(createProxy(4, 8, 2, 0xffffff)); // Body
                group.add(createProxy(1.5, 0.4, 0.4, 0x222222).set({position: new THREE.Vector3(0, 3, 1.1)})); // Mustache
                group.add(createProxy(4.2, 8, 0.2, 0xb71c1c).set({position: new THREE.Vector3(0, 0, -1.1)})); // Cape
            } else if(f.type === 'conquest') {
                group.add(createProxy(4.5, 8.5, 2.5, 0x888888)); // Body
                group.add(createProxy(0.5, 0.5, 0.2, 0xff0000).set({position: new THREE.Vector3(-0.8, 3.2, 1.3)})); // Eye
            } else if(f.type === 'flaxan') {
                group.add(createProxy(3, 5, 2, 0xeed202)); // Body
                group.add(createProxy(2, 2, 2, 0x4caf50).set({position: new THREE.Vector3(0, 3.5, 0)})); // Head
            } else if(f.type === 'sequid') {
                group.add(createProxy(4, 4, 4, 0xe91e63)); // Mass
            }

            const x = (Math.random()-0.5)*4000;
            const z = (Math.random()-0.5)*4000;
            group.position.set(x, 20, z);
            scene.add(group);
            f.entities.push({ mesh: group, origin: group.position.clone(), hp: 1000, animTime: Math.random()*5 });
        }
    };

    const deployHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; font-family: monospace; color: #ffbf00; text-align: right; z-index: 100; pointer-events: none; }
            .bar { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; width: 250px; }
            .fill { height: 100%; float: right; background: #c62828; width: 100%; transition: width 0.2s; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `
            <div style="font-size:18px; font-weight:bold;">SOVEREIGN v5.6.0</div>
            <div style="font-size:10px; margin-top:5px;">BIO_STATUS</div>
            <div class="bar"><div id="p-fill" class="fill"></div></div>
        `;
        document.body.appendChild(hud);
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 4.0; setTimeout(() => h.position.z = -2.5, 80);

        factions.forEach(f => f.entities.forEach(e => {
            if(camera.position.distanceTo(e.mesh.position) < 25) e.hp -= 100;
        }));
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true; if(e.code === 'Space') state.keys[' '] = true; if(e.code === 'ControlLeft') state.keys.control = true; });
        document.addEventListener('keyup', (e) => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false; if(e.code === 'Space') state.keys[' '] = false; if(e.code === 'ControlLeft') state.keys.control = false; });
        document.addEventListener('mousedown', () => { if(!state.isLocked) document.body.requestPointerLock(); else performAttack(); });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => { if(state.isLocked) { state.yaw -= e.movementX * 0.003; state.pitch -= e.movementY * 0.003; state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch)); camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); } });
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

        factions.forEach(f => {
            f.entities.forEach(e => {
                e.animTime += dt;
                const dist = camera.position.distanceTo(e.mesh.position);
                if(dist < 500) {
                    const toP = camera.position.clone().sub(e.mesh.position);
                    if(toP.length() > 15) e.mesh.position.add(toP.normalize().multiplyScalar(4.5 * dt * 60));
                    e.mesh.lookAt(camera.position);
                } else {
                    e.mesh.position.y = e.origin.y + Math.sin(e.animTime * 1.5) * 4;
                    e.mesh.rotation.y += dt;
                }
            });
        });

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
