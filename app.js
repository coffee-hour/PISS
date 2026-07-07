import * as THREE from 'three';

/**
 * Sovereign AAA (v4.6.6)
 * Features: Fixed Deterministic City, Omni-Man Arena Lock, Blue Hand Polish,
 * Daylight Visibility, Solid Collisions, Aggressive AI.
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
    const OMNI_ARENA_CENTER = new THREE.Vector3(0, 0, 350);
    const OMNI_ARENA_RADIUS = 40;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xddeeff);
        scene.fog = new THREE.Fog(0xddeeff, 50, 500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfffaf0, 1.3);
        sunLight.position.set(200, 400, 200);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createFixedCity();
        setupControls();
        
        spawnWorldSectors();
        // FORCE OMNI-MAN INTO ARENA
        forceBossSpawn(roster[4], OMNI_ARENA_CENTER.clone()); 
        forceBossSpawn(roster[5], new THREE.Vector3(300, 0, 300));

        animate();
    };

    const createFixedCity = () => {
        const floorGeo = new THREE.PlaneGeometry(3000, 3000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(2000, 100, 0x000000, 0x999999);
        grid.position.y = 0.02;
        scene.add(grid);

        // OMNI-MAN ARENA PLAZA (FIXED)
        const plazaGeo = new THREE.CircleGeometry(OMNI_ARENA_RADIUS, 32);
        const plazaMat = new THREE.MeshStandardMaterial({ color: 0x999999 });
        const plaza = new THREE.Mesh(plazaGeo, plazaMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.copy(OMNI_ARENA_CENTER);
        plaza.position.y = 0.05;
        scene.add(plaza);

        // FIXED DETERMINISTIC BUILDING SEED
        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
        
        // Simple LCG for deterministic layout
        let seed = 42;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        for (let i = 0; i < 500; i++) {
            const h = 15 + random() * 60;
            const w = 8 + random() * 15;
            const d = 8 + random() * 15;
            
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.scale.set(w, h, d);
            
            let x, z;
            do {
                x = (random() - 0.5) * 1200;
                z = (random() - 0.5) * 1200;
            } while (
                (Math.abs(x) < 30 && Math.abs(z) < 30) || // Spawn safety
                (new THREE.Vector3(x, 0, z).distanceTo(OMNI_ARENA_CENTER) < OMNI_ARENA_RADIUS + 10) // Arena safety
            );

            building.position.set(x, h/2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            buildings.push(building);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x888888 }));
            line.scale.set(w, h, d);
            line.position.copy(building.position);
            scene.add(line);
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

    const createPolishedStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        const cx = 128;

        ctx.strokeStyle = '#000'; ctx.lineWidth = 18;
        drawBase(ctx, cx, false); // Outline
        
        ctx.strokeStyle = color; ctx.lineWidth = 12;
        drawBase(ctx, cx, true); // Primary + BLUE HANDS
        
        if (data.id === 'omniman') {
            ctx.fillStyle = '#b71c1c'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(cx-50, 110); ctx.lineTo(cx-120, 440); ctx.lineTo(cx+120, 440); ctx.lineTo(cx+50, 110); ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        return new THREE.CanvasTexture(canvas);
    };

    const drawBase = (ctx, cx, withHands) => {
        // Head
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        // Body
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        // Arms
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 260); ctx.stroke();
        
        // v4.6.6 BLUE HAND POLISH
        if (withHands) {
            ctx.fillStyle = '#1e88e5'; // Blue Hands
            ctx.beginPath(); ctx.arc(cx-80, 260, 12, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+80, 260, 12, 0, Math.PI*2); ctx.fill();
        }

        // Legs
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();
    };

    const spawnEnemy = (data, pos) => {
        const texture = createPolishedStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(3, 6, 1);
        sprite.position.copy(pos);
        sprite.position.y = 3;
        scene.add(sprite);
        
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(1.5, 0);
            const iconMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 5, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }

        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(26, 28, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb71c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.1;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        let seed = 99;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        for(let i = 0; i < 50; i++) {
            const angle = random() * Math.PI * 2;
            const r = 100 + random() * 300;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            if (pos.distanceTo(OMNI_ARENA_CENTER) > OMNI_ARENA_RADIUS + 20) {
                spawnEnemy(roster[i % 2], pos);
            }
        }
    };

    const checkCollision = (dir) => {
        collisionRaycaster.set(camera.position, dir);
        const intersects = collisionRaycaster.intersectObjects(buildings);
        if (intersects.length > 0 && intersects[0].distance < 3.5) return true;
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
                hit.data.hp -= 80 * state.player.strength;
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
            fist.style.transform = `translateY(-180px) scale(1.3) rotate(${side === 'left' ? 22 : -22}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 400) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.25, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb71c1c });
        for (let i = 0; i < 30; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*1.0, (Math.random()-0.5)*1.0, (Math.random()-0.5)*1.0), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];
        
        if (moving) {
            state.timeDilation = superSpeed ? 0.12 : 1.0; 
            const speed = (superSpeed ? 2.0 : 0.6);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            if (!checkCollision(moveDir)) {
                camera.position.add(moveDir.multiplyScalar(speed));
            }
            if (state.player.isFlying) camera.position.y = Math.min(100, camera.position.y + 0.6);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 0.7);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            
            // v4.6.5 OMNI-MAN ARENA LOCK
            if (enemy.data.id === 'omniman') {
                const distToArena = enemy.sprite.position.distanceTo(OMNI_ARENA_CENTER);
                if (distToArena > OMNI_ARENA_RADIUS) {
                    const returnDir = OMNI_ARENA_CENTER.clone().sub(enemy.sprite.position).normalize();
                    enemy.sprite.position.add(returnDir.multiplyScalar(0.2 * dt));
                }
            }

            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 5.5 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 150 && dist > 6) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.12 * dt));
            }
            if (dist < 8 && state.run.active) {
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(0, 0, 200, 200);
        const centerX = 100, centerY = 100;
        ctx.fillStyle = '#ff8c00';
        ctx.beginPath(); ctx.arc(centerX, centerY, 6, 0, Math.PI*2); ctx.fill();
        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * 0.4;
            const dz = (e.sprite.position.z - camera.position.z) * 0.4;
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
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 400)) * 100}%`;
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
