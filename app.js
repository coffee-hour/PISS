import * as THREE from 'three';

/**
 * SOVEREIGN v6.0.5: 'DAYTIME OVERHAUL'
 * 1. Lighting: Full sun intensity with overhead DirectionalLight and noon-day HemisphereLight.
 * 2. Atmosphere: Bright sky-blue background with pushed-back fog for maximum visibility.
 * 3. Targets: Neon-bright emissive targets for instant identification.
 * 4. UI: Maintained the 'UI Purge' minimalist sniper interface.
 */

const SniperElite = (() => {
    let scene, camera, renderer, clock;
    let sunLight, hemiLight;
    
    let state = {
        initialized: false,
        isScoped: false,
        isLocked: false,
        zoom: 75,
        targetZoom: 15,
        score: 0,
        targets: [],
        pitch: 0,
        yaw: 0
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing v6.0.5 Daytime Overhaul...');
        
        // 1. ATMOSPHERE
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Bright Sky Blue
        scene.fog = new THREE.Fog(0x87ceeb, 1500, 6000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 150, 0);
        camera.rotation.order = 'YXZ';

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // 2. NOON-DAY LIGHTING SPECTRUM
        hemiLight = new THREE.HemisphereLight(0xddeeff, 0x444444, 1.5);
        scene.add(hemiLight);

        sunLight = new THREE.DirectionalLight(0xffffff, 2.0); // Full sun intensity
        sunLight.position.set(50, 1000, 50); // Directly overhead for edge highlights
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
            .sniper-stats { position: fixed; top: 20px; left: 20px; color: #ffbf00; font-size: 18px; font-weight: bold; text-shadow: 2px 2px 0px rgba(0,0,0,0.5); }
            #system-alert { position: fixed; bottom: 40px; width: 100%; text-align: center; color: #ffbf00; font-size: 12px; text-shadow: 1px 1px 0px rgba(0,0,0,0.5); }
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
            <div id="system-alert">CLICK TO LOCK MOUSE // HOLD RIGHT-CLICK TO SCOPE // ESC TO UNLOCK</div>
        `;
        document.body.appendChild(hud);
    };

    const createCityscape = () => {
        // Concrete ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0x555555 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const nest = new THREE.Mesh(new THREE.BoxGeometry(40, 300, 40), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        nest.position.set(0, 140, 20);
        scene.add(nest);

        for(let i=0; i<20; i++) {
            const h = 400 + Math.random() * 500;
            const w = 120 + Math.random() * 80;
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 150), new THREE.MeshLambertMaterial({ color: 0x222222 }));
            b.position.set((Math.random()-0.5)*1500, h/2, -600 - Math.random() * 800);
            b.userData.isBuilding = true;
            b.userData.height = h;
            b.userData.width = w;
            scene.add(b);
        }
    };

    const spawnTarget = () => {
        if(state.targets.length > 10) return;
        const buildings = scene.children.filter(c => c.userData.isBuilding);
        const b = buildings[Math.floor(Math.random() * buildings.length)];
        const target = new THREE.Group();
        
        // NEON-BRIGHT EMISSIVE TARGETS
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(3, 6, 1.5), 
            new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 })
        );
        target.add(body);
        
        const xOff = (Math.random()-0.5) * (b.userData.width - 20);
        const yOff = (Math.random() * b.userData.height) - (b.userData.height / 2);
        target.position.copy(b.position);
        target.position.x += xOff;
        target.position.y = Math.max(10, b.position.y + yOff);
        target.position.z += 76; // Just in front of building face
        scene.add(target);
        state.targets.push(target);
        
        setTimeout(() => {
            scene.remove(target);
            state.targets = state.targets.filter(t => t !== target);
        }, 7000);
    };

    const setupInput = () => {
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);

        document.addEventListener('mousedown', (e) => {
            if (!state.isLocked) {
                renderer.domElement.requestPointerLock();
                return;
            }
            if(e.button === 2) {
                state.isScoped = true;
                document.getElementById('reticle').style.display = 'block';
                document.getElementById('scope-status').innerText = 'SCOPED';
            }
            if(e.button === 0) {
                raycaster.setFromCamera(center, camera);
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

        document.addEventListener('pointerlockchange', () => {
            state.isLocked = document.pointerLockElement === renderer.domElement;
        });

        document.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                const sensitivity = state.isScoped ? 0.0002 : 0.002;
                state.yaw -= e.movementX * sensitivity;
                state.pitch -= e.movementY * sensitivity;
                state.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });

        document.addEventListener('contextmenu', e => e.preventDefault());
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const zoomSpeed = 0.15;
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
