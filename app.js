import * as THREE from 'three';

/**
 * Sovereign 3D Expanded (v4.2.1)
 * Features: Height Correction, Boss Sector Refactor, HUD Polish, NPC Detail.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let state = {
        player: { 
            hp: 100, maxHp: 100, strength: 1, speed: 1, xp: 0, points: 0,
            punchRange: 6, flightEnabled: false, isFlying: false, height: 1.7
        },
        run: { kills: 0, tier: 1, active: true, choicesPending: false },
        timeDilation: 0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false },
        lastArmUsed: 'right',
        isLocked: false
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID', color: 0xff80ab, hp: 120, weight: 1, unique: false },
        { id: 'flaxan', name: 'FLAXAN SOLDIER', color: 0xe65100, hp: 150, weight: 1, unique: false },
        { id: 'atomeve', name: 'ATOM EVE', color: 0xf06292, hp: 450, weight: 2, unique: true },
        { id: 'robot', name: 'ROBOT', color: 0x43a047, hp: 700, weight: 3, unique: true },
        { id: 'omniman', name: 'OMNI-MAN', color: 0xf8fafc, hp: 20000, weight: 10, unique: true, boss: true },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xb91c1c, hp: 25000, weight: 10, unique: true, boss: true }
    ];

    let enemies = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050608);
        scene.fog = new THREE.FogExp2(0x050608, 0.03);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.y = state.player.height; // EYE LEVEL HEIGHT

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        const grid = new THREE.GridHelper(500, 100, 0xff8c00, 0x111111);
        grid.position.y = 0; // Grid on ground
        scene.add(grid);

        setupControls();
        spawnWorldSectors();
        animate();
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
            if (!state.isLocked) {
                document.body.requestPointerLock();
            } else if (state.run.active) {
                performStrike();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            state.isLocked = document.pointerLockElement === document.body;
        });

        window.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                camera.rotation.y -= e.movementX * 0.002;
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
            }
        });
    };

    const createStickmanTexture = (colorHex, isBoss) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const color = '#' + colorHex.toString(16).padStart(6, '0');
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        
        // Head
        ctx.beginPath(); ctx.arc(64, 40, 22, 0, Math.PI*2); ctx.stroke();
        
        // NPC Detail: Chest Piece / Core
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(64, 85, 12, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
        
        // Body
        ctx.beginPath(); ctx.moveTo(64, 62); ctx.lineTo(64, 160); ctx.stroke();
        
        // Arms
        ctx.beginPath(); ctx.moveTo(64, 85); ctx.lineTo(30, 130); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(64, 85); ctx.lineTo(98, 130); ctx.stroke();
        
        // Legs
        ctx.beginPath(); ctx.moveTo(64, 160); ctx.lineTo(40, 240); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(64, 160); ctx.lineTo(88, 240); ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    };

    const spawnEnemy = (data, pos) => {
        const texture = createStickmanTexture(data.color, data.boss);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        sprite.position.copy(pos);
        sprite.position.y += 2; // Sit on ground
        scene.add(sprite);
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp } });
    };

    const spawnWorldSectors = () => {
        // Sector 1: The Outskirts (Flaxans/Sequids)
        for(let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 20 + Math.random() * 40;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            spawnEnemy(roster[i % 2], pos);
        }

        // Sector 2: The Guardian Rift
        spawnEnemy(roster[2], new THREE.Vector3(50, 0, 50)); // Eve
        spawnEnemy(roster[3], new THREE.Vector3(-50, 0, 50)); // Robot
        spawnEnemy(roster[4], new THREE.Vector3(0, 0, 80)); // Dupli-Kate

        // Sector 3: BOSS ARENAS (Isolated)
        spawnBoss(roster[4], new THREE.Vector3(0, 0, 200)); // Omni-Man Sector
        spawnBoss(roster[5], new THREE.Vector3(200, 0, 200)); // Thragg Sector
    };

    const spawnBoss = (data, pos) => {
        // Create an isolated area ring for bosses
        const ringGeo = new THREE.RingGeometry(15, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(pos);
        scene.add(ring);
        spawnEnemy(data, pos);
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
                hit.data.hp -= 30 * state.player.strength;
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
            fist.style.transform = 'translateY(-120px) scale(1.1) rotate(' + (side === 'left' ? 10 : -10) + 'deg)';
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1) rotate(0)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 250) {
            state.run.tier++;
            state.player.points++;
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.12, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        for (let i = 0; i < 20; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = {
                vel: new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5),
                life: 1.0
            };
            scene.add(p);
            bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];

        if (moving) {
            state.timeDilation = superSpeed ? 0.15 : 1.0; 
            const speed = (superSpeed ? 1.0 : 0.25);
            
            if (state.keys.w) camera.translateZ(-speed);
            if (state.keys.s) camera.translateZ(speed);
            if (state.keys.a) camera.translateX(-speed);
            if (state.keys.d) camera.translateX(speed);
            
            if (state.player.isFlying) {
                camera.position.y = Math.min(25, camera.position.y + 0.2);
            } else {
                camera.position.y = Math.max(state.player.height, camera.position.y - 0.4);
            }
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.015 * dt;
            p.userData.life -= 0.02 * dt;
            p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) {
                scene.remove(p);
                bloodParticles.splice(i, 1);
            }
        });

        updateUI();
        drawMinimap();
        renderer.render(scene, camera);
    };

    const drawMinimap = () => {
        const canvas = document.getElementById('minimap');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
        ctx.fillRect(0, 0, 200, 200);
        
        const centerX = 100;
        const centerY = 100;

        ctx.fillStyle = '#ff8c00';
        ctx.beginPath(); ctx.arc(centerX, centerY, 4, 0, Math.PI*2); ctx.fill();

        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * 1.5;
            const dz = (e.sprite.position.z - camera.position.z) * 1.5;
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

        if (php) php.style.width = `${state.player.hp}%`;
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 250)) * 100}%`;
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

    const upgrade = (type) => {
        if(state.player.points <= 0) return;
        if(type === 'range') state.player.punchRange += 2;
        if(type === 'speed') state.player.strength += 0.2;
        state.player.points--;
        updateUI();
    };

    return { init, upgrade };
})();

window.Fighter = Fighter;
Fighter.init();
