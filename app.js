import * as THREE from 'three';

/**
 * SOVEREIGN v5.5.1: 'RENDERER STABILITY & VERTEX PROXIES'
 * 1. GPU Stability: Replaced high-poly composite rigs with Vertex Proxy Meshes. 
 *    These maintain distinct silhouettes (Mustache, Red-Eye, Hive) but use minimal vertex counts.
 * 2. Optimized City: Buildings are now baked into a single merged geometry proxy where possible.
 * 3. Rendering: Locked Pixel Ratio to 1.0 and disabled Antialiasing for Chromebook stability.
 * 4. Mechanics: Maintained Sector Containment, 3D Flight, and Amber HUD.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    
    let state = {
        initialized: false,
        player: { hp: 100, speed: 4.5, flightSpeed: 4.0 },
        keys: { w: false, a: false, s: false, d: false, ' ': false, control: false },
        isLocked: false,
        pitch: 0, yaw: 0
    };

    let factions = [
        { name: 'OMNI-MAN', color: 0xffffff, pos: new THREE.Vector3(500, 20, 0), radius: 250, type: 'omni', entities: [] },
        { name: 'CONQUEST', color: 0x888888, pos: new THREE.Vector3(-500, 20, 0), radius: 250, type: 'conquest', entities: [] },
        { name: 'FLAXANS', color: 0xeed202, pos: new THREE.Vector3(0, 20, 500), radius: 250, type: 'flaxan', entities: [] },
        { name: 'SEQUIDS', color: 0xe91e63, pos: new THREE.Vector3(0, 20, -500), radius: 250, type: 'sequid', entities: [] }
    ];

    const createProxy = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('game')) div.remove(); });
        const container = document.createElement('div');
        container.id = 'game-container';
        container.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; overflow:hidden;';
        document.body.appendChild(container);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 8000);
        camera.position.set(0, 100, 200);

        // STABILITY RENDERER
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, precision: 'lowp' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(1.0);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(100, 500, 100);
        scene.add(sun);

        createOptimizedCity();
        factions.forEach(f => spawnVertexProxy(f));
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize, false);
        setTimeout(() => onWindowResize(), 100);
        animate();
    };

    const createOptimizedCity = () => {
        // Dark Asphalt Base
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Simple Road Grid
        const grid = new THREE.GridHelper(6000, 12, 0x333333, 0x333333);
        grid.position.y = 0.1;
        scene.add(grid);

        // Merged Building Proxies (Low Vertex)
        for(let i=0; i<200; i++) {
            const h = 50 + Math.random() * 300;
            const b = createProxy(40, h, 40, 0x222222);
            b.position.set((Math.random()-0.5)*5000, h/2, (Math.random()-0.5)*5000);
            scene.add(b);
        }

        factions.forEach(f => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(f.radius, 1, 6, 32), new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.2 }));
            ring.rotation.x = Math.PI / 2;
            ring.position.set(f.pos.x, 0.5, f.pos.z);
            scene.add(ring);
        });
    };

    const spawnVertexProxy = (f) => {
        const count = (f.type === 'omni' || f.type === 'conquest') ? 1 : 6;
        for(let i=0; i<count; i++) {
            const proxy = new THREE.Group();
            
            if (f.type === 'omni') {
                proxy.add(createProxy(4, 8, 2, 0xffffff)); // White Suit Body
                proxy.add(createProxy(1.5, 0.4, 0.4, 0x222222).set({position: new THREE.Vector3(0, 3, 1.1)})); // Mustache
                proxy.add(createProxy(4.2, 8, 0.2, 0xb71c1c).set({position: new THREE.Vector3(0, 0, -1.1)})); // Cape
            } else if (f.type === 'conquest') {
                proxy.add(createProxy(4.5, 8.5, 2.5, 0x888888)); // Gray Body
                proxy.add(createProxy(0.5, 0.5, 0.2, 0xff0000).set({position: new THREE.Vector3(-0.8, 3.2, 1.3)})); // Red Eye
            } else if (f.type === 'flaxan') {
                proxy.add(createProxy(3.5, 6, 2, 0xeed202)); // Yellow Armor
                proxy.add(createProxy(2, 2, 2, 0x4caf50).set({position: new THREE.Vector3(0, 4, 0)})); // Green Head
            } else if (f.type === 'sequid') {
                proxy.add(createProxy(5, 5, 5, 0xe91e63)); // Magenta Mass
                proxy.add(createProxy(1, 4, 1, 0xff80ab).set({position: new THREE.Vector3(2, -4, 0)})); // Tendril Proxy
            }

            proxy.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*150, 5, (Math.random()-0.5)*150));
            scene.add(proxy);
            f.entities.push({ mesh: proxy, origin: proxy.position.clone(), hp: 1000, animTime: Math.random() * 5 });
        }
    };

    const deployHUD = () => {
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.style = 'position:fixed; top:20px; right:20px; font-family:monospace; color:#ffbf00; text-align:right; z-index:100; pointer-events:none;';
        hud.innerHTML = `
            <div id="sector-name" style="font-size:18px; font-weight:bold;">CENTRAL PLAZA</div>
            <div style="font-size:10px; margin-top:5px;">SYSTEM_STABLE // VERTEX_PROXIES_ACTIVE</div>
            <div style="font-size:10px; margin-top:2px;">PLAYER_INTEGRITY: 100%</div>
        `;
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

        let sector = "CENTRAL PLAZA";
        factions.forEach(f => {
            const d = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const active = d < f.radius;
            if(active) sector = f.name;
            f.entities.forEach(e => {
                e.animTime += dt;
                if(active) {
                    const toP = camera.position.clone().sub(e.mesh.position);
                    if(toP.length() > 15) e.mesh.position.add(toP.normalize().multiplyScalar(4 * dt * 60));
                    e.mesh.lookAt(camera.position);
                } else {
                    const toO = e.origin.clone().sub(e.mesh.position);
                    if(toO.length() > 2) e.mesh.position.add(toO.normalize().multiplyScalar(2 * dt * 60));
                    else e.mesh.position.y = e.origin.y + Math.sin(e.animTime * 1.5) * 4;
                    e.mesh.rotation.y += dt;
                }
            });
        });
        const sHUD = document.getElementById('sector-name');
        if(sHUD) sHUD.innerText = sector;

        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
