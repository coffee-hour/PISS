import * as THREE from 'three';

/**
 * Sovereign AAA (v4.7.1)
 * Features: Expanded Combat Radius, Increased Eye-Level Altitude, Contact Feedback,
 * High-Action FOV, Y-Axis Billboard Lock, AI Flight Restriction, Map (M), Arena Lock.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster, collisionRaycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, maxHp: 100, strength: 1, speed: 1, xp: 0, points: 0,
            punchRange: 12, isFlying: false, height: 2.8 // v4.7.1: Increased default eye-level
        },
        run: { kills: 0, tier: 1, active: true, choicesPending: false },
        timeDilation: 0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false, m: false },
        lastArmUsed: 'right',
        isLocked: false,
        mapOpen: false
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID', color: 0xff4081, hp: 120, weight: 1, unique: false, power: 5, flies: false },
        { id: 'flaxan', name: 'FLAXAN SOLDIER', color: 0xf57c00, hp: 150, weight: 1, unique: false, power: 8, flies: false },
        { id: 'atomeve', name: 'ATOM EVE', color: 0xe91e63, hp: 600, weight: 3, unique: true, power: 15, flies: true },
        { id: 'robot', name: 'ROBOT', color: 0x388e3c, hp: 800, weight: 3, unique: true, power: 18, flies: false },
        { id: 'omniman', name: 'OMNI-MAN', color: 0x455a64, hp: 20000, weight: 10, unique: true, boss: true, power: 55, flies: true },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xd32f2f, hp: 25000, weight: 10, unique: true, boss: true, power: 65, flies: true }
    ];

    let enemies = [];
    let buildings = [];
    let bloodParticles = [];
    let sparks = [];
    const OMNI_ARENA_CENTER = new THREE.Vector3(0, 0, 400);
    const OMNI_ARENA_RADIUS = 60;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xddeeff);
        scene.fog = new THREE.Fog(0xddeeff, 200, 900);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfffaf0, 1.8);
        sunLight.position.set(400, 800, 400);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createInvincibleCity();
        setupControls();
        spawnWorldSectors();
        forceBossSpawn(roster[4], OMNI_ARENA_CENTER.clone()); 
        forceBossSpawn(roster[5], new THREE.Vector3(500, 0, 500));

        animate();
    };

    const createInvincibleCity = () => {
        const floorGeo = new THREE.PlaneGeometry(7000, 7000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        // Canonical Districts
        const cityMap = [
            { x: 100, z: 100, w: 40, h: 120, d: 40 },
            { x: -100, z: 100, w: 40, h: 100, d: 40 },
            { x: 100, z: -100, w: 40, h: 110, d: 40 },
            { x: -100, z: -100, w: 40, h: 130, d: 40 },
        ];

        cityMap.forEach(data => {
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(data.w, data.h, data.d);
            b.position.set(data.x, data.h/2, data.z);
            b.castShadow = true; b.receiveShadow = true;
            scene.add(b); buildings.push(b);
        });

        let seed = 54321;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 550; i++) {
            const h = 50 + random() * 100;
            const w = 25 + random() * 30;
            const d = 25 + random() * 30;
            const x = (random() - 0.5) * 2500;
            const z = (random() - 0.5) * 2500;
            if (new THREE.Vector3(x, 0, z).distanceTo(OMNI_ARENA_CENTER) < OMNI_ARENA_RADIUS + 70) continue;
            if (Math.abs(x) < 100 && Math.abs(z) < 100) continue;
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b); buildings.push(b);
        }
    };

    const setupControls = () => {
        window.addEventListener('keydown', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = true;
            if (key === 'f') state.player.isFlying = !state.player.isFlying;
            if (key === 'm') toggleMap();
        });
        window.addEventListener('keyup', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = false; 
        });
        window.addEventListener('mousedown', () => {
            if (!state.isLocked && !state.mapOpen) document.body.requestPointerLock();
            else if (state.run.active && !state.mapOpen) performStrike();
        });
        document.addEventListener('pointerlockchange', () => { 
            state.isLocked = document.pointerLockElement === document.body; 
        });
        window.addEventListener('mousemove', (e) => {
            if (state.isLocked && !state.mapOpen) {
                camera.rotation.y -= e.movementX * 0.002;
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
                camera.rotation.z = 0;
            }
        });
    };

    const toggleMap = () => {
        state.mapOpen = !state.mapOpen;
        const overlay = document.getElementById('map-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden');
            if (state.mapOpen) document.exitPointerLock();
            else if (state.isLocked) document.body.requestPointerLock();
        }
    };

    const createNPCStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        const cx = 128;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 18;
        drawBase(ctx, cx);
        ctx.strokeStyle = color; ctx.lineWidth = 12;
        drawBase(ctx, cx); 
        return new THREE.CanvasTexture(canvas);
    };

    const drawBase = (ctx, cx) => {
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();
    };

    const spawnEnemy = (data, pos) => {
        const texture = createNPCStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4.5, 9, 1);
        sprite.position.copy(pos);
        sprite.position.y = 4.5;
        scene.add(sprite);
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(2.5, 0);
            const iconMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 8, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(45, 48, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb71c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos); ring.position.y = 0.1;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        let seed = 333;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for(let i = 0; i < 90; i++) {
            const angle = random() * Math.PI * 2;
            const r = 300 + random() * 800;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            if (pos.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS + 100) {
                spawnEnemy(roster[i % 2], pos);
            }
        }
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        state.lastArmUsed = state.lastArmUsed === 'left' ? 'right' : 'left';
        animateFist(state.lastArmUsed);
        
        // v4.7.1: SIGNIFICANTLY EXPANDED FRONT-ARC HIT DETECTION
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            // v4.7.1: Front arc check
            const dirToEnemy = enemy.sprite.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const dot = dirToEnemy.dot(forward);

            if (dist <= state.player.punchRange && dot > 0.8) { // Wide front cone
                hitEnemy(enemy, enemy.sprite.position.clone());
            }
        });
    };

    const hitEnemy = (enemy, point) => {
        enemy.data.hp -= 250 * state.player.strength;
        spawnBlood(point);
        spawnContactFlash(point); // v4.7.1: Contact Feedback
        updateTargetHUD(enemy.data);
        if (enemy.data.hp <= 0) {
            scene.remove(enemy.sprite);
            enemies = enemies.filter(e => e !== enemy);
            gainXP(enemy.data.weight * 50);
        }
    };

    const spawnContactFlash = (pos) => {
        const flashGeo = new THREE.SphereGeometry(2, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(pos);
        scene.add(flash);
        let life = 1.0;
        const fade = () => {
            life -= 0.15; flash.scale.setScalar(life); flash.material.opacity = life;
            if (life > 0) requestAnimationFrame(fade); else scene.remove(flash);
        };
        fade();
    };

    const animateFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if(fist) {
            fist.style.transform = `translateY(-260px) scale(1.45) rotate(${side === 'left' ? 30 : -30}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 800) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.5, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb71c1c });
        for (let i = 0; i < 60; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*1.6, (Math.random()-0.5)*1.6, (Math.random()-0.5)*1.6), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        if (state.mapOpen) {
            drawMapOverlay();
            return;
        }

        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];
        if (moving) {
            state.timeDilation = superSpeed ? 0.12 : 1.0; 
            const speed = (superSpeed ? 3.0 : 0.95);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            
            // v4.7.1: Altitude retention
            if (state.player.isFlying) camera.position.y = Math.min(300, camera.position.y + 1.0);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 1.2);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            enemy.sprite.quaternion.copy(camera.quaternion);
            enemy.sprite.rotation.x = 0; enemy.sprite.rotation.z = 0;

            if (enemy.data.flies) {
                if (dist < 400) {
                    const targetY = Math.max(4.5, camera.position.y + (Math.sin(Date.now() * 0.002) * 4));
                    enemy.sprite.position.y += (targetY - enemy.sprite.position.y) * 0.05 * dt;
                }
            } else {
                enemy.sprite.position.y = 4.5;
            }

            if (enemy.data.id === 'omniman') {
                if (enemy.sprite.position.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS) {
                    enemy.sprite.position.add(OMNI_ARENA_CENTER.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.45 * dt));
                }
            }
            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 8.5 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 400 && dist > 8.5) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.22 * dt));
            }
            if (dist < 11 && state.run.active) {
                enemy.attackTimer += (0.028 * dt);
                if (enemy.attackTimer >= 1.0) {
                    state.player.hp -= enemy.data.power; enemy.attackTimer = 0;
                    if (state.player.hp <= 0) die();
                }
            }
        });

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.015 * dt; p.userData.life -= 0.02 * dt; p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { scene.remove(p); bloodParticles.splice(i, 1); }
        });

        updateUI(); drawMinimap(); renderer.render(scene, camera);
    };

    const drawMinimap = () => {
        const canvas = document.getElementById('minimap'); if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)'; ctx.fillRect(0, 0, 200, 200);
        const cx = 100, cy = 100;
        ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2); ctx.fill();
        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * 0.2;
            const dz = (e.sprite.position.z - camera.position.z) * 0.2;
            if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0');
                ctx.beginPath(); ctx.arc(cx + dx, dz + cy, 4, 0, Math.PI*2); ctx.fill();
            }
        });
    };

    const drawMapOverlay = () => {
        const canvas = document.getElementById('map-canvas'); if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,800,800);
        ctx.fillStyle = 'rgba(10, 10, 30, 0.98)'; ctx.fillRect(0,0,800,800);
        const center = 400, scale = 0.25;
        buildings.forEach(b => { ctx.fillStyle = '#666'; ctx.fillRect(center + b.position.x*scale, center + b.position.z*scale, 7, 7); });
        ctx.strokeStyle = '#b71c1c'; ctx.beginPath(); ctx.arc(center + OMNI_ARENA_CENTER.x*scale, center + OMNI_ARENA_CENTER.z*scale, OMNI_ARENA_RADIUS*scale, 0, Math.PI*2); ctx.stroke();
        enemies.forEach(e => { ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0'); ctx.beginPath(); ctx.arc(center + e.sprite.position.x*scale, center + e.sprite.position.z*scale, 4, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(center + camera.position.x*scale, center + camera.position.z*scale, 8, 0, Math.PI*2); ctx.fill();
    };

    const updateUI = () => {
        const php = document.getElementById('player-hp');
        const xp = document.getElementById('xp-fill');
        const kills = document.getElementById('enemies-defeated');
        const tier = document.getElementById('run-tier');
        if (php) php.style.width = `${Math.max(0, state.player.hp)}%`;
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 800)) * 100}%`;
        if (kills) kills.innerText = state.run.kills;
        if (tier) tier.innerText = state.run.tier;
    };

    const updateTargetHUD = (data) => {
        const name = document.getElementById('enemy-name');
        const hp = document.getElementById('enemy-hp');
        if (name) name.innerText = data.name;
        if (hp) hp.style.width = `${(data.hp / data.maxHp) * 100}%`;
    };

    const die = () => { state.run.active = false; document.getElementById('death-overlay').classList.remove('hidden'); };
    
    return { init };
})();

window.Fighter = Fighter;
Fighter.init();
