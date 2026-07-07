import * as THREE from 'three';

/**
 * Sovereign AAA (v4.6.9)
 * Features: Reduced Fist Scale, Alpha Artifact Fix, AI Flight Restriction,
 * Full-Screen Map (M), Canonical City, Arena Lock.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster, collisionRaycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, maxHp: 100, strength: 1, speed: 1, xp: 0, points: 0,
            punchRange: 6, isFlying: false, height: 1.7
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
    const OMNI_ARENA_CENTER = new THREE.Vector3(0, 0, 400);
    const OMNI_ARENA_RADIUS = 60;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xddeeff);
        scene.fog = new THREE.Fog(0xddeeff, 120, 700);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfffaf0, 1.6);
        sunLight.position.set(300, 600, 300);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createInvincibleCity();
        setupControls();
        spawnWorldSectors();
        forceBossSpawn(roster[4], OMNI_ARENA_CENTER.clone()); 
        forceBossSpawn(roster[5], new THREE.Vector3(450, 0, 450));

        animate();
    };

    const createInvincibleCity = () => {
        const floorGeo = new THREE.PlaneGeometry(5000, 5000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        const cityMap = [
            { x: 50, z: 50, w: 25, h: 90, d: 25 },
            { x: -50, z: 50, w: 25, h: 70, d: 25 },
            { x: 50, z: -50, w: 25, h: 80, d: 25 },
            { x: -50, z: -50, w: 25, h: 100, d: 25 },
            { x: 200, z: 0, w: 50, h: 35, d: 120 },
            { x: -200, z: 0, w: 50, h: 35, d: 120 },
            { x: 0, z: 250, w: 160, h: 60, d: 40 },
            { x: 0, z: -250, w: 160, h: 55, d: 40 },
        ];

        cityMap.forEach(data => {
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(data.w, data.h, data.d);
            b.position.set(data.x, data.h/2, data.z);
            b.castShadow = true; b.receiveShadow = true;
            scene.add(b); buildings.push(b);
        });

        let seed = 999;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 480; i++) {
            const h = 30 + random() * 60;
            const w = 15 + random() * 20;
            const d = 15 + random() * 20;
            const x = (random() - 0.5) * 1800;
            const z = (random() - 0.5) * 1800;
            if (new THREE.Vector3(x, 0, z).distanceTo(OMNI_ARENA_CENTER) < OMNI_ARENA_RADIUS + 50) continue;
            if (Math.abs(x) < 60 && Math.abs(z) < 60) continue;
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
        sprite.scale.set(3.5, 7, 1);
        sprite.position.copy(pos);
        sprite.position.y = 3.5;
        scene.add(sprite);
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(2, 0);
            const iconMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 6.5, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(38, 40, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb71c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos); ring.position.y = 0.1;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        let seed = 111;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for(let i = 0; i < 70; i++) {
            const angle = random() * Math.PI * 2;
            const r = 200 + random() * 500;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            if (pos.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS + 60) {
                spawnEnemy(roster[i % 2], pos);
            }
        }
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        state.lastArmUsed = state.lastArmUsed === 'left' ? 'right' : 'left';
        animateFist(state.lastArmUsed);
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        const intersects = raycaster.intersectObjects(enemies.map(e => e.sprite));
        if (intersects.length > 0) {
            const hit = enemies.find(e => e.sprite === intersects[0].object);
            if (hit && camera.position.distanceTo(hit.sprite.position) <= state.player.punchRange) {
                hit.data.hp -= 150 * state.player.strength;
                spawnBlood(intersects[0].point);
                updateTargetHUD(hit.data);
                if (hit.data.hp <= 0) {
                    scene.remove(hit.sprite);
                    enemies = enemies.filter(e => e !== hit);
                    gainXP(hit.data.weight * 50);
                }
            }
        }
    };

    const animateFist = (side) => {
        const fist = document.getElementById(`fist-${side}`);
        if(fist) {
            fist.style.transform = `translateY(-220px) scale(1.4) rotate(${side === 'left' ? 26 : -26}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 600) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.4, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb71c1c });
        for (let i = 0; i < 45; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*1.4, (Math.random()-0.5)*1.4, (Math.random()-0.5)*1.4), life: 1.0 };
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
            const speed = (superSpeed ? 2.6 : 0.75);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            if (state.player.isFlying) camera.position.y = Math.min(180, camera.position.y + 0.85);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 0.95);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            
            // v4.6.9 AI FLIGHT LOGIC
            if (enemy.data.flies) {
                // Viltrumite/Eve logic: Match player height if tracking
                if (dist < 300) {
                    const targetY = Math.max(3.5, camera.position.y + (Math.sin(Date.now() * 0.002) * 2));
                    enemy.sprite.position.y += (targetY - enemy.sprite.position.y) * 0.05 * dt;
                }
            } else {
                // Grounded: Lock to floor
                enemy.sprite.position.y = 3.5;
            }

            if (enemy.data.id === 'omniman') {
                if (enemy.sprite.position.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS) {
                    enemy.sprite.position.add(OMNI_ARENA_CENTER.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.35 * dt));
                }
            }
            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 7.0 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 300 && dist > 7.5) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.18 * dt));
            }
            if (dist < 9.5 && state.run.active) {
                enemy.attackTimer += (0.024 * dt);
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
            const dx = (e.sprite.position.x - camera.position.x) * 0.3;
            const dz = (e.sprite.position.z - camera.position.z) * 0.3;
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
        ctx.fillStyle = 'rgba(10, 10, 20, 0.98)'; ctx.fillRect(0,0,800,800);
        const center = 400, scale = 0.35;
        buildings.forEach(b => { ctx.fillStyle = '#444'; ctx.fillRect(center + b.position.x*scale, center + b.position.z*scale, 5, 5); });
        ctx.strokeStyle = '#b71c1c'; ctx.beginPath(); ctx.arc(center + OMNI_ARENA_CENTER.x*scale, center + OMNI_ARENA_CENTER.z*scale, OMNI_ARENA_RADIUS*scale, 0, Math.PI*2); ctx.stroke();
        enemies.forEach(e => { ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0'); ctx.beginPath(); ctx.arc(center + e.sprite.position.x*scale, center + e.sprite.position.z*scale, 3, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(center + camera.position.x*scale, center + camera.position.z*scale, 6, 0, Math.PI*2); ctx.fill();
    };

    const updateUI = () => {
        const php = document.getElementById('player-hp');
        const xp = document.getElementById('xp-fill');
        const kills = document.getElementById('enemies-defeated');
        const tier = document.getElementById('run-tier');
        if (php) php.style.width = `${Math.max(0, state.player.hp)}%`;
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 600)) * 100}%`;
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
