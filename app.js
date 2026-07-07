import * as THREE from 'three';

/**
 * Sovereign 3D (v4.1.0)
 * 3D Engine: Three.js
 * Mechanics: WASD + Time Dilation
 */

const Fighter = (() => {
    let scene, camera, renderer, raycaster;
    let state = {
        player: { hp: 100, maxHp: 100, strength: 1, speed: 1 },
        run: { kills: 0, tier: 1, active: true, choicesPending: false },
        timeDilation: 0,
        keys: { w: false, a: false, s: false, d: false },
        mouse: new THREE.Vector2(),
        isLocked: false
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID HOST', color: 0xff80ab, hp: 120, weight: 1 },
        { id: 'flaxan', name: 'FLAXAN SCOUT', color: 0xe65100, hp: 150, weight: 1 },
        { id: 'atomeve', name: 'ATOM EVE', color: 0xf06292, hp: 350, weight: 2 },
        { id: 'robot', name: 'ROBOT', color: 0x43a047, hp: 700, weight: 3 },
        { id: 'omniman', name: 'OMNI-MAN', color: 0xf8fafc, hp: 20000, weight: 10 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', color: 0xb91c1c, hp: 25000, weight: 10 }
    ];

    let enemies = [];
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050608);
        scene.fog = new THREE.FogExp2(0x050608, 0.05);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();

        // Floor Grid
        const grid = new THREE.GridHelper(200, 50, 0xff8c00, 0x222222);
        grid.position.y = -2;
        scene.add(grid);

        setupControls();
        spawnBatch();
        animate();
    };

    const setupControls = () => {
        window.addEventListener('keydown', (e) => { if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', (e) => { if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false; });
        
        window.addEventListener('mousedown', () => {
            if (!state.isLocked) {
                document.body.requestPointerLock();
            } else if (state.run.active && !state.run.choicesPending) {
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

    // Creating 3D Stickman Billboards
    const createEnemySprite = (data) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        const color = '#' + data.color.toString(16).padStart(6, '0');
        ctx.strokeStyle = color;
        ctx.lineWidth = 10;
        
        // Head
        ctx.beginPath(); ctx.arc(128, 60, 40, 0, Math.PI*2); ctx.stroke();
        // Body
        ctx.beginPath(); ctx.moveTo(128, 100); ctx.lineTo(128, 300); ctx.stroke();
        // Arms
        ctx.beginPath(); ctx.moveTo(128, 150); ctx.lineTo(60, 220); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 150); ctx.lineTo(196, 220); ctx.stroke();
        // Legs
        ctx.beginPath(); ctx.moveTo(128, 300); ctx.lineTo(60, 450); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(128, 300); ctx.lineTo(196, 450); ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 4, 1);
        
        const x = (Math.random() - 0.5) * 40;
        const z = -Math.random() * 40 - 5;
        sprite.position.set(x, 0, z);

        scene.add(sprite);
        return { sprite, data: { ...data, hp: data.hp, maxHp: data.hp } };
    };

    const spawnBatch = () => {
        const tier = state.run.tier;
        for (let i = 0; i < 5; i++) {
            const pool = roster.filter(r => r.weight <= tier + 1);
            const base = pool[Math.floor(Math.random() * pool.length)];
            enemies.push(createEnemySprite(base));
        }
    };

    const performStrike = () => {
        state.timeDilation = 1.0;
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        const intersects = raycaster.intersectObjects(enemies.map(e => e.sprite));

        if (intersects.length > 0) {
            const hit = enemies.find(e => e.sprite === intersects[0].object);
            if (hit) {
                hit.data.hp -= 25 * state.player.strength;
                spawnBlood(intersects[0].point);
                updateTargetHUD(hit.data);
                if (hit.data.hp <= 0) {
                    scene.remove(hit.sprite);
                    enemies = enemies.filter(e => e !== hit);
                    state.run.kills++;
                    if (enemies.length === 0) {
                        state.run.tier++;
                        spawnBatch();
                    }
                }
            }
        }
    };

    const spawnBlood = (pos) => {
        const geo = new THREE.SphereGeometry(0.1, 8, 8);
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
        if (moving) {
            state.timeDilation = Math.min(1.0, state.timeDilation + 0.1);
            const speed = 0.2;
            if (state.keys.w) camera.translateZ(-speed);
            if (state.keys.s) camera.translateZ(speed);
            if (state.keys.a) camera.translateX(-speed);
            if (state.keys.d) camera.translateX(speed);
            camera.position.y = 0;
        } else {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        
        // Update Particles with Time Dilation
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

        const status = document.getElementById('time-status');
        if (status) {
            status.innerText = dt > 0.1 ? "TIME MOVING" : "TIME FROZEN";
            status.className = dt > 0.1 ? "time-active" : "";
        }

        renderUI();
        renderer.render(scene, camera);
    };

    const updateTargetHUD = (data) => {
        const name = document.getElementById('enemy-name');
        const hp = document.getElementById('enemy-hp');
        if (name) name.innerText = data.name;
        if (hp) hp.style.width = `${(data.hp / data.maxHp) * 100}%`;
    };

    const renderUI = () => {
        const php = document.getElementById('player-hp');
        const kills = document.getElementById('enemies-defeated');
        const tier = document.getElementById('run-tier');
        if (php) php.style.width = `${state.player.hp}%`;
        if (kills) kills.innerText = state.run.kills;
        if (tier) tier.innerText = state.run.tier;
    };

    return { init };
})();

Fighter.init();
