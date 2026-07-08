import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.7: 'PRECISE LAYOUT & CONTAINMENT'
 * 1. Environment: Manual layout based on typical sector-based mission drawings.
 *    - Central Plaza [0,0]
 *    - North: Flaxan Sector [0, 500]
 *    - East: Omni-Man's Void [500, 0]
 *    - South: Sequid Hive [0, -500]
 *    - West: Conquest Court [-500, 0]
 * 2. Containment Mechanics:
 *    - 200-unit transparent containment fields for each faction.
 *    - Passive Behavior: Entities hover within their fields.
 *    - Aggro Trigger: Pursuit activates ONLY when player enters the field.
 *    - De-aggro: Entities return to their origin when player exits.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    
    let state = {
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

    let particles = [];

    const createBlock = (w, h, d, color, opacity = 1) => {
        const mat = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    const init = () => {
        console.log('Sovereign: Initializing v5.4.7 Precise Layout & Containment...');
        
        document.querySelectorAll('div').forEach(div => { if (div.id.includes('hud') || div.id.includes('overlay')) div.remove(); });

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 4000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 100, 200);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(100, 500, 100);
        scene.add(sun);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        // Central Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);
        scene.add(new THREE.GridHelper(5000, 50, 0x888888, 0x444444));

        createEnvironment();
        factions.forEach(f => spawnFaction(f));
        deployHUD();
        setupInput();
        
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createEnvironment = () => {
        // Central Plaza
        const plaza = createBlock(100, 5, 100, 0x555555);
        plaza.position.set(0, 2.5, 0);
        scene.add(plaza);

        // Landmarks for each sector
        factions.forEach(f => {
            // Sector Containment Ring
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(f.radius, 2, 8, 64),
                new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.3 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(f.pos.x, 0.5, f.pos.z);
            scene.add(ring);

            // Sector Landmark
            const marker = createBlock(40, 200, 40, 0x222222);
            marker.position.set(f.pos.x, 100, f.pos.z);
            scene.add(marker);
        });
    };

    const spawnFaction = (f) => {
        const count = f.type === 'omni' ? 1 : 5;
        for(let i=0; i<count; i++) {
            const group = new THREE.Group();
            if(f.type === 'omni') {
                // Omni-Man Rig
                group.add(createBlock(2.2, 2.2, 2.2, 0xffdbac).set({position: new THREE.Vector3(0, 8, 0)})); // Head
                group.add(createBlock(4, 4.5, 2, f.color).set({position: new THREE.Vector3(0, 4.75, 0)})); // Torso
                group.add(createBlock(4.5, 8, 0.3, 0xb71c1c).set({position: new THREE.Vector3(0, 4, -1.2)})); // Cape
            } else {
                // Mob Rig
                group.add(createBlock(3, 3, 3, f.color));
            }
            group.position.copy(f.pos).add(new THREE.Vector3((Math.random()-0.5)*50, 0, (Math.random()-0.5)*50));
            scene.add(group);
            f.entities.push({
                mesh: group,
                origin: group.position.clone(),
                hp: 1000,
                vel: new THREE.Vector3(),
                state: 'passive',
                animTime: Math.random() * 10
            });
        }
    };

    const deployHUD = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            #rpg-hud { position: fixed; top: 20px; right: 20px; width: 250px; pointer-events: none; font-family: monospace; color: #ffbf00; z-index: 100; text-transform: uppercase; text-align: right; }
            .bar { background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; height: 10px; margin: 4px 0; overflow: hidden; }
            .fill { height: 100%; background: #c62828; width: 100%; }
            #sector-name { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'rpg-hud';
        hud.innerHTML = `<div id="sector-name">CENTRAL PLAZA</div><div class="bar"><div id="p-fill" class="fill"></div></div>`;
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

        let activeSector = "CENTRAL PLAZA";
        factions.forEach(f => {
            const distToCenter = new THREE.Vector2(camera.position.x, camera.position.z).distanceTo(new THREE.Vector2(f.pos.x, f.pos.z));
            const playerInField = distToCenter < f.radius;
            if(playerInField) activeSector = f.name;

            f.entities.forEach(e => {
                e.animTime += dt;
                if(playerInField) {
                    // Aggro Pursuit
                    e.state = 'aggro';
                    const toPlayer = camera.position.clone().sub(e.mesh.position);
                    if(toPlayer.length() > 10) {
                        e.mesh.position.add(toPlayer.normalize().multiplyScalar(4 * dt * 60));
                    }
                    e.mesh.lookAt(camera.position);
                } else {
                    // Return to Origin / Passive Hover
                    e.state = 'passive';
                    const toOrigin = e.origin.clone().sub(e.mesh.position);
                    if(toOrigin.length() > 2) {
                        e.mesh.position.add(toOrigin.normalize().multiplyScalar(2 * dt * 60));
                    } else {
                        e.mesh.position.y = e.origin.y + Math.sin(e.animTime * 2) * 5;
                    }
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

Sovereign.init();
