import * as THREE from 'three';

/**
 * SOVEREIGN v6.0.0: 'SNIPER ELITE'
 * 1. Perspective: Static sniper nest overlooking a high-rise city.
 * 2. Scope: Right-click/Hold for scoped zoom with forensic reticle overlay.
 * 3. Targets: Randomly spawning R6-style targets in building windows.
 * 4. Mechanics: Ballistic click-detection, score tracking, and target cycling.
 */

const SniperElite = (() => {
    let scene, camera, renderer, clock;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        isScoped: false,
        zoom: 75,
        targetZoom: 15,
        score: 0,
        highScore: 0,
        targets: []
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing v6.0.0 Sniper Elite...');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.fog = new THREE.Fog(0x050505, 500, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, 150, 0); // Nest position

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(500, 1000, 500);
        scene.add(sunLight);

        createCityscape();
        deploySniperHUD();
        setupInput();
        
        clock = new THREE.Clock();
        setInterval(spawnTarget, 2000);
        animate();
    };

    const deploySniperHUD = () => {
        const hudId = 'sniper-hud';
        if(document.getElementById(hudId)) document.getElementById(hudId).remove();
        
        const style = document.createElement('style');
        style.innerHTML = `
            #sniper-hud { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10; font-family: 'Courier New', monospace; text-transform: uppercase; }
            #reticle { 
                position: absolute; top: 50%; left: 50%; width: 400px; height: 400px; 
                border: 2px solid #ffbf00; border-radius: 50%; transform: translate(-50%, -50%); 
                display: none; box-shadow: 0 0 0 5000px rgba(0,0,0,0.85);
            }
            #cross-h { position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: #ffbf00; }
            #cross-v { position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: #ffbf00; }
            .sniper-stats { position: fixed; top: 20px; left: 20px; color: #ffbf00; font-size: 18px; font-weight: bold; }
            #system-alert { position: fixed; bottom: 40px; width: 100%; text-align: center; color: #ffbf00; font-size: 12px; }
        `;
        document.head.appendChild(style);

        const hud = document.createElement('div');
        hud.id = hudId;
        hud.innerHTML = `
            <div id="reticle">
                <div id="cross-h"></div>
                <div id="cross-v"></div>
            </div>
            <div class="sniper-stats">
                KILLS: <span id="kill-count">0</span><br>
                STATUS: <span id="scope-status">UNSCOPED</span>
            </div>
            <div id="system-alert">HOLD RIGHT-CLICK TO SCOPE // LEFT-CLICK TO FIRE</div>
        `;
        document.body.appendChild(hud);
    };

    const createCityscape = () => {
        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Building Nest (Player)
        const nest = new THREE.Mesh(new THREE.BoxGeometry(40, 300, 40), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        nest.position.set(0, 140, 20);
        scene.add(nest);

        // Target Buildings
        for(let i=0; i<15; i++) {
            const h = 400 + Math.random() * 400;
            const w = 100 + Math.random() * 50;
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 100), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
            b.position.set((Math.random()-0.5)*1000, h/2, -400 - Math.random() * 400);
            scene.add(b);

            // Add window grid for logic
            b.userData.isBuilding = true;
            b.userData.height = h;
            b.userData.width = w;
        }
    };

    const spawnTarget = () => {
        if(state.targets.length > 5) return;

        const buildings = scene.children.filter(c => c.userData.isBuilding);
        const b = buildings[Math.floor(Math.random() * buildings.length)];
        
        const target = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        target.add(body);

        // Position in a "window"
        const xOff = (Math.random()-0.5) * (b.userData.width - 10);
        const yOff = (Math.random() * b.userData.height) - (b.userData.height / 2);
        
        target.position.copy(b.position);
        target.position.x += xOff;
        target.position.y = Math.max(10, b.position.y + yOff);
        target.position.z += 51; // Front of building

        scene.add(target);
        state.targets.push(target);

        // Auto-despawn
        setTimeout(() => {
            scene.remove(target);
            state.targets = state.targets.filter(t => t !== target);
        }, 5000);
    };

    const setupInput = () => {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(0, 0);

        document.addEventListener('mousedown', (e) => {
            if(e.button === 2) { // Right Click
                state.isScoped = true;
                document.getElementById('reticle').style.display = 'block';
                document.getElementById('scope-status').innerText = 'SCOPED';
            }
            if(e.button === 0) { // Left Click
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(state.targets, true);
                if(intersects.length > 0) {
                    const hit = intersects[0].object.parent;
                    scene.remove(hit);
                    state.targets = state.targets.filter(t => t !== hit);
                    state.score++;
                    document.getElementById('kill-count').innerText = state.score;
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if(e.button === 2) {
                state.isScoped = false;
                document.getElementById('reticle').style.display = 'none';
                document.getElementById('scope-status').innerText = 'UNSCOPED';
            }
        });

        document.addEventListener('contextmenu', e => e.preventDefault());

        document.addEventListener('mousemove', (e) => {
            if(state.isScoped) {
                // Precision movement in scope
                camera.rotation.y -= e.movementX * 0.0001;
                camera.rotation.x -= e.movementY * 0.0001;
            } else {
                camera.rotation.y -= e.movementX * 0.001;
                camera.rotation.x -= e.movementY * 0.001;
            }
        });
    };

    const animate = () => {
        requestAnimationFrame(animate);
        
        const zoomSpeed = 0.1;
        if(state.isScoped) {
            camera.fov = THREE.MathUtils.lerp(camera.fov, state.targetZoom, zoomSpeed);
        } else {
            camera.fov = THREE.MathUtils.lerp(camera.fov, 75, zoomSpeed);
        }
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
    };

    return { init };
})();

SniperElite.init();
