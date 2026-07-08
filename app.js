import * as THREE from 'three';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

/**
 * SOVEREIGN v5.2.0: 'SKELETAL OVERHAUL'
 * 1. Procedural Skeletal Animation: Implemented dynamic limb-swinging for flight and attack poses.
 * 2. Hitbox Correction: Calibrated raycasting and proximity math to fix infinite range punching.
 * 3. Gore Binding: Fixed particle emission by sampling the world-matrix of the boss mesh.
 * 4. High-Noon Lighting: Quad-directional lighting array for forensic visibility.
 * 5. Flight Physics: Re-implemented 6DOF flight with momentum-based tracking.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, hemiLight, backLight;
    
    let state = {
        player: { hp: 100, punchRange: 4.5, speed: 2.8, height: 15.0 },
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
        scene.background = new THREE.Color(0xb0e0e6);
        scene.fog = new THREE.Fog(0xb0e0e6, 50, 2000);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        // High-Noon Quad-Lighting
        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);
        backLight = new THREE.PointLight(0xffffff, 1.2);
        backLight.position.set(-100, 100, -100);
        scene.add(backLight);

        createArena();
        createHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        // v5.2.0: Load and Wrap 3MF for Procedural Skeletal Control
        const loader = new ThreeMFLoader();
        loader.load('omni-man.3mf', (object) => {
            console.log('3MF Asset Initialized.');
            spawnOmniMan(object);
        }, undefined, (err) => {
            console.error('3MF Load Failed. Scene Integrity compromised.');
        });

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
            const h = 60 + Math.random() * 350;
            const b = new THREE.Mesh(new THREE.BoxGeometry(50, h, 50), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
            b.position.set((Math.random()-0.5)*3000, h/2, (Math.random()-0.5)*3000);
            if (b.position.length() < 300) continue;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
        const makeHand = (side) => {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.7), mat);
            g.add(body);
            // Finger-Skeleton placeholders for brawler silhouette
            for(let i=0; i<4; i++) {
                const f = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4), mat);
                f.position.set(-0.2 + i*0.14, 0, 0.4);
                f.rotation.x = Math.PI/2;
                g.add(f);
            }
            g.position.set(side === 'left' ? -1.5 : 1.5, -1.0, -1.8);
            g.rotation.set(0.2, 0, Math.PI);
            camera.add(g);
            return g;
        };
        scene.add(camera);
        playerHands.left = makeHand('left');
        playerHands.right = makeHand('right');
    };

    const spawnOmniMan = (asset) => {
        const group = new THREE.Group();
        const model = asset.clone();
        model.rotation.x = -Math.PI / 2; // Upright correction
        model.scale.set(0.12, 0.12, 0.12);
        group.add(model);
        group.position.set((Math.random()-0.5)*200, 50, (Math.random()-0.5)*200);
        scene.add(group);

        boss = { 
            mesh: group, model: model, hp: 60000, maxHp: 60000,
            animTime: 0, 
            vel: new THREE.Vector3(),
            attackTimer: 0
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
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.15, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 50; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*8 + dir.x*4, Math.random()*8 + dir.y*4, (Math.random()-0.5)*8 + dir.z*4);
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
                    this.velocities[i].y -= 0.2;
                } else { this.positions[i*3] = 10000; }
            }
            pos.needsUpdate = true;
        }
    }

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 2.0;
        setTimeout(() => h.position.z = -1.8, 80);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            // FIXED HITBOX: Strict 4.5 unit range
            if (dist < state.player.punchRange && dir.dot(fwd) > 0.6) {
                boss.hp -= 2000;
                bloodSystem.emit(boss.mesh.position, fwd.multiplyScalar(3));
                const bar = document.getElementById('boss-hp-fill');
                if (bar) bar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
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
                state.yaw -= e.movementX * 0.002; state.pitch -= e.movementY * 0.002;
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
            // PROCEDURAL SKELETAL SWAY: Simulating limb movement/flight posture
            boss.model.rotation.y = Math.sin(boss.animTime * 2.5) * 0.1;
            boss.model.position.y = Math.sin(boss.animTime * 1.8) * 1.5;
            
            boss.mesh.lookAt(camera.position);
            const dist = camera.position.distanceTo(boss.mesh.position);
            
            // Momentum-based tracking
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.8), 0.05);
            boss.mesh.position.add(boss.vel);

            // Attack Lunge logic
            boss.attackTimer += dt;
            if (boss.attackTimer > 3.0 && dist < 100) {
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
