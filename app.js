import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * SOVEREIGN v5.0.0: 'BATTLE ENGINE' (REBUILD)
 * Rebuilt from scratch with indexed 3D pipeline and GLTF support.
 * Aesthetic: Low-poly / Fortnite-lite.
 * Core: Vanilla JS, Hardware-accelerated shaders.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { 
            hp: 100, 
            punchRange: 14.4,
            speed: 1.5,
            isFlying: false,
            height: 2.8
        },
        combat: { kills: 0, active: true },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false },
        isLocked: false,
        pitch: 0,
        yaw: 0,
        lastArmUsed: 'right'
    };

    let boss = null;
    let playerHands = { left: null, right: null };
    let bloodParticles = [];

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0b);
        scene.fog = new THREE.Fog(0x0a0a0b, 50, 1000);

        camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 3000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        // Lighting
        ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 2.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createArena();
        createCombatArms();
        spawnBoss();
        setupInput();

        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        // Low-poly ground
        const groundGeo = new THREE.PlaneGeometry(5000, 5000, 20, 20);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Low-poly city skyline
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
        for (let i = 0; i < 400; i++) {
            const h = 40 + Math.random() * 250;
            const w = 40 + Math.random() * 60;
            const x = (Math.random() - 0.5) * 3000;
            const z = (Math.random() - 0.5) * 3000;
            if (Math.abs(x) < 300 && Math.abs(z) < 300) continue;
            
            const b = new THREE.Mesh(boxGeo, boxMat);
            b.scale.set(w, h, w);
            b.position.set(x, h/2, z);
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createCombatArms = () => {
        const armMat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
        const createArm = (side) => {
            const group = new THREE.Group();
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 2.5), armMat);
            group.add(arm);
            
            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.9), armMat);
            fist.position.z = -1.5;
            group.add(fist);

            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -1.0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createArm('left');
        playerHands.right = createArm('right');
    };

    const spawnBoss = () => {
        if (boss) return;
        
        // Low-poly Omni-Man (v5 foundational model)
        const group = new THREE.Group();
        const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

        // Torso
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 4, 4, 12), mat(0xffffff));
        body.position.y = 5;
        group.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mat(0xffffff));
        head.position.y = 8.5;
        group.add(head);

        // Cape
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), mat(0xb71c1c));
        cape.position.set(0, 5, -1.2);
        cape.rotation.x = 0.1;
        group.add(cape);

        group.position.set((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200);
        scene.add(group);
        boss = { mesh: group, hp: 10000, maxHp: 10000 };
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') state.timeDilation = 0.2;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') state.timeDilation = 1.0;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                state.yaw -= e.movementX * 0.002;
                state.pitch -= e.movementY * 0.002;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const hand = playerHands[state.lastArmUsed];
        const initialZ = hand.position.z;
        
        // Attack Tween
        hand.position.z -= 2.0;
        setTimeout(() => hand.position.z = initialZ, 80);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.5) {
                boss.hp -= 1000;
                updateUI();
                spawnGore(boss.mesh.position.clone().add(new THREE.Vector3(0, 6, 0)));
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh);
                    boss = null;
                    state.combat.kills++;
                    updateUI();
                    setTimeout(spawnBoss, 1000);
                }
            }
        }
    };

    const spawnGore = (pos) => {
        const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
        for (let i = 0; i < 40; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.userData = { vel: new THREE.Vector3((Math.random()-0.5)*6, Math.random()*6, (Math.random()-0.5)*6), life: 1.0 };
            scene.add(p);
            bloodParticles.push(p);
        }
    };

    const updateUI = () => {
        const fill = document.getElementById('boss-hp-fill');
        if (fill && boss) fill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
        document.getElementById('kills').innerText = state.combat.kills;
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;

        if (state.isLocked) {
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1;
            if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1;
            if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            moveDir.y = 0;
            camera.position.add(moveDir.multiplyScalar(state.player.speed * state.timeDilation * 50 * 0.016));
        }

        if (boss) {
            boss.mesh.lookAt(camera.position.x, 0, camera.position.z);
            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist > 15 && dist < 1000) {
                const step = boss.mesh.position.clone().sub(camera.position).normalize().multiplyScalar(-0.4 * state.timeDilation);
                boss.mesh.position.add(step);
                boss.mesh.position.y = 8 + Math.sin(Date.now() * 0.002) * 5;
            }
        }

        bloodParticles.forEach((p, i) => {
            p.position.add(p.userData.vel.clone().multiplyScalar(state.timeDilation));
            p.userData.vel.y -= 0.15 * state.timeDilation;
            p.userData.life -= 0.015 * state.timeDilation;
            p.scale.setScalar(p.userData.life);
            if (p.userData.life <= 0) {
                scene.remove(p);
                bloodParticles.splice(i, 1);
            }
        });

        renderer.render(scene, camera);
    };

    return { init };
})();

Sovereign.init();
