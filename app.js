import * as THREE from 'three';

/**
 * Sovereign 3D Expanded (v4.3.0)
 * Features: Roster Identity Polish (Geometric Identifiers), Height Correction, Boss Sectors.
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
        { id: 'duplikate', name: 'DUPLI-KATE', color: 0x1e88e5, hp: 200, weight: 2, unique: true },
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
        camera.position.y = state.player.height;

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        const grid = new THREE.GridHelper(500, 100, 0xff8c00, 0x111111);
        grid.position.y = 0;
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

    // v4.3.0 Enhanced Billboard Generator
    const createStickmanTexture = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        
        // Base Alignment
        const cx = 128;
        
        // 1. UNIQUE IDENTIFIERS
        if (data.id === 'thragg') {
            // Flared Pauldrons
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(cx - 50, 120); ctx.lineTo(cx - 100, 80); ctx.lineTo(cx - 40, 90); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx + 50, 120); ctx.lineTo(cx + 100, 80); ctx.lineTo(cx + 40, 90); ctx.fill();
        }

        if (data.id === 'omniman') {
            // Cape Silhouette
            ctx.fillStyle = '#b91c1c'; // Red Cape
            ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.moveTo(cx - 40, 100); ctx.lineTo(cx - 90, 400); ctx.lineTo(cx + 90, 400); ctx.lineTo(cx + 40, 100); ctx.fill();
            ctx.globalAlpha = 1.0;
            // Chest Plating Lines
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(cx - 20, 110); ctx.lineTo(cx + 20, 110); ctx.stroke();
            ctx.strokeStyle = color;
            ctx.lineWidth = 12;
        }

        if (data.id === 'atomeve') {
            // Energy Particles
            ctx.fillStyle = color;
            for(let i=0; i<8; i++) {
                ctx.beginPath(); ctx.arc(cx + (Math.random()-0.5)*180, 200 + (Math.random()-0.5)*300, 8, 0, Math.PI*2); ctx.fill();
            }
        }

        if (data.id === 'robot') {
            // Mechanical Antennae
            ctx.beginPath(); ctx.moveTo(cx - 20, 40); ctx.lineTo(cx - 40, 10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + 20, 40); ctx.lineTo(cx + 40, 10); ctx.stroke();
            // Panel Detail
            ctx.strokeRect(cx - 15, 120, 30, 40);
        }

        if (data.id === 'duplikate') {
            // Shadow Silhouettes
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.arc(cx - 40, 80, 20, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - 40, 100); ctx.lineTo(cx - 40, 250); ctx.stroke();
            ctx.strokeStyle = color;
        }

        // 2. BASE STICKMAN
        // Head
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        // Chest Core
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, 160, 20, 0, Math.PI*2); ctx.fill();
        // Body
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        // Arms
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx - 80, 250); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx + 80, 250); ctx.stroke();
        // Legs
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx - 60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx + 60, 480); ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    };

    const spawnEnemy = (data, pos) => {
        const texture = createStickmanTexture(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        sprite.position.copy(pos);
        sprite.position.y += 2;
        scene.add(sprite);
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp } });
    };

    const spawnWorldSectors = () => {
        // Sector 1: The Outskirts
        for(let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 30 + Math.random() * 50;
            const pos = new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r);
            spawnEnemy(roster[i % 2], pos);
        }

        // Sector 2: The Guardian Rift
        spawnEnemy(roster[2], new THREE.Vector3(60, 0, 60)); // Eve
        spawnEnemy(roster[3], new THREE.Vector3(-60, 0, 60)); // Robot
        spawnEnemy(roster[4], new THREE.Vector3(0, 0, 100)); // Dupli-Kate

        // Sector 3: Boss Arenas
        spawnBoss(roster[5], new THREE.Vector3(0, 0, 250)); // Omni-Man
        spawnBoss(roster[6], new THREE.Vector3(250, 0, 250)); // Thragg
    };

    const spawnBoss = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(18, 20, 32);
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
                hit.data.hp -= 35 * state.player.strength;
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
            fist.style.transform = `translateY(-120px) scale(1.15) rotate(${side === 'left' ? 12 : -12}deg)`;
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
                vel: new THREE.Vector3((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6),
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
            const speed = (superSpeed ? 1.2 : 0.3);
            
            if (state.keys.w) camera.translateZ(-speed);
            if (state.keys.s) camera.translateZ(speed);
            if (state.keys.a) camera.translateX(-speed);
            if (state.keys.d) camera.translateX(speed);
            
            if (state.player.isFlying) {
                camera.position.y = Math.min(30, camera.position.y + 0.25);
            } else {
                camera.position.y = Math.max(state.player.height, camera.position.y - 0.45);
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
        ctx.fillStyle = 'rgba(10, 14, 23, 0.95)';
        ctx.fillRect(0, 0, 200, 200);
        
        const centerX = 100;
        const centerY = 100;

        ctx.fillStyle = '#ff8c00';
        ctx.beginPath(); ctx.arc(centerX, centerY, 5, 0, Math.PI*2); ctx.fill();

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
        if(type === 'speed') state.player.strength += 0.25;
        state.player.points--;
        updateUI();
    };

    return { init, upgrade };
})();

window.Fighter = Fighter;
Fighter.init();
