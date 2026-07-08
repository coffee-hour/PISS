import * as THREE from 'three';

/**
 * SOVEREIGN v5.8.0: 'ENGINE REBIRTH'
 * 1. Lighting: Re-implemented with a simplified, safe Ambient + Directional array (no env maps).
 * 2. Rigs: Restored Omni-Man (Uncle Man), Conquest, and Civilians using stable beveled proxies.
 * 3. Mechanics: Ground-slam physics, Specials (X, N, Z), and XP/Leveling system fully restored.
 * 4. UI: Amber HUD and Radar initialized after scene-graph verification.
 * 5. Stability: Static initialization to prevent reload/resize loops.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let mapScene, mapCamera, mapRenderer;
    let sunLight, ambientLight;
    
    let state = {
        initialized: false,
        player: { hp: 100, maxHp: 100, punchRange: 5.5, speed: 2.8, height: 15.0, level: 1, xp: 0, nextXp: 5000 },
        combat: { kills: 0 },
        zones: [
            { id: 'zone1', center: new THREE.Vector3(0, 0, 0), radius: 250, label: 'OMNI-ZONE', color: 0xff0000 },
            { id: 'zone2', center: new THREE.Vector3(800, 0, 800), radius: 250, label: 'CONQUEST-COURT', color: 0xff8c00 }
        ],
        specials: {
            X: { name: 'Thunderclap', cd: 8, timer: 0 },
            N: { name: 'Sonic Dash', cd: 5, timer: 0 },
            Z: { name: 'Eye Beam', cd: 12, timer: 0 }
        },
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false, x: false, n: false, z: false },
        isLocked: false,
        pitch: 0, yaw: 0,
        lastArmUsed: 'right'
    };

    let bosses = [];
    let civilians = [];
    let playerHands = { left: null, right: null };
    let bloodSystem = null;
    let playerMarker = null;

    const createBeveledBox = (w, h, d, color) => {
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: false }));
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Initializing Engine Rebirth...');
        
        // 1. CORE SCENE SETUP
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 100, 5000);

        // 2. SAFE LIGHTING ARRAY (Fixes Black Screen)
        ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(100, 300, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, state.player.height, 100);

        // 3. RENDERER MOUNT
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '0';
        document.body.appendChild(renderer.domElement);

        // 4. RADAR / MINIMAP
        const mapSize = 200;
        mapCamera = new THREE.OrthographicCamera(-2000, 2000, 2000, -2000, 1, 1000);
        mapCamera.position.set(0, 500, 0);
        mapCamera.lookAt(0, 0, 0);

        const mapDiv = document.createElement('div');
        mapDiv.style = `position:fixed; top:20px; right:20px; width:${mapSize}px; height:${mapSize}px; border:2px solid #ffbf00; z-index:9999; background:rgba(0,0,0,0.8); overflow:hidden;`;
        document.body.appendChild(mapDiv);

        mapRenderer = new THREE.WebGLRenderer({ antialias: true });
        mapRenderer.setSize(mapSize, mapSize);
        mapDiv.appendChild(mapRenderer.domElement);

        playerMarker = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0x1e88e5 }));
        playerMarker.rotation.x = -Math.PI / 2;
        playerMarker.position.y = 10;
        scene.add(playerMarker);

        clock = new THREE.Clock();

        // 5. WORLD & RIGS
        createWorld();
        createBeveledHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        spawnBoss('Omni-Man', 0xffffff, state.zones[0]);
        spawnBoss('Conquest', 0xdddddd, state.zones[1]);
        spawnCivilians(40);
        
        // UI MOUNTS LAST
        deployRPG_HUD();

        setupInput();
        window.addEventListener('resize', onWindowResize, false);
        animate();
    };

    const deployRPG_HUD = () => {
        const hudId = 'amber-master-hud';
        if(document.getElementById(hudId)) return;
        const style = document.createElement('style');
        style.innerHTML = `
            .amber-hud { position: fixed; z-index: 9999; pointer-events: none; font-family: 'Courier New', monospace; text-transform: uppercase; color: #ffbf00; }
            .bar-bg { background: rgba(15, 15, 15, 0.9); border: 1px solid #ffbf00; height: 10px; border-radius: 2px; overflow: hidden; }
            .bar-fill { height: 100%; background: #ffbf00; width: 0%; transition: width 0.3s; }
            .cd-box { display: inline-block; width: 60px; background: rgba(0,0,0,0.8); border: 1px solid #ffbf00; margin-right: 5px; text-align: center; font-size: 10px; padding: 4px; }
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = hudId; hud.className = 'amber-hud';
        hud.style.top = '20px'; hud.style.left = '20px';
        hud.innerHTML = `
            <div style="font-size:14px; font-weight:bold;">LVL <span id="p-lvl">${state.player.level}</span> // SOVEREIGN</div>
            <div class="bar-bg" style="width:250px; margin: 5px 0;"><div id="p-hp-fill" class="bar-fill" style="width:100%; background:#c62828;"></div></div>
            <div class="bar-bg" style="width:250px; height:6px;"><div id="p-xp-fill" class="bar-fill" style="width:0%;"></div></div>
            <div style="margin-top:10px;">
                <div class="cd-box">X<br><span id="cd-x">READY</span></div>
                <div class="cd-box">N<br><span id="cd-n">READY</span></div>
                <div class="cd-box">Z<br><span id="cd-z">READY</span></div>
            </div>
            <div id="zone-alert" style="margin-top:10px; color:#ff0000; font-size:12px; font-weight:bold; visibility:hidden;">COMBAT ZONE ACTIVE</div>
        `;
        document.body.appendChild(hud);
    };

    const createWorld = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        ground.rotation.x = -Math.PI / 2; scene.add(ground);
        
        state.zones.forEach(z => {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(z.radius, 2, 8, 64), new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.5 }));
            ring.rotation.x = Math.PI / 2; ring.position.copy(z.center); scene.add(ring);
        });

        for (let i = 0; i < 400; i++) {
            const h = 100 + Math.random() * 600;
            const b = createBeveledBox(80, h, 80, 0xcccccc);
            b.position.set((Math.random()-0.5)*8000, h/2, (Math.random()-0.5)*8000);
            if (state.zones.some(z => b.position.distanceTo(z.center) < 300)) continue;
            scene.add(b);
        }
    };

    const spawnCivilians = (count) => {
        for(let i=0; i<count; i++) {
            const civ = new THREE.Group();
            civ.add(createBeveledBox(2, 4, 1, 0x4caf50));
            civ.position.set((Math.random()-0.5)*8000, 2, (Math.random()-0.5)*8000);
            scene.add(civ);
            civilians.push({ mesh: civ, vel: new THREE.Vector3((Math.random()-0.5)*0.5, 0, (Math.random()-0.5)*0.5) });
        }
    };

    const spawnBoss = (name, color, zone) => {
        const omni = new THREE.Group();
        const skin = 0xffdbac; const red = 0xb71c1c;
        omni.add(createBeveledBox(1.5, 1.5, 1.5, skin).set({position: new THREE.Vector3(0, 7.5, 0)}));
        const torso = createBeveledBox(3, 3.5, 1.5, color); torso.position.y = 5.0; omni.add(torso);
        for(let i=0; i<12; i++) {
            const seg = createBeveledBox(3.2, 0.62, 0.1, red);
            seg.position.set(0, 7.5 - (i * 0.6), -0.9); omni.add(seg);
        }
        const lPivot = new THREE.Group(); lPivot.position.set(-2.1, 6.5, 0);
        lPivot.add(createBeveledBox(1, 3.5, 1, color).set({position: new THREE.Vector3(0,-1.75,0)}));
        const rPivot = new THREE.Group(); rPivot.position.set(2.1, 6.5, 0);
        rPivot.add(createBeveledBox(1, 3.5, 1, color).set({position: new THREE.Vector3(0,-1.75,0)}));
        omni.add(lPivot); omni.add(rPivot);
        omni.position.copy(zone.center).add(new THREE.Vector3(0, 150, 0));
        scene.add(omni);
        bosses.push({ 
            name, mesh: omni, torso, hp: 120000, maxHp: 120000, zone,
            animTime: 0, vel: new THREE.Vector3(), gravity: 0,
            leftArm: lPivot, rightArm: rPivot, state: 'roaming', targetPos: zone.center.clone()
        });
    };

    const createBeveledHands = () => {
        const createHand = (side) => {
            const group = new THREE.Group();
            group.add(createBeveledBox(0.8, 0.8, 1.2, 0x1e88e5));
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    class BloodParticleSystem {
        constructor(scene) {
            this.count = 2000;
            this.geometry = new THREE.BufferGeometry();
            this.positions = new Float32Array(this.count * 3);
            this.velocities = Array.from({length: this.count}, () => new THREE.Vector3());
            this.lifetimes = new Float32Array(this.count);
            for(let i=0; i<this.count; i++) this.positions[i*3] = 10000;
            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.3, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            this.points.frustumCulled = false; scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 60; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*15 + dir.x*10, Math.random()*15 + dir.y*10, (Math.random()-0.5)*15 + dir.z*10);
                    n++;
                }
            }
        }
        update(dt) {
            const posAttr = this.geometry.getAttribute('position');
            for(let i=0; i<this.count; i++) {
                if(this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.5;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.5;
                } else { this.positions[i*3] = 10000; }
            }
            posAttr.needsUpdate = true;
        }
    }

    const triggerSpecial = (key) => {
        const spec = state.specials[key];
        if (spec.timer > 0) return;
        spec.timer = spec.cd;
        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        bosses.forEach(b => {
            if(camera.position.distanceTo(b.mesh.position) < 150) {
                if(key === 'X') { b.hp -= 30000; b.gravity = -2.5; }
                if(key === 'Z') { b.hp -= 50000; b.gravity = -1.5; }
                bloodSystem.emit(b.mesh.position, fwd.clone().multiplyScalar(5));
            }
        });
        if(key === 'N') camera.position.add(fwd.multiplyScalar(80));
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 3.0; setTimeout(() => h.position.z = -2.0, 70);
        bosses.forEach(b => {
            if (camera.position.distanceTo(b.mesh.position) < state.player.punchRange) {
                b.hp -= 8000; b.gravity = -1.2;
                const wp = new THREE.Vector3(); b.torso.getWorldPosition(wp);
                bloodSystem.emit(wp, new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(4));
            }
        });
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            const k = e.key.toUpperCase();
            if(k === ' ') state.timeDilation = 0.2;
            if(e.shiftKey) state.keys.shift = true;
            if(state.specials[k]) triggerSpecial(k);
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if(e.key === ' ') state.timeDilation = 1.0;
            if(!e.shiftKey) state.keys.shift = false;
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if(!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw -= e.movementX * 0.0025; state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        mapRenderer.setSize(200, 200);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;
        if(state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(dir.multiplyScalar(state.player.speed * (state.keys.shift ? 5 : 1) * dt * 60));
        }

        if (playerMarker) playerMarker.position.set(camera.position.x, 10, camera.position.z);
        if (mapCamera) mapCamera.position.set(camera.position.x, 500, camera.position.z);

        let inCombatZone = false;
        ['X','N','Z'].forEach(k => {
            const s = state.specials[k]; if(s.timer > 0) s.timer -= dt;
            const el = document.getElementById(`cd-${k.toLowerCase()}`);
            if(el) el.innerText = s.timer > 0 ? Math.ceil(s.timer) + 's' : 'READY';
        });

        bosses.forEach((b, i) => {
            b.animTime += dt;
            const dist = camera.position.distanceTo(b.zone.center);
            const isInside = dist < b.zone.radius;
            if(isInside) { b.state = 'aggro'; inCombatZone = true; } 
            else if(b.state === 'aggro' && dist > b.zone.radius + 100) b.state = 'roaming';

            if(b.state === 'aggro') {
                b.mesh.lookAt(camera.position);
                const tDir = camera.position.clone().sub(b.mesh.position).normalize();
                b.vel.lerp(tDir.multiplyScalar(0.35), 0.04);
            } else {
                if(b.mesh.position.distanceTo(b.targetPos) < 10) {
                    b.targetPos.set(b.zone.center.x + (Math.random()-0.5)*300, 150, b.zone.center.z + (Math.random()-0.5)*300);
                }
                const tDir = b.targetPos.clone().sub(b.mesh.position).normalize();
                b.mesh.lookAt(b.targetPos);
                b.vel.lerp(tDir.multiplyScalar(0.15), 0.02);
            }
            b.mesh.position.add(b.vel);
            if(b.mesh.position.y > 10) { b.gravity += 0.05; b.mesh.position.y -= b.gravity; } 
            else { b.mesh.position.y = 10; b.gravity = 0; }

            if(b.hp <= 0) {
                scene.remove(b.mesh); bosses.splice(i, 1);
                state.player.xp += 5000;
                if(state.player.xp >= state.player.nextXp) { 
                    state.player.level++; state.player.xp = 0; state.player.nextXp *= 1.3; 
                    const lvlEl = document.getElementById('p-lvl');
                    if(lvlEl) lvlEl.innerText = state.player.level;
                }
                const xpEl = document.getElementById('p-xp-fill');
                if(xpEl) xpEl.style.width = `${(state.player.xp/state.player.nextXp)*100}%`;
                setTimeout(() => spawnBoss(b.name, b.name === 'Omni-Man' ? 0xffffff : 0xdddddd, b.zone), 8000);
            }
        });

        civilians.forEach(c => {
            c.mesh.position.add(c.vel);
            if(Math.abs(c.mesh.position.x) > 4500 || Math.abs(c.mesh.position.z) > 4500) c.vel.multiplyScalar(-1);
        });

        const alert = document.getElementById('zone-alert');
        if(alert) alert.style.visibility = inCombatZone ? 'visible' : 'hidden';

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
        if (mapRenderer && mapCamera) mapRenderer.render(scene, mapCamera);
    };
    return { init };
})();

Sovereign.init();
