import * as THREE from 'three';

/**
 * Sovereign AAA (v4.6.1)
 * Features: High-Fidelity Noir Sky, Building Collision, Glowing Armor Accents, Boss Icons, Pitch Control.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster, collisionRaycaster;
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
        { id: 'omniman', name: 'OMNI-MAN', color: 0xf8fafc, hp: 20000, weight: 10, unique: true, boss: true, power: 50 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xb91c1c, hp: 25000, weight: 10, unique: true, boss: true, power: 60 }
    ];

    let enemies = [];
    let buildings = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x020205);
        scene.fog = new THREE.FogExp2(0x020205, 0.035);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ReinhardToneMapping;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        createSky();
        createCity();
        setupControls();
        
        // AAA Initialization: Forced Bosses with Gold Icons
        spawnWorldSectors();
        forceBossSpawn(roster[4], new THREE.Vector3(0, 0, 300)); // Omni-Man
        forceBossSpawn(roster[5], new THREE.Vector3(250, 0, 300)); // Thragg

        animate();
    };

    const createSky = () => {
        const skyGeo = new THREE.SphereGeometry(800, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x05050a) },
                bottomColor: { value: new THREE.Color(0x000000) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        scene.add(new THREE.Mesh(skyGeo, skyMat));
    };

    const createCity = () => {
        const floorGeo = new THREE.PlaneGeometry(2000, 2000);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0x010102 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const grid = new THREE.GridHelper(1000, 100, 0xff8c00, 0x050505);
        grid.position.y = 0.02;
        scene.add(grid);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 450; i++) {
            const h = 10 + Math.random() * 50;
            const w = 6 + Math.random() * 12;
            const d = 6 + Math.random() * 12;
            
            const buildingMat = new THREE.MeshBasicMaterial({ color: 0x08080a });
            const building = new THREE.Mesh(buildingGeo, buildingMat);
            building.scale.set(w, h, d);
            
            let x, z;
            do {
                x = (Math.random() - 0.5) * 600;
                z = (Math.random() - 0.5) * 600;
            } while (Math.abs(x) < 20 && Math.abs(z) < 20);

            building.position.set(x, h/2, z);
            scene.add(building);
            buildings.push(building);
            
            // Gritty Edge Lighting
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a1a20 }));
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
                // AAA RE-ENABLE PITCH: Support up/down looking while maintaining roll correction
                camera.rotation.x -= e.movementY * 0.002;
                camera.rotation.x = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, camera.rotation.x));
                camera.rotation.z = 0; // Lock roll
            }
        });
    };

    const createAAAStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const color = '#' + data.color.toString(16).padStart(6, '0');
        const cx = 128;

        // Sophisticated Outlines / Armor Accents
        ctx.strokeStyle = '#000'; ctx.lineWidth = 16;
        drawBase(ctx, cx); // Outer stroke for grittiness
        
        ctx.strokeStyle = color; ctx.lineWidth = 10;
        drawBase(ctx, cx); // Primary silhouette
        
        // Glowing Accents (AAA Grit)
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(cx-10, 150); ctx.lineTo(cx-10, 300); ctx.stroke(); // Internal shine
        ctx.globalAlpha = 1.0;

        if (data.id === 'omniman') {
            ctx.fillStyle = '#b91c1c'; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.moveTo(cx-50, 110); ctx.lineTo(cx-110, 420); ctx.lineTo(cx+110, 420); ctx.lineTo(cx+50, 110); ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        return new THREE.CanvasTexture(canvas);
    };

    const drawBase = (ctx, cx) => {
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke(); // Head
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke(); // Body
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 260); ctx.stroke(); // Arms
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke(); // Legs
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();
    };

    const spawnEnemy = (data, pos) => {
        const texture = createAAAStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        sprite.position.copy(pos);
        sprite.position.y = 2;
        scene.add(sprite);
        
        // AAA BOSS ICONS
        if (data.boss) {
            const iconGeo = new THREE.OctahedronGeometry(0.8, 0);
            const iconMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
            const icon = new THREE.Mesh(iconGeo, iconMat);
            icon.position.set(0, 3, 0);
            sprite.add(icon);
            sprite.userData.icon = icon;
        }

        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const forceBossSpawn = (data, pos) => {
        const ringGeo = new THREE.RingGeometry(22, 24, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c, side: THREE.DoubleSide });
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
            const r = 60 + Math.random() * 120;
            spawnEnemy(roster[i % 2], new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r));
        }
        spawnEnemy(roster[2], new THREE.Vector3(80, 0, 80));
        spawnEnemy(roster[3], new THREE.Vector3(-80, 0, 80));
    };

    const checkCollision = (dir) => {
        collisionRaycaster.set(camera.position, dir);
        const intersects = collisionRaycaster.intersectObjects(buildings);
        if (intersects.length > 0 && intersects[0].distance < 2.5) return true;
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
            fist.style.transform = `translateY(-150px) scale(1.25) rotate(${side === 'left' ? 18 : -18}deg)`;
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
        const geo = new THREE.SphereGeometry(0.18, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
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
            const speed = (superSpeed ? 1.6 : 0.45);
            
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            
            // AAA COLLISION: Building Mesh Raycasting
            if (!checkCollision(moveDir)) {
                camera.position.add(moveDir.multiplyScalar(speed));
            }
            
            if (state.player.isFlying) camera.position.y = Math.min(50, camera.position.y + 0.45);
            else camera.position.y = Math.max(state.player.height, camera.position.y - 0.55);
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        // AI & Boss Icon Animations
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            if (enemy.sprite.userData.icon) {
                enemy.sprite.userData.icon.rotation.y += 0.05 * dt;
                enemy.sprite.userData.icon.position.y = 3.5 + Math.sin(Date.now() * 0.005) * 0.5;
            }
            if (dist < 60 && dist > 4.5) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.08 * dt));
            }
            if (dist < 6 && state.run.active) {
                enemy.attackTimer += (0.018 * dt);
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

        updateUI(); renderer.render(scene, camera);
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
