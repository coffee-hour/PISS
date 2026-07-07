import * as THREE from 'three';

/**
 * Sovereign AAA (v4.6.7)
 * Features: Invincible Canonical City Layout, Player-Specific Blue Hands,
 * Permanent Player Mini-map Marker, Arena Lock, Daylight Visibility.
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
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false },
        lastArmUsed: 'right',
        isLocked: false
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID', color: 0xff4081, hp: 120, weight: 1, unique: false, power: 5 },
        { id: 'flaxan', name: 'FLAXAN SOLDIER', color: 0xf57c00, hp: 150, weight: 1, unique: false, power: 8 },
        { id: 'atomeve', name: 'ATOM EVE', color: 0xe91e63, hp: 600, weight: 3, unique: true, power: 15 },
        { id: 'robot', name: 'ROBOT', color: 0x388e3c, hp: 800, weight: 3, unique: true, power: 18 },
        { id: 'omniman', name: 'OMNI-MAN', color: 0x455a64, hp: 20000, weight: 10, unique: true, boss: true, power: 50 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xd32f2f, hp: 25000, weight: 10, unique: true, boss: true, power: 60 }
    ];

    let enemies = [];
    let buildings = [];
    let bloodParticles = [];
    const OMNI_ARENA_CENTER = new THREE.Vector3(0, 0, 400);
    const OMNI_ARENA_RADIUS = 60;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xddeeff);
        scene.fog = new THREE.Fog(0xddeeff, 100, 600);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfffaf0, 1.4);
        sunLight.position.set(300, 500, 300);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createInvincibleCity();
        setupControls();
        
        spawnWorldSectors();
        forceBossSpawn(roster[4], OMNI_ARENA_CENTER.clone()); 
        forceBossSpawn(roster[5], new THREE.Vector3(400, 0, 400));

        animate();
    };

    const createInvincibleCity = () => {
        const floorGeo = new THREE.PlaneGeometry(4000, 4000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(3000, 150, 0x000000, 0x888888);
        grid.position.y = 0.02;
        scene.add(grid);

        // OMNI-MAN CANONICAL ARENA (PLAZA)
        const plazaGeo = new THREE.CircleGeometry(OMNI_ARENA_RADIUS, 64);
        const plazaMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const plaza = new THREE.Mesh(plazaGeo, plazaMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.copy(OMNI_ARENA_CENTER);
        plaza.position.y = 0.05;
        scene.add(plaza);

        // FIXED INVINCIBLE CITY LAYOUT (Canonical Blocks)
        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0xfafafa });
        
        const cityMap = [
            // Central District
            { x: 50, z: 50, w: 20, h: 80, d: 20 },
            { x: -50, z: 50, w: 20, h: 60, d: 20 },
            { x: 50, z: -50, w: 20, h: 70, d: 20 },
            { x: -50, z: -50, w: 20, h: 90, d: 20 },
            // Residential Blocks
            { x: 150, z: 0, w: 40, h: 30, d: 100 },
            { x: -150, z: 0, w: 40, h: 30, d: 100 },
            // Corporate Row
            { x: 0, z: 150, w: 120, h: 45, d: 30 },
            { x: 0, z: -150, w: 120, h: 40, d: 30 },
            // Omni-Man Sector Perimeter
            { x: 100, z: 400, w: 30, h: 120, d: 30 },
            { x: -100, z: 400, w: 30, h: 110, d: 30 },
        ];

        cityMap.forEach(data => {
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(data.w, data.h, data.d);
            b.position.set(data.x, data.h/2, data.z);
            b.castShadow = true; b.receiveShadow = true;
            scene.add(b); buildings.push(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x777777 }));
            line.scale.set(data.w, data.h, data.d);
            line.position.copy(b.position);
            scene.add(line);
        });

        // Fillers for scale
        let seed = 123;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 400; i++) {
            const h = 20 + random() * 50;
            const w = 10 + random() * 15;
            const d = 10 + random() * 15;
            const x = (random() - 0.5) * 1500;
            const z = (random() - 0.5) * 1500;
            if (new THREE.Vector3(x, 0, z).distanceTo(OMNI_ARENA_CENTER) < OMNI_ARENA_RADIUS + 30) continue;
            if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;

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
        });
        window.addEventListener('keyup', (e) => { 
            const key = e.key.toLowerCase();
            if (state.keys.hasOwnProperty(key)) state.keys[key] = false; 
        });
        window.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else if (state.run.active) performStrike();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        window.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                camera.rotation.y -= e.movementX * 0.002;
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
                camera.rotation.z = 0;
            }
        });
    };

    // v4.6.7 NPC Specific Sprite (No Blue Hands)
    const createNPCStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        const cx = 128;

        ctx.strokeStyle = '#000'; ctx.lineWidth = 18;
        drawBase(ctx, cx, false); 
        ctx.strokeStyle = color; ctx.lineWidth = 12;
        drawBase(ctx, cx, false); // No hands color for NPCs
        
        if (data.id === 'omniman') {
            ctx.fillStyle = '#b71c1c'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(cx-50, 110); ctx.lineTo(cx-120, 440); ctx.lineTo(cx+120, 440); ctx.lineTo(cx+50, 110); ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        return new THREE.CanvasTexture(canvas);
    };

    const drawBase = (ctx, cx, isPlayerHands) => {
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 260); ctx.stroke();
        
        // Hand logic
        if (isPlayerHands) {
            ctx.fillStyle = '#1e88e5'; 
            ctx.beginPath(); ctx.arc(cx-80, 260, 14, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+80, 260, 14, 0, Math.PI*2); ctx.fill();
        }

        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();
    };

    const spawnEnemy = (data, pos) => {
        const texture = createNPCStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(3.2, 6.4, 1);
        sprite.position.copy(pos);
        sprite.position.y = 3.2;
        scene.add(sprite);
        
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(1.6, 0);
            const iconMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 5.5, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }

        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(30, 32, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb71c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.1;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        let seed = 456;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for(let i = 0; i < 60; i++) {
            const angle = random() * Math.PI * 2;
            const r = 150 + random() * 400;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            if (pos.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS + 40) {
                spawnEnemy(roster[i % 2], pos);
            }
        }
    };

    const checkCollision = (dir) => {
        collisionRaycaster.set(camera.position, dir);
        const intersects = collisionRaycaster.intersectObjects(buildings);
        if (intersects.length > 0 && intersects[0].distance < 3.8) return true;
        return false;
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
                hit.data.hp -= 100 * state.player.strength;
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
            fist.style.transform = `translateY(-190px) scale(1.35) rotate(${side === 'left' ? 24 : -24}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 450) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.3, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb71c1c });
        for (let i = 0; i < 35; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*1.2, (Math.random()-0.5)*1.2, (Math.random()-0.5)*1.2), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];
        
        if (moving) {
            state.timeDilation = superSpeed ? 0.12 : 1.0; 
            const speed = (superSpeed ? 2.2 : 0.65);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            if (!checkCollision(moveDir)) {
                camera.position.add(moveDir.multiplyScalar(speed));
            }
            if (state.player.isFlying) camera.position.y = Math.min(120, camera.position.y + 0.7);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 0.8);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            
            if (enemy.data.id === 'omniman') {
                const distToArena = enemy.sprite.position.distanceTo(OMNI_ARENA_CENTER);
                if (distToArena > OMNI_ARENA_RADIUS) {
                    enemy.sprite.position.add(OMNI_ARENA_CENTER.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.25 * dt));
                }
            }

            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 6.0 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 200 && dist > 6.5) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.14 * dt));
            }
            if (dist < 8.5 && state.run.active) {
                enemy.attackTimer += (0.02 * dt);
                if (enemy.attackTimer >= 1.0) {
                    state.player.hp -= enemy.data.power;
                    enemy.attackTimer = 0;
                    if (state.player.hp <= 0) die();
                }
            }
        });

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.015 * dt; p.userData.life -= 0.02 * dt; p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) { scene.remove(p); bloodParticles.splice(i, 1); }
        });

        updateUI(); 
        drawMinimap();
        renderer.render(scene, camera);
    };

    const drawMinimap = () => {
        const canvas = document.getElementById('minimap'); if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fillRect(0, 0, 200, 200);
        const centerX = 100, centerY = 100;
        
        // v4.6.7 PERMANENT BLUE DOT FOR PLAYER
        ctx.fillStyle = '#1e88e5'; 
        ctx.beginPath(); ctx.arc(centerX, centerY, 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * 0.35;
            const dz = (e.sprite.position.z - camera.position.z) * 0.35;
            if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0');
                ctx.beginPath(); ctx.arc(centerX + dx, centerY + dz, 4, 0, Math.PI*2); ctx.fill();
            }
        });
    };

    const updateUI = () => {
        const php = document.getElementById('player-hp');
        const xp = document.getElementById('xp-fill');
        const kills = document.getElementById('enemies-defeated');
        const tier = document.getElementById('run-tier');
        const pts = document.getElementById('skill-points');
        if (php) php.style.width = `${Math.max(0, state.player.hp)}%`;
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 450)) * 100}%`;
        if (kills) kills.innerText = state.run.kills;
        if (tier) tier.innerText = state.run.tier;
        if (pts) pts.innerText = state.player.points;
    };

    const updateTargetHUD = (data) => {
        const name = document.getElementById('enemy-name');
        const hp = document.getElementById('enemy-hp');
        if (name) name.innerText = data.name;
        if (hp) hp.style.width = `${(data.hp / data.maxHp) * 100}%`;
    };

    const die = () => { state.run.active = false; document.getElementById('death-overlay').classList.remove('hidden'); };
    const upgrade = (type) => {
        if(state.player.points <= 0) return;
        if(type === 'range') state.player.punchRange += 2;
        if(type === 'speed') state.player.strength += 0.5;
        state.player.points--;
        updateUI();
    };

    return { init, upgrade };
})();

window.Fighter = Fighter;
Fighter.init();
