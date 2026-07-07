import * as THREE from 'three';

/**
 * Sovereign 3D Expanded (v4.5.0)
 * Features: City Conquest (Low-Poly City), Fixed Eye-Level Camera, Forced Boss Persistence.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
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
        { id: 'sequid', name: 'SEQUID', color: 0xff80ab, hp: 120, weight: 1, unique: false, power: 5 },
        { id: 'flaxan', name: 'FLAXAN SOLDIER', color: 0xe65100, hp: 150, weight: 1, unique: false, power: 8 },
        { id: 'atomeve', name: 'ATOM EVE', color: 0xf06292, hp: 600, weight: 3, unique: true, power: 15 },
        { id: 'robot', name: 'ROBOT', color: 0x43a047, hp: 800, weight: 3, unique: true, power: 18 },
        { id: 'omniman', name: 'OMNI-MAN', color: 0xf8fafc, hp: 20000, weight: 10, unique: true, boss: true, power: 45 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xb91c1c, hp: 25000, weight: 10, unique: true, boss: true, power: 50 }
    ];

    let enemies = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050608);
        scene.fog = new THREE.FogExp2(0x050608, 0.04);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        // 1. ENVIRONMENT: LOW-POLY CITY
        createCity();

        setupControls();
        
        // 2. FORCED BOSS SPAWNING (scene.init Hard-Code)
        spawnWorldSectors();
        forceBossSpawn(roster[4], new THREE.Vector3(0, 0, 250)); // Omni-Man
        forceBossSpawn(roster[5], new THREE.Vector3(200, 0, 250)); // Thragg

        animate();
    };

    const createCity = () => {
        const floorGeo = new THREE.PlaneGeometry(1000, 1000);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const grid = new THREE.GridHelper(1000, 100, 0xff8c00, 0x222222);
        grid.position.y = 0.01;
        scene.add(grid);

        // Procedural Building Blocks
        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
        
        for (let i = 0; i < 400; i++) {
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            const w = 4 + Math.random() * 8;
            const h = 5 + Math.random() * 30;
            const d = 4 + Math.random() * 8;
            building.scale.set(w, h, d);
            
            let x, z;
            do {
                x = (Math.random() - 0.5) * 500;
                z = (Math.random() - 0.5) * 500;
            } while (Math.abs(x) < 15 && Math.abs(z) < 15); // Keep spawn clear

            building.position.set(x, h/2, z);
            scene.add(building);
            
            // Building Edges (Wireframe)
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x333333 }));
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
                // Pitch restricted or zeroed out for horizon level? User said "only yaw" or "zero pitch/roll".
                // I will zero out X (pitch) and Z (roll) rotation for a fixed horizon view.
                camera.rotation.x = 0;
                camera.rotation.z = 0;
            }
        });
    };

    const createStickmanTexture = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        ctx.strokeStyle = color; ctx.lineWidth = 12;
        const cx = 128;
        
        if (data.id === 'thragg') {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(cx-50, 120); ctx.lineTo(cx-100, 80); ctx.lineTo(cx-40, 90); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx+50, 120); ctx.lineTo(cx+100, 80); ctx.lineTo(cx+40, 90); ctx.fill();
        }
        if (data.id === 'omniman') {
            ctx.fillStyle = '#b91c1c'; ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.moveTo(cx-40, 100); ctx.lineTo(cx-90, 400); ctx.lineTo(cx+90, 400); ctx.lineTo(cx+40, 100); ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, 160, 20, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 250); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 250); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    };

    const spawnEnemy = (data, pos) => {
        const texture = createStickmanTexture(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        sprite.position.copy(pos);
        sprite.position.y = 2; // Grounded
        scene.add(sprite);
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(18, 20, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.05;
        scene.add(ring);
        spawnEnemy(data, pos);
    };

    const spawnWorldSectors = () => {
        for(let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 50 + Math.random() * 100;
            spawnEnemy(roster[i % 2], new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r));
        }
        spawnEnemy(roster[2], new THREE.Vector3(70, 0, 70));
        spawnEnemy(roster[3], new THREE.Vector3(-70, 0, 70));
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        state.lastArmUsed = state.lastArmUsed === 'left' ? 'right' : 'left';
        animateFist(state.lastArmUsed);
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        const intersects = raycaster.intersectObjects(enemies.map(e => e.sprite));
        if (intersects.length > 0) {
            const hit = enemies.find(e => e.sprite === intersects[0].object);
            const dist = camera.position.distanceTo(hit.sprite.position);
            if (hit && dist <= state.player.punchRange) {
                hit.data.hp -= 50 * state.player.strength;
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
            fist.style.transform = `translateY(-140px) scale(1.2) rotate(${side === 'left' ? 15 : -15}deg)`;
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 300) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.15, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        for (let i = 0; i < 20; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*0.7, (Math.random()-0.5)*0.7, (Math.random()-0.5)*0.7), life: 1.0 };
            scene.add(p); bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];
        if (moving) {
            state.timeDilation = superSpeed ? 0.15 : 1.0; 
            const speed = (superSpeed ? 1.5 : 0.4);
            if (state.keys.w) camera.translateZ(-speed);
            if (state.keys.s) camera.translateZ(speed);
            if (state.keys.a) camera.translateX(-speed);
            if (state.keys.d) camera.translateX(speed);
            
            // Forced Horizon Level
            if (state.player.isFlying) camera.position.y = Math.min(40, camera.position.y + 0.4);
            else camera.position.y = state.player.height;
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            if (dist < 50 && dist > 4) {
                const dir = camera.position.clone().sub(enemy.sprite.position).normalize();
                enemy.sprite.position.add(dir.multiplyScalar(0.06 * dt));
            }
            if (dist < 6 && state.run.active) {
                enemy.attackTimer += (0.015 * dt);
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

        updateUI(); drawMinimap();
        renderer.render(scene, camera);
    };

    const drawMinimap = () => {
        const canvas = document.getElementById('minimap'); if(!canvas) return;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'rgba(5, 6, 8, 0.98)'; ctx.fillRect(0, 0, 200, 200);
        const centerX = 100, centerY = 100; ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, Math.PI*2); ctx.fill();
        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * 1;
            const dz = (e.sprite.position.z - camera.position.z) * 1;
            if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0');
                ctx.beginPath(); ctx.arc(centerX + dx, centerY + dz, 2, 0, Math.PI*2); ctx.fill();
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
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 300)) * 100}%`;
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
        if(type === 'speed') state.player.strength += 0.4;
        state.player.points--;
        updateUI();
    };

    return { init, upgrade };
})();

window.Fighter = Fighter;
Fighter.init();
