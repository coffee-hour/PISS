import * as THREE from 'three';

/**
 * SOVEREIGN v6.0.6: 'BALLISTICS & RAGDOLLS'
 * 1. Projectiles: Switched from raycasts to physical bullet entities with gravity drop.
 * 2. Tracers: Glowing light trails that persist and fade after impact.
 * 3. Decals: Impact marks are placed on building facades.
 * 4. Ragdolls: Targets now fall with gravity upon impact instead of vanishing.
 * 5. Daytime: Maintained full-sun intensity and sky-blue atmosphere.
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
        bullets: [],
        tracers: [],
        decals: [],
        pitch: 0,
        yaw: 0
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 1500, 6000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 150, 0);
        camera.rotation.order = 'YXZ';

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        hemiLight = new THREE.HemisphereLight(0xddeeff, 0x444444, 1.5);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(50, 1000, 50);
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
            <div id="reticle"><div id="cross-h"></div><div id="cross-v"></div></div>
            <div class="sniper-stats">KILLS: <span id="kill-count">0</span><br>STATUS: <span id="scope-status">UNSCOPED</span></div>
            <div id="system-alert">CLICK TO LOCK // HOLD RIGHT-CLICK TO SCOPE // PROJECTILE PHYSICS ACTIVE</div>
        `;
        document.body.appendChild(hud);
    };

    const createCityscape = () => {
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
            b.userData.isBuilding = true; b.userData.height = h; b.userData.width = w;
            scene.add(b);
        }
    };

    const spawnTarget = () => {
        if(state.targets.filter(t => !t.userData.isDead).length > 10) return;
        const buildings = scene.children.filter(c => c.userData.isBuilding);
        const b = buildings[Math.floor(Math.random() * buildings.length)];
        const target = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 1.5), new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 }));
        target.add(body);
        const xOff = (Math.random()-0.5) * (b.userData.width - 20);
        const yOff = (Math.random() * b.userData.height) - (b.userData.height / 2);
        target.position.copy(b.position);
        target.position.x += xOff; target.position.y = Math.max(10, b.position.y + yOff); target.position.z += 76;
        target.userData = { isDead: false, velocity: new THREE.Vector3() };
        scene.add(target);
        state.targets.push(target);
    };

    const setupInput = () => {
        document.addEventListener('mousedown', (e) => {
            if (!state.isLocked) { renderer.domElement.requestPointerLock(); return; }
            if(e.button === 2) {
                state.isScoped = true;
                document.getElementById('reticle').style.display = 'block';
                document.getElementById('scope-status').innerText = 'SCOPED';
            }
            if(e.button === 0) fireBullet();
        });
        document.addEventListener('mouseup', (e) => {
            if(e.button === 2) {
                state.isScoped = false;
                document.getElementById('reticle').style.display = 'none';
                document.getElementById('scope-status').innerText = 'UNSCOPED';
            }
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === renderer.domElement; });
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

    const fireBullet = () => {
        const bullet = {
            position: camera.position.clone(),
            velocity: new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(500),
            gravity: new THREE.Vector3(0, -9.8, 0),
            path: [camera.position.clone()]
        };
        state.bullets.push(bullet);

        // Initial Tracer
        const lineGeo = new THREE.BufferGeometry().setFromPoints([bullet.position, bullet.position]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
        state.tracers.push({ mesh: line, points: [bullet.position.clone()], life: 1.0 });
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta();
        
        // FOV Zoom
        camera.fov = THREE.MathUtils.lerp(camera.fov, state.isScoped ? state.targetZoom : 75, 0.15);
        camera.updateProjectionMatrix();

        // Bullet Physics
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            const prevPos = b.position.clone();
            
            b.velocity.add(b.gravity.clone().multiplyScalar(dt));
            b.position.add(b.velocity.clone().multiplyScalar(dt));

            const ray = new THREE.Raycaster(prevPos, b.velocity.clone().normalize(), 0, prevPos.distanceTo(b.position));
            
            // Check Buildings
            const bIntersects = ray.intersectObjects(scene.children.filter(c => c.userData.isBuilding));
            if (bIntersects.length > 0) {
                const p = bIntersects[0].point;
                const decal = new THREE.Mesh(new THREE.CircleGeometry(0.5, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                decal.position.copy(p).add(bIntersects[0].face.normal.multiplyScalar(0.1));
                decal.lookAt(p.clone().add(bIntersects[0].face.normal));
                scene.add(decal);
                state.bullets.splice(i, 1);
                continue;
            }

            // Check Targets
            const tIntersects = ray.intersectObjects(state.targets.filter(t => !t.userData.isDead), true);
            if (tIntersects.length > 0) {
                const target = tIntersects[0].object.parent;
                target.userData.isDead = true;
                target.userData.velocity = b.velocity.clone().multiplyScalar(0.01);
                state.score++;
                document.getElementById('kill-count').innerText = state.score;
                state.bullets.splice(i, 1);
                continue;
            }

            if (b.position.length() > 10000 || b.position.y < 0) state.bullets.splice(i, 1);
        }

        // Tracers
        state.tracers.forEach((t, i) => {
            t.life -= dt;
            t.mesh.material.opacity = t.life;
            if (t.life <= 0) { scene.remove(t.mesh); state.tracers.splice(i, 1); }
        });

        // Ragdolls
        state.targets.forEach((t, i) => {
            if (t.userData.isDead) {
                t.userData.velocity.y -= 0.5;
                t.position.add(t.userData.velocity);
                t.rotation.x += 0.1;
                if (t.position.y < -100) { scene.remove(t); state.targets.splice(i, 1); }
            }
        });

        renderer.render(scene, camera);
    };

    return { init };
})();

SniperElite.init();
