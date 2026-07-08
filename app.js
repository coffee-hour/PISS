import * as THREE from 'three';

/**
 * Sovereign AAA (v4.7.1-revert)
 * Features: 3D Engine Restored, Amber Core Aesthetic, 1-NPC Limit,
 * Expanded Combat Radius, Increased Eye-Level, Arena Lock.
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster, collisionRaycaster;
    let sunLight, ambientLight;
    let state = {
        player: { 
            hp: 100, maxHp: 100, strength: 1, speed: 1, xp: 0, points: 0,
            punchRange: 12, isFlying: false, height: 2.8
        },
        run: { kills: 0, tier: 1, active: true },
        timeDilation: 0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, f: false, m: false },
        lastArmUsed: 'right',
        isLocked: false
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID', color: 0xff4081, hp: 120, weight: 1, unique: false, power: 5, flies: false },
        { id: 'flaxan', name: 'FLAXAN SOLDIER', color: 0xf57c00, hp: 150, weight: 1, unique: false, power: 8, flies: false },
        { id: 'omniman', name: 'OMNI-MAN', color: 0xff8c00, hp: 20000, weight: 10, unique: true, boss: true, power: 55, flies: true }
    ];

    let enemies = [];
    let buildings = [];
    let bloodParticles = [];
    const OMNI_ARENA_CENTER = new THREE.Vector3(0, 0, 400);
    const OMNI_ARENA_RADIUS = 60;

    const init = () => {
        scene = new THREE.Scene();
        // AMBER CORE AESTHETIC
        scene.background = new THREE.Color(0x0d0d0d);
        scene.fog = new THREE.Fog(0x0d0d0d, 100, 600);

        camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 2500);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        collisionRaycaster = new THREE.Raycaster();

        ambientLight = new THREE.AmbientLight(0xff8c00, 0.4);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 1.2);
        sunLight.position.set(200, 400, 200);
        scene.add(sunLight);

        createCity();
        setupControls();
        
        // v4.7.1-revert: SPAWN EXACTLY ONE AT START
        spawnOneNPC();

        animate();
    };

    const createCity = () => {
        const floorGeo = new THREE.PlaneGeometry(5000, 5000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
        const buildingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        let seed = 444;
        const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
        for (let i = 0; i < 400; i++) {
            const h = 40 + random() * 80;
            const w = 20 + random() * 30;
            const d = 20 + random() * 30;
            const x = (random() - 0.5) * 1800;
            const z = (random() - 0.5) * 1800;
            if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;
            
            const b = new THREE.Mesh(buildingGeo, buildingMat);
            b.scale.set(w, h, d);
            b.position.set(x, h/2, z);
            scene.add(b);
            
            const edges = new THREE.EdgesGeometry(buildingGeo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff8c00 }));
            line.scale.set(w, h, d);
            line.position.copy(b.position);
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
            }
        });
    };

    const spawnOneNPC = () => {
        if (enemies.length >= 1) return;
        const type = roster[Math.floor(Math.random() * (roster.length - 1))]; // Only non-boss for general spawn
        const pos = new THREE.Vector3((Math.random()-0.5)*100, 0, (Math.random()-0.5)*100);
        spawnEnemy(type, pos);
    };

    const createStickman = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const cx = 128;
        ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.arc(cx, 80, 40, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 120); ctx.lineTo(cx, 320); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx-80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 160); ctx.lineTo(cx+80, 260); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx-60, 480); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, 320); ctx.lineTo(cx+60, 480); ctx.stroke();
        return new THREE.CanvasTexture(canvas);
    };

    const spawnEnemy = (data, pos) => {
        const texture = createStickman(data);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4.5, 9, 1);
        sprite.position.copy(pos);
        sprite.position.y = 4.5;
        scene.add(sprite);
        enemies.push({ sprite, data: { ...data, hp: data.hp, maxHp: data.hp }, attackTimer: 0 });
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        animateFist();
        
        enemies.forEach(enemy => {
            const dist = camera.position.distanceTo(enemy.sprite.position);
            const dirToEnemy = enemy.sprite.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const dot = dirToEnemy.dot(forward);

            if (dist <= state.player.punchRange && dot > 0.75) {
                hitEnemy(enemy);
            }
        });
    };

    const hitEnemy = (enemy) => {
        enemy.data.hp -= 300;
        spawnContactFlash(enemy.sprite.position.clone());
        if (enemy.data.hp <= 0) {
            scene.remove(enemy.sprite);
            enemies = [];
            state.run.kills++;
            // SPAWN NEXT ONE
            setTimeout(spawnOneNPC, 1000);
        }
    };

    const spawnContactFlash = (pos) => {
        const flashGeo = new THREE.SphereGeometry(3, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
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

    const animateFist = () => {
        const fists = document.querySelectorAll('.fist');
        fists.forEach(f => {
            f.style.transform = `translateY(-200px) scale(1.4)`;
            setTimeout(() => f.style.transform = 'translateY(0) scale(1)', 100);
        });
    };

    const animate = () => {
        requestAnimationFrame(animate);
        let moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
        if (moving) {
            state.timeDilation = state.keys[' '] ? 0.12 : 1.0; 
            const speed = (state.keys[' '] ? 3.0 : 0.9);
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            camera.position.add(moveDir.multiplyScalar(speed));
            
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

            if (dist < 400 && dist > 10) {
                enemy.sprite.position.add(camera.position.clone().sub(enemy.sprite.position).normalize().multiplyScalar(0.2 * dt));
            }
        });

        document.getElementById('kills').innerText = state.run.kills;
        renderer.render(scene, camera);
    };

    return { init };
})();

window.Fighter = Fighter;
Fighter.init();
