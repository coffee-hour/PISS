import * as THREE from 'three';

/**
 * Sovereign 3D Expanded (v4.2.0)
 * Features: Flight, Experience System, Fist Overlay, Mini-map, Range-based Combat.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let state = {
        player: { 
            hp: 100, maxHp: 100, strength: 1, speed: 1, xp: 0, points: 0,
            punchRange: 5, flightEnabled: false, isFlying: false, flightEnergy: 100
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
        { id: 'omniman', name: 'OMNI-MAN', color: 0xf8fafc, hp: 20000, weight: 10, unique: true },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xb91c1c, hp: 25000, weight: 10, unique: true }
    ];

    let enemies = [];
    let bloodParticles = [];
    const minimapScale = 2; // Minimap size factor

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050608);
        scene.fog = new THREE.FogExp2(0x050608, 0.03);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        const grid = new THREE.GridHelper(500, 100, 0xff8c00, 0x111111);
        grid.position.y = -2;
        scene.add(grid);

        setupControls();
        spawnInitialWorld();
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

    const createStickmanTexture = (colorHex) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(64, 30, 20, 0, Math.PI*2); ctx.stroke(); // Head
        ctx.beginPath(); ctx.moveTo(64, 50); ctx.lineTo(64, 150); ctx.stroke(); // Body
        ctx.beginPath(); ctx.moveTo(64, 80); ctx.lineTo(30, 120); ctx.stroke(); // L Arm
        ctx.beginPath(); ctx.moveTo(64, 80); ctx.lineTo(98, 120); ctx.stroke(); // R Arm
        ctx.beginPath(); ctx.moveTo(64, 150); ctx.lineTo(30, 220); ctx.stroke(); // L Leg
        ctx.beginPath(); ctx.moveTo(64, 150); ctx.lineTo(98, 220); ctx.stroke(); // R Leg
        return new THREE.CanvasTexture(canvas);
    };

    const spawnEnemy = (data, pos) => {
        const texture = createStickmanTexture(data.color);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        sprite.position.copy(pos);
        scene.add(sprite);
        const enemyObj = { sprite, data: { ...data, hp: data.hp, maxHp: data.hp } };
        enemies.push(enemyObj);
    };

    const spawnInitialWorld = () => {
        // Sector-based spawning
        const zones = [
            { center: new THREE.Vector3(0, 0, -30), size: 20 }, // Spawn zone
            { center: new THREE.Vector3(50, 0, 50), size: 30 }, // North East
            { center: new THREE.Vector3(-50, 0, 50), size: 30 }, // North West
            { center: new THREE.Vector3(0, 0, 100), size: 40 }, // Boss Zone
        ];

        // Fill zones with random Flaxans and Sequids
        for(let i = 0; i < 40; i++) {
            const zone = zones[Math.floor(Math.random() * 3)];
            const pos = zone.center.clone().add(new THREE.Vector3(
                (Math.random()-0.5)*zone.size, 0, (Math.random()-0.5)*zone.size
            ));
            spawnEnemy(roster[i % 2], pos);
        }

        // Spawn Uniques in specific spots
        spawnEnemy(roster[2], new THREE.Vector3(40, 0, 40)); // Eve
        spawnEnemy(roster[3], new THREE.Vector3(-40, 0, 40)); // Robot
        spawnEnemy(roster[5], new THREE.Vector3(0, 0, 120)); // Omni-Man
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
                hit.data.hp -= 25 * state.player.strength;
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
            fist.style.transform = 'translateY(-100px) scale(1.2)';
            setTimeout(() => fist.style.transform = 'translateY(0) scale(1)', 100);
        }
    };

    const gainXP = (amt) => {
        state.player.xp += amt;
        state.run.kills++;
        if(state.player.xp >= state.run.tier * 200) {
            state.run.tier++;
            state.player.points++;
            updateUI();
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.1, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        for (let i = 0; i < 15; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = {
                vel: new THREE.Vector3((Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4),
                life: 1.0
            };
            scene.add(p);
            bloodParticles.push(p);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const now = Date.now();
        
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        let superSpeed = state.keys[' '];

        if (moving) {
            state.timeDilation = superSpeed ? 0.2 : 1.0; 
            const speed = (superSpeed ? 0.8 : 0.2) * (state.player.isFlying ? 1.5 : 1);
            if (state.keys.w) camera.translateZ(-speed);
            if (state.keys.s) camera.translateZ(speed);
            if (state.keys.a) camera.translateX(-speed);
            if (state.keys.d) camera.translateX(speed);
            
            if (state.player.isFlying) {
                camera.position.y = Math.min(20, camera.position.y + 0.1);
            } else {
                camera.position.y = Math.max(0, camera.position.y - 0.2);
            }
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.vel.y -= 0.01 * dt;
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
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, 200, 200);
        
        const centerX = 100;
        const centerY = 100;

        // Draw Player
        ctx.fillStyle = '#ff8c00';
        ctx.beginPath(); ctx.arc(centerX, centerY, 3, 0, Math.PI*2); ctx.fill();

        // Draw Enemies relative to player
        enemies.forEach(e => {
            const dx = (e.sprite.position.x - camera.position.x) * minimapScale;
            const dz = (e.sprite.position.z - camera.position.z) * minimapScale;
            if(Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                ctx.fillStyle = '#' + e.data.color.toString(16).padStart(6, '0');
                ctx.fillRect(centerX + dx - 1, centerY + dz - 1, 2, 2);
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
        if (xp) xp.style.width = `${(state.player.xp / (state.run.tier * 200)) * 100}%`;
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
        if(type === 'speed') state.player.speed += 0.2;
        state.player.points--;
        updateUI();
    };

    return { init, upgrade };
})();

window.Fighter = Fighter;
Fighter.init();
