import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.8: 'FAILSAFE MOUNT & SYNC'
 * 1. Failsafe Mounting: Creating an explicit #game-container to ensure the renderer always finds its mount point.
 * 2. Deferred Resize: Added a 100ms delay to the initial resize event to ensure the canvas snaps to the Chromebook's window bounds.
 * 3. Resource Optimization: Replaced complex geometries with primitive proxies for instant loading on throttled hardware.
 * 4. Diagnostics: Added a 'SYSTEM_ONLINE' heartbeat tag to the bottom-right for visual execution confirmation.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, speed: 4.5, height: 10.0, flightSpeed: 4.0, isDead: false },
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

    const createBlock = (w, h, d, color, opacity = 1) => {
        const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        return mesh;
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing v5.4.8 Failsafe Mount...');
        
        // CLEANUP & CONTAINER SETUP
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('overlay') || div.id.includes('game')) div.remove(); });
        
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:0; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        // DIAGNOSTIC TAG
        const diag = document.createElement('div');
        diag.style = 'position:fixed; bottom:10px; right:10px; color:#ffbf00; font-family:monospace; font-size:10px; z-index:10000; pointer-events:none;';
        diag.innerText = 'SYSTEM_ONLINE // v5.4.8';
        document.body.appendChild(diag);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 4000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 100, 200);

        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); // Antialias off for performance
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(1); // Lock pixel ratio for low-end hardware
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(100, 500, 100);
        scene.add(sunLight);

        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        createEnvironment();
        factions.forEach(f => spawnFaction(f));
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        // Force a resize sync after mount
        setTimeout(() => onWindowResize(), 100);
        
        animate();
    };

    const createEnvironment = () => {
        factions.forEach(f => {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(f.radius, 1.5, 8, 32),
                new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.2 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(f.pos.x, 0.5, f.pos.z);
            scene.add(ring);

            const tower = createBlock(40, 300, 40, 0x222222);
            tower.position.set(f.pos.x, 150, f.pos.z);
            scene.add(tower);
        });
    };

    const spawnFaction = (f) => {
        const count = f.type === 'omni' ? 1 : 4;
        for(let i=0; i<count; i++) {
            const group = new THREE.Group();
            const body = createBlock(f.type === 'omni' ? 4 : 3, f.type === 'omni' ? 8 : 3, f.type === 'omni' ? 2 : 3, f.color);
            group.add(body);
            group.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*100, 0, (Math.random()-0.5)*100));
            scene.add(group);
            f.entities.push({
                mesh: group,
                origin: group.position.clone(),
                state: 'passive',
                animTime: Math.random() * 5
            });
        }
    };

    const deployHUD = () => {
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style = 'position:fixed; top:20px; right:20px; font-family:monospace; color:#ffbf00; text-align:right; z-index:100; pointer-events:none; text-transform:uppercase;';
        hud.innerHTML = `<div id="sector-name" style="font-weight:bold; font-size:16px;">CENTRAL PLAZA</div><div style="font-size:10px;">FLIGHT_ENGAGED [SPACE/CTRL]</div>`;
        document.body.appendChild(hud);
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
        document.addEventListener('mousedown', () => { if(!state.isLocked) document.body.requestPointerLock(); });
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
        factions.forEach(f => {
            const distToCenter = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const playerInField = distToCenter < f.radius;
            if(playerInField) activeSector = f.name;

            f.entities.forEach(e => {
                e.animTime += dt;
                if(playerInField) {
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

        const sectorHUD = document.getElementById('sector-name');
        if(sectorHUD) sectorHUD.innerText = activeSector;

        renderer.render(scene, camera);
    };
    return { init };
})();

// Start with failsafe
Sovereign.init();
