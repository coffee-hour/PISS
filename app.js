import * as THREE from 'three';

/**
 * SOVEREIGN v7.0.0: 'MAJOR REBUILD'
 * 1. Firing Logic: Switched to 'pointerdown' on window to bypass lock-request event suppression.
 * 2. Shading Fix: Buildings now use MeshPhongMaterial with calibrated light response (Grey/Concrete).
 * 3. Nest: Positioned at 200 units height on a dedicated sniper platform.
 * 4. NPCs: R6 entities with side-to-side walk loops added to target windows.
 * 5. Physics: Physical ballistics, tracers, and ragdolls maintained.
 */

const SniperElite = (() => {
    let scene, camera, renderer, clock;
    let sunLight, hemiLight, ambientLight;
    
    let state = {
        initialized: false,
        isScoped: false,
        isLocked: false,
        zoom: 75,
        targetZoom: 15,
        score: 0,
        targets: [],
        bullets: [],
        tracers: [],
        pitch: 0,
        yaw: 0
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Bright Sky
        scene.fog = new THREE.Fog(0x87ceeb, 2000, 8000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 205, 50); // Nest Position
        camera.rotation.order = 'YXZ';

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // CALIBRATED SHADING LIGHTS
        ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);
        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        sunLight.position.set(200, 1000, 200);
        scene.add(sunLight);

        createCityscape();
        deploySniperHUD();
        setupInput();
        
        clock = new THREE.Clock();
        animate();
    };

    const deploySniperHUD = () => {
        const hudId = 'sniper-hud';
        if(document.getElementById(hudId)) document.getElementById(hudId).remove();
        const style = document.createElement('style');
        style.innerHTML = `
            #sniper-hud { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 10; font-family: 'Courier New', monospace; text-transform: uppercase; }
            #reticle { position: absolute; top: 50%; left: 50%; width: 400px; height: 400px; border: 2px solid #ffbf00; border-radius: 50%; transform: translate(-50%, -50%); display: none; box-shadow: 0 0 0 5000px rgba(0,0,0,0.85); }
            #cross-h { position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: #ffbf00; }
            #cross-v { position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: #ffbf00; }
            .stats { position: fixed; top: 20px; left: 20px; color: #ffbf00; font-size: 18px; font-weight: bold; text-shadow: 2px 2px #000; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = hudId;
        hud.innerHTML = `
            <div id="reticle"><div id="cross-h"></div><div id="cross-v"></div></div>
            <div class="stats">KILLS: <span id="kill-count">0</span><br>SCOPE: <span id="scope-status">OFF</span></div>
        `;
        document.body.appendChild(hud);
    };

    const createCityscape = () => {
        // Ground
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshPhongMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Player Nest Skyscraper
        const nestBase = new THREE.Mesh(new THREE.BoxGeometry(60, 200, 60), new THREE.MeshPhongMaterial({ color: 0x666666 }));
        nestBase.position.set(0, 100, 50);
        scene.add(nestBase);

        // Target Buildings
        const buildingMat = new THREE.MeshPhongMaterial({ color: 0x999999, shininess: 10 });
        for(let i=0; i<15; i++) {
            const h = 400 + Math.random() * 400;
            const w = 150 + Math.random() * 50;
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 100), buildingMat);
            b.position.set((Math.random()-0.5)*1200, h/2, -800 - Math.random() * 600);
            b.userData.isBuilding = true;
            scene.add(b);

            // Add Window Targets
            for(let j=0; j<3; j++) {
                spawnNPC(b, h, w);
            }
        }
    };

    const spawnNPC = (b, bH, bW) => {
        const target = new THREE.Group();
        const r6 = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 2), new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 }));
        target.add(r6);
        
        const xRange = (bW / 2) - 10;
        const startX = (Math.random() - 0.5) * xRange;
        const yPos = (Math.random() * bH) - (bH / 2);

        target.position.copy(b.position);
        target.position.x += startX;
        target.position.y = Math.max(20, b.position.y + yPos);
        target.position.z += 52; // Front of building

        target.userData = {
            isDead: false,
            velocity: new THREE.Vector3(),
            walkCenter: startX,
            walkRange: 15,
            walkSpeed: 1 + Math.random() * 2,
            animTime: Math.random() * 10
        };

        scene.add(target);
        state.targets.push(target);
    };

    const setupInput = () => {
        // Use window pointerdown to ensure capture even during lock phase
        window.addEventListener('pointerdown', (e) => {
            if (!state.isLocked) {
                renderer.domElement.requestPointerLock();
            } else {
                if(e.button === 0) fireBullet();
            }

            if(e.button === 2) {
                state.isScoped = true;
                const ret = document.getElementById('reticle');
                if(ret) ret.style.display = 'block';
                const status = document.getElementById('scope-status');
                if(status) status.innerText = 'ACTIVE';
            }
        });

        window.addEventListener('pointerup', (e) => {
            if(e.button === 2) {
                state.isScoped = false;
                const ret = document.getElementById('reticle');
                if(ret) ret.style.display = 'none';
                const status = document.getElementById('scope-status');
                if(status) status.innerText = 'OFF';
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
                state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
        document.addEventListener('contextmenu', e => e.preventDefault());
    };

    const fireBullet = () => {
        const bullet = {
            position: camera.position.clone(),
            velocity: new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(600),
            gravity: new THREE.Vector3(0, -9.8, 0)
        };
        state.bullets.push(bullet);

        const lineGeo = new THREE.BufferGeometry().setFromPoints([bullet.position, bullet.position]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
        state.tracers.push({ mesh: line, life: 1.0 });
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = Math.min(clock.getDelta(), 0.1);
        
        camera.fov = THREE.MathUtils.lerp(camera.fov, state.isScoped ? state.targetZoom : 75, 0.15);
        camera.updateProjectionMatrix();

        // NPCs - Walk Loop & Ragdoll
        state.targets.forEach((t) => {
            if (t.userData.isDead) {
                t.userData.velocity.y -= 0.5 * dt * 60;
                t.position.add(t.userData.velocity);
                t.rotation.x += 0.1;
            } else {
                t.userData.animTime += dt;
                const offset = Math.sin(t.userData.animTime * t.userData.walkSpeed) * t.userData.walkRange;
                t.position.x = t.userData.walkCenter + offset;
            }
        });

        // Bullet Physics
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            const prev = b.position.clone();
            b.velocity.add(b.gravity.clone().multiplyScalar(dt));
            b.position.add(b.velocity.clone().multiplyScalar(dt));

            const ray = new THREE.Raycaster(prev, b.velocity.clone().normalize(), 0, prev.distanceTo(b.position));
            
            const buildings = scene.children.filter(c => c.userData.isBuilding);
            const bHits = ray.intersectObjects(buildings);
            if (bHits.length > 0) {
                const hit = bHits[0];
                const decal = new THREE.Mesh(new THREE.CircleGeometry(0.8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
                decal.position.copy(hit.point).add(hit.face.normal.multiplyScalar(0.1));
                decal.lookAt(hit.point.clone().add(hit.face.normal));
                scene.add(decal);
                state.bullets.splice(i, 1);
                continue;
            }

            const tHits = ray.intersectObjects(state.targets.filter(t => !t.userData.isDead), true);
            if (tHits.length > 0) {
                const target = tHits[0].object.parent;
                target.userData.isDead = true;
                target.userData.velocity = b.velocity.clone().multiplyScalar(0.015);
                state.score++;
                document.getElementById('kill-count').innerText = state.score;
                state.bullets.splice(i, 1);
                continue;
            }

            if (b.position.length() > 8000 || b.position.y < -50) state.bullets.splice(i, 1);
        }

        state.tracers.forEach((t, i) => {
            t.life -= dt;
            t.mesh.material.opacity = t.life;
            if (t.life <= 0) { scene.remove(t.mesh); state.tracers.splice(i, i); }
        });

        renderer.render(scene, camera);
    };

    return { init };
})();

SniperElite.init();
