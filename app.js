import * as THREE from 'three';

/**
 * SOVEREIGN v5.4.0: 'BLOCKY CONQUEST' (ROBLOX PIVOT)
 * 1. Roblox Aesthetic: Replaced 3MF with procedural blocky humanoid rigs.
 * 2. Hitbox Reliability: Direct binding of gore/collision to simplified block meshes.
 * 3. Player Gauntlets: Articulated 'R6' blocky fists.
 * 4. Combat: Preserved 'Noon City' lighting and Lunge AI.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, hemiLight;
    
    let state = {
        player: { hp: 100, punchRange: 5.5, speed: 2.8, height: 15.0 },
        combat: { kills: 0 },
        timeDilation: 1.0,
        keys: { w: false, a: false, s: false, d: false, ' ': false, shift: false },
        isLocked: false,
        pitch: 0,
        yaw: 0,
        lastArmUsed: 'right'
    };

    let boss = null;
    let playerHands = { left: null, right: null };
    let bloodSystem = null;

    const init = () => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 50, 3000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(100, 300, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createArena();
        createBlockyHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        spawnBlockyOmniMan();

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        for (let i = 0; i < 300; i++) {
            const h = 100 + Math.random() * 500;
            const b = new THREE.Mesh(new THREE.BoxGeometry(80, h, 80), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
            b.position.set((Math.random()-0.5)*4000, h/2, (Math.random()-0.5)*4000);
            if (b.position.length() < 300) continue;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createBlockyHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 }); // Blue
        const createHand = (side) => {
            const group = new THREE.Group();
            // Blocky 'R6' Style Fist
            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), mat);
            group.add(fist);
            
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
            group.rotation.set(0.2, 0, 0);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
    };

    const spawnBlockyOmniMan = () => {
        if (boss) return;
        const omni = new THREE.Group();
        const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
        
        const white = mat(0xffffff);
        const red = mat(0xb71c1c);
        const skin = mat(0xffdbac);
        const black = mat(0x111111);

        // ROBLOX STYLE HEAD
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), skin);
        head.position.y = 7.5;
        // Mustache (Block)
        const stache = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.2), black);
        stache.position.set(0, -0.3, 0.8);
        head.add(stache);
        omni.add(head);

        // ROBLOX STYLE TORSO
        const torso = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 1.5), white);
        torso.position.y = 5.0;
        // Red Cape (Blocky)
        const cape = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6, 0.2), red);
        cape.position.set(0, 0, -0.9);
        torso.add(cape);
        omni.add(torso);

        // ARMS
        const createArm = (x, side) => {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 1), white);
            arm.position.set(x, 5.0, 0);
            return arm;
        };
        omni.add(createArm(-2.1, -1));
        omni.add(createArm(2.1, 1));

        // LEGS (Red)
        const createLeg = (x) => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.5, 1.2), red);
            leg.position.set(x, 1.75, 0);
            return leg;
        };
        omni.add(createLeg(-0.75));
        omni.add(createLeg(0.75));

        omni.position.set((Math.random()-0.5)*300, 100, (Math.random()-0.5)*300);
        scene.add(omni);
        boss = { 
            mesh: omni, hp: 50000, maxHp: 50000, 
            animTime: 0, vel: new THREE.Vector3(), attackTimer: 0 
        };
    };

    class BloodParticleSystem {
        constructor(scene) {
            this.count = 2000;
            this.geometry = new THREE.BufferGeometry();
            this.positions = new Float32Array(this.count * 3);
            this.velocities = Array.from({length: this.count}, () => new THREE.Vector3());
            this.lifetimes = new Float32Array(this.count);
            for(let i=0; i<this.count; i++) this.positions[i*3] = 10000;
            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.2, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 60; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*10 + dir.x*6, Math.random()*10 + dir.y*6, (Math.random()-0.5)*10 + dir.z*6);
                    n++;
                }
            }
        }
        update(dt) {
            const pos = this.geometry.getAttribute('position');
            for(let i=0; i<this.count; i++) {
                if(this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.5;
                    this.positions[i*3] += this.velocities[i].x * dt * 60;
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60;
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.35;
                } else { this.positions[i*3] = 10000; }
            }
            pos.needsUpdate = true;
        }
    }

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 2.5;
        setTimeout(() => h.position.z = -2.0, 70);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist < state.player.punchRange) {
                boss.hp -= 2000;
                bloodSystem.emit(boss.mesh.position, fwd.multiplyScalar(4));
                const bar = document.getElementById('boss-hp-fill');
                if (bar) bar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh); boss = null;
                    state.combat.kills++; document.getElementById('kills').innerText = state.combat.kills;
                    setTimeout(spawnBlockyOmniMan, 1500);
                }
            }
        }
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Space') state.timeDilation = 0.2;
            if(e.shiftKey) state.keys.shift = true;
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if(e.code === 'Space') state.timeDilation = 1.0;
            if(!e.shiftKey) state.keys.shift = false;
            if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if(!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if(state.isLocked) {
                state.yaw -= e.movementX * 0.0025; state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;

        if (state.isLocked) {
            const dir = new THREE.Vector3();
            if(state.keys.w) dir.z -= 1; if(state.keys.s) dir.z += 1;
            if(state.keys.a) dir.x -= 1; if(state.keys.d) dir.x += 1;
            dir.normalize().applyQuaternion(camera.quaternion);
            const s = state.player.speed * (state.keys.shift ? 4.0 : 1.0);
            camera.position.add(dir.multiplyScalar(s * dt * 60));
        }

        if (boss) {
            boss.animTime += dt;
            boss.mesh.lookAt(camera.position);
            
            // Roblox-style "Floating" Animation
            boss.mesh.position.y += Math.sin(boss.animTime * 2) * 0.15;
            
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.7), 0.05);
            boss.mesh.position.add(boss.vel);

            boss.attackTimer += dt;
            if (boss.attackTimer > 3.0) {
                boss.vel.add(targetDir.multiplyScalar(15.0));
                boss.attackTimer = 0;
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
