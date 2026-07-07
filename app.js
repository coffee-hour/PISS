import * as THREE from 'three';

/**
 * Sovereign AAA (v4.6.3)
 * Features: Daylight Visibility Overhaul, High-Contrast Sunlight, Building Collision, 
 * Aggressive AI, Boss Icons, Corrected Mini-map Projection.
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

    const init = () => {
        scene = new THREE.Scene();
        // 1. DAYLIGHT SKY & FOG
        scene.background = new THREE.Color(0xddeeff);
        scene.fog = new THREE.Fog(0xddeeff, 50, 400); // Clear visibility near, soft fade at 400

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        // 2. DAYLIGHT LIGHTING
        ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Strong global fill
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2); // Warm sun
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createCity();
        setupControls();
        
        spawnWorldSectors();
        forceBossSpawn(roster[4], new THREE.Vector3(0, 0, 300));
        forceBossSpawn(roster[5], new THREE.Vector3(250, 0, 300));

        animate();
    };

    const createCity = () => {
        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const grid = new THREE.GridHelper(1000, 100, 0x000000, 0xbbbbbb);
        grid.position.y = 0.02;
        scene.add(grid);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 450; i++) {
            const h = 10 + Math.random() * 50;
            const w = 6 + Math.random() * 12;
            const d = 6 + Math.random() * 12;
            
            const buildingMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.scale.set(w, h, d);
            
            let x, z;
            do {
                x = (Math.random() - 0.5) * 800;
                z = (Math.random() - 0.5) * 800;
            } while (Math.abs(x) < 25 && Math.abs(z) < 25);

            building.position.set(x, h/2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            buildings.push(building);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x999999 }));
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

    const createAAAStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        const cx = 128;

        ctx.strokeStyle = '#000'; ctx.lineWidth = 16;
        drawBase(ctx, cx);
        
        ctx.strokeStyle = color; ctx.lineWidth = 10;
        drawBase(ctx, cx);
        
        // High-Contrast Daylight Accents
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(cx-10, 140); ctx.lineTo(cx-10, 280); ctx.stroke();
        ctx.globalAlpha = 1.0;

        if (data.id === 'omniman') {
            ctx.fillStyle = '#b71c1c'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(cx-50, 110); ctx.lineTo(cx-110, 420); ctx.lineTo(cx+110, 420); ctx.lineTo(cx+50, 110); ctx.fill();
            ctx.globalAlpha = 1.0;
        }

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
        const texture = createAAAStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2.5, 5, 1); // Increased size for visibility
        sprite.position.copy(pos);
        sprite.position.y = 2.5;
        scene.add(sprite);
        
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(1.2, 0);
            const iconMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 4, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }

        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(24, 26, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb71c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.1;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        for(let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 80 + Math.random() * 200;
            spawnEnemy(roster[i % 2], new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r));
        }
        spawnEnemy(roster[2], new THREE.Vector3(100, 0, 100));
        spawnEnemy(roster[3], new THREE.Vector3(-100, 0, 100));
    };

    const checkCollision = (dir) => {
        collisionRaycaster.set(camera.position, dir);
        const intersects = collisionRaycaster.intersectObjects(buildings);
        if (intersects.length > 0 && intersects[0].distance < 3.0) return true;
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
                hit.data.hp -= 60 * state.player.strength;
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
            fist.style.transform = `translateY(-160px) scale(1.3) rotate(${side === 'left' ? 20 : -20}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 350) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.2, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb71c1c });
        for (let i = 0; i < 25; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];
        
        if (moving) {
            state.timeDilation = superSpeed ? 0.12 : 1.0; 
            const speed = (superSpeed ? 1.8 : 0.5);
            
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            
            if (!checkCollision(moveDir)) {
                camera.position.add(moveDir.multiplyScalar(speed));
            }
            
            if (state.player.isFlying) camera.position.y = Math.min(80, camera.position.y + 0.5);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 0.6);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 4.5 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 100 && dist > 5) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.1 * dt));
            }
            if (dist < 7 && state.run.active) {
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(0, 0, 200, 200);
        
        const centerX = 100, centerY = 100;
        // Corrected Projection: Map player center
        ctx.fillStyle = '#ff8c00';
        ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, Math.PI*2); ctx.fill();

        enemies.forEach(e => {
            // Corrected Projection relative to player XZ
            const dx = (e.sprite.position.x - camera.position.x) * 0.5;
            const dz = (e.sprite.position.z - camera.position.z) * 0.5;
            if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0');
                ctx.beginPath(); ctx.arc(centerX + dx, centerY + dz, 3, 0, Math.PI*2); ctx.fill();
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
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 350)) * 100}%`;
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
