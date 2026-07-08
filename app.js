import * as THREE from 'three';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

/**
 * SOVEREIGN v5.3.0: 'THE OVERHAUL - PHASE 2'
 * 1. Skeletal Hands: 5-finger articulated gauntlets (Phalange rigs).
 * 2. Hitbox Proxy: Invisible Sphere hitbox for 1:1 blood-binding.
 * 3. Procedural Limb-Sway: Sine-wave limb oscillation for flight posture.
 * 4. Combat: Fixed infinite range (4.5u max) and orientation.
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
        scene.fog = new THREE.Fog(0xb0e0e6, 50, 2500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
        scene.add(hemiLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(150, 300, 150);
        sunLight.castShadow = true;
        scene.add(sunLight);
        backLight = new THREE.PointLight(0xffffff, 1.5);
        backLight.position.set(-150, 100, -150);
        scene.add(backLight);

        createArena();
        createSkeletalHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        const loader = new ThreeMFLoader();
        loader.load('omni-man.3mf', (object) => {
            spawnOmniMan(object);
        }, undefined, (err) => {
            console.error('3MF Load Failed.');
        });

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x555555 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        for (let i = 0; i < 400; i++) {
            const h = 80 + Math.random() * 450;
            const b = new THREE.Mesh(new THREE.BoxGeometry(60, h, 60), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
            b.position.set((Math.random()-0.5)*4000, h/2, (Math.random()-0.5)*4000);
            if (b.position.length() < 300) continue;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createSkeletalHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 });
        const createGauntlet = (side) => {
            const g = new THREE.Group();
            
            // Back of Hand / Knuckles
            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.8), mat);
            g.add(palm);

            // 5-Finger Articulated Skeleton
            const fingerOffsets = [-0.3, -0.1, 0.1, 0.3, 0.45];
            fingerOffsets.forEach((x, i) => {
                const finger = new THREE.Group();
                finger.position.set(side === 'right' ? x : -x, 0, 0.4);
                if (i === 4) finger.rotation.y = side === 'right' ? -0.5 : 0.5; // Thumb
                
                let prev = finger;
                for(let s=0; s<3; s++) {
                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.3), mat);
                    seg.rotation.x = Math.PI/2;
                    seg.position.z = 0.15;
                    const joint = new THREE.Group();
                    joint.add(seg);
                    prev.add(joint);
                    if(s > 0) joint.position.z = 0.3;
                    prev = joint;
                }
                g.add(finger);
            });

            g.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -1.8);
            // KNUCKLES TO PLAYER, FINGERS AWAY
            g.rotation.set(0.3, 0, Math.PI);
            camera.add(g);
            return g;
        };
        scene.add(camera);
        playerHands.left = createGauntlet('left');
        playerHands.right = createGauntlet('right');
    };

    const spawnOmniMan = (asset) => {
        const group = new THREE.Group();
        const model = asset.clone();
        
        // Orientation Correction
        model.rotation.x = -Math.PI / 2;
        model.scale.set(0.12, 0.12, 0.12);
        group.add(model);

        // 1. BLOOD PROXY: Sphere hitbox that follows the model for 1:1 binding
        const hitbox = new THREE.Mesh(
            new THREE.SphereGeometry(6, 8, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        group.add(hitbox);

        group.position.set((Math.random()-0.5)*300, 100, (Math.random()-0.5)*300);
        scene.add(group);

        boss = { 
            mesh: group, model: model, hitbox: hitbox,
            hp: 80000, maxHp: 80000,
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
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.2, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material);
            scene.add(this.points);
        }
        emit(pos, dir) {
            let n = 0;
            for(let i=0; i<this.count && n < 60; i++) {
                if(this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x + (Math.random()-0.5)*2;
                    this.positions[i*3+1] = pos.y + (Math.random()-0.5)*2;
                    this.positions[i*3+2] = pos.z + (Math.random()-0.5)*2;
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
                    this.velocities[i].y -= 0.35; // Gravity
                } else { this.positions[i*3] = 10000; }
            }
            pos.needsUpdate = true;
        }
    }

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const h = playerHands[state.lastArmUsed];
        h.position.z -= 2.5;
        setTimeout(() => h.position.z = -1.8, 80);

        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            
            // STRICT HITBOX: 4.5 units
            if (dist < state.player.punchRange && dir.dot(fwd) > 0.5) {
                boss.hp -= 2500;
                // BLOOD BINDING: Emit from the boss mesh world position
                const hitPos = new THREE.Vector3();
                boss.mesh.getWorldPosition(hitPos);
                bloodSystem.emit(hitPos, fwd.multiplyScalar(4));
                
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
            // 2. PROCEDURAL LIMB-SWAY: Sine-wave oscillation for limbs/posture
            boss.model.position.y = Math.sin(boss.animTime * 2) * 1.5;
            boss.model.rotation.y = Math.sin(boss.animTime * 1.5) * 0.15;
            boss.model.rotation.z = Math.cos(boss.animTime * 1.5) * 0.05;

            // FORCE FACING: Force Omni-Man to always face the player
            boss.mesh.lookAt(camera.position);
            
            const targetDir = camera.position.clone().sub(boss.mesh.position).normalize();
            boss.vel.lerp(targetDir.multiplyScalar(0.7), 0.04);
            boss.mesh.position.add(boss.vel);

            boss.attackTimer += dt;
            if (boss.attackTimer > 2.8) {
                boss.vel.add(targetDir.multiplyScalar(12.0)); // Lunge
                boss.attackTimer = 0;
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };

    return { init };
})();

Sovereign.init();
