import * as THREE from 'three';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

/**
 * SOVEREIGN v5.1.2: 'Daylight Brawler & 3MF Repair'
 * 1. Environment: Switched to bright 'Noon City' lighting and sky.
 * 2. 3MF Repair: Fixed orientation (upright/facing player) and re-bound blood hitbox.
 * 3. Boss Logic: Implemented procedural attack cycles (tracking + lunging).
 * 4. Mechanics: Restored Particle Blood System and Flight physics.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, fillLight, ambientLight;
    
    let state = {
        player: { hp: 100, punchRange: 14.4, speed: 2.5, isFlying: true, height: 15.0 },
        combat: { kills: 0, active: true },
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
    let injectedModel = null;

    const init = () => {
        scene = new THREE.Scene();
        // 1. ENVIRONMENT: Bright Daytime City
        scene.background = new THREE.Color(0x87ceeb); // Sky Blue
        scene.fog = new THREE.Fog(0x87ceeb, 100, 2500);

        camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 5000);
        camera.position.set(0, state.player.height, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();

        // High Intensity Daytime Lighting
        ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
        sunLight.position.set(200, 500, 200);
        sunLight.castShadow = true;
        scene.add(sunLight);

        fillLight = new THREE.PointLight(0xffffff, 1.5);
        fillLight.position.set(-200, 100, -200);
        scene.add(fillLight);

        createDaytimeArena();
        createForensicHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        // 2. 3MF REPAIR: Orientation & Loading
        const loader = new ThreeMFLoader();
        loader.load('omni-man.3mf', (object) => {
            console.log('omni-man.3mf repaired and loaded.');
            injectedModel = object;
            // Upright orientation: 3MF often has Y-Z swap or local offset
            injectedModel.rotation.x = -Math.PI / 2; 
            injectedModel.scale.set(0.12, 0.12, 0.12);
            spawnInjectedBoss();
        }, undefined, (error) => {
            console.warn('3MF load failed. Defaulting to Forensic Sentinel.');
            spawnForensicOmniMan();
        });

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createDaytimeArena = () => {
        const groundGeo = new THREE.PlaneGeometry(5000, 5000);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Bright Skyscrapers
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 400; i++) {
            const h = 50 + Math.random() * 300;
            const w = 40 + Math.random() * 80;
            const x = (Math.random() - 0.5) * 4000;
            const z = (Math.random() - 0.5) * 4000;
            if (Math.abs(x) < 300 && Math.abs(z) < 300) continue;
            const b = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
            b.scale.set(w, h, w);
            b.position.set(x, h/2, z);
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
        }
    };

    const createForensicHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 }); 
        const createHand = (side) => {
            const group = new THREE.Group();
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.8), mat));
            const offsets = [-0.25, -0.08, 0.08, 0.25];
            offsets.forEach(x => {
                const finger = new THREE.Group();
                finger.position.set(x, 0, 0.4);
                let prev = finger;
                for(let s=0; s<3; s++) {
                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.3), mat);
                    seg.rotation.x = Math.PI/2;
                    seg.position.z = 0.15;
                    const j = new THREE.Group();
                    j.add(seg); prev.add(j);
                    if(s > 0) j.position.z = 0.3;
                    prev = j;
                }
                group.add(finger);
            });
            group.position.set(side === 'left' ? -1.8 : 1.8, -1.2, -2.0);
            group.rotation.set(0.3, side === 'left' ? 0.1 : -0.1, Math.PI);
            camera.add(group);
            return group;
        };
        scene.add(camera);
        playerHands.left = createHand('left');
        playerHands.right = createHand('right');
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
        emit(pos, impactVel) {
            let emitted = 0;
            for (let i = 0; i < this.count && emitted < 60; i++) {
                if (this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*10+impactVel.x, Math.random()*10+impactVel.y, (Math.random()-0.5)*10+impactVel.z);
                    emitted++;
                }
            }
        }
        update(dt) {
            const posAttr = this.geometry.getAttribute('position');
            for (let i = 0; i < this.count; i++) {
                if (this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.2;
                    this.positions[i*3] += this.velocities[i].x * dt * 60; 
                    this.positions[i*3+1] += this.velocities[i].y * dt * 60; 
                    this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.3; // Gravity
                } else { this.positions[i*3] = 10000; }
            }
            posAttr.needsUpdate = true;
        }
    }

    const spawnInjectedBoss = () => {
        if (boss || !injectedModel) return;
        const group = new THREE.Group();
        group.add(injectedModel.clone());
        group.position.set((Math.random()-0.5)*300, 40, (Math.random()-0.5)*300);
        scene.add(group);
        // 4. BOSS ATTACK CYCLE: Tracking + Procedural Punching
        boss = { 
            mesh: group, hp: 50000, maxHp: 50000, 
            state: 'tracking', attackTimer: 0, lungeVel: new THREE.Vector3() 
        };
    };

    const spawnForensicOmniMan = () => {
        if (boss) return;
        const omni = new THREE.Group();
        const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 32), mat(0xffdbac));
        head.position.y = 8.6; omni.add(head);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 6.0, 32), mat(0xffffff));
        torso.position.y = 5.2; omni.add(torso);
        omni.position.set((Math.random()-0.5)*300, 40, (Math.random()-0.5)*300);
        scene.add(omni);
        boss = { mesh: omni, hp: 40000, maxHp: 40000, state: 'tracking', attackTimer: 0 };
    };

    const setupInput = () => {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') state.timeDilation = 0.2;
            if (e.key === 'Shift') state.keys.shift = true;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true;
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') state.timeDilation = 1.0;
            if (e.key === 'Shift') state.keys.shift = false;
            if (state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false;
        });
        document.addEventListener('mousedown', () => {
            if (!state.isLocked) document.body.requestPointerLock();
            else performAttack();
        });
        document.addEventListener('pointerlockchange', () => { state.isLocked = document.pointerLockElement === document.body; });
        document.addEventListener('mousemove', (e) => {
            if (state.isLocked) {
                state.yaw -= e.movementX * 0.0025; state.pitch -= e.movementY * 0.0025;
                state.pitch = Math.max(-1.5, Math.min(1.5, state.pitch));
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const hand = playerHands[state.lastArmUsed];
        hand.position.z -= 2.5;
        setTimeout(() => hand.position.z = -2.0, 70);
        
        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.4) {
                boss.hp -= 1800;
                // 3. BLOOD RE-BIND: Corrected Hit-Point
                bloodSystem.emit(boss.mesh.position.clone(), forward.multiplyScalar(6));
                const fill = document.getElementById('boss-hp-fill');
                if (fill) fill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh); boss = null;
                    state.combat.kills++; document.getElementById('kills').innerText = state.combat.kills;
                    setTimeout(injectedModel ? spawnInjectedBoss : spawnForensicOmniMan, 1500);
                }
            }
        }
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        const dt = clock.getDelta() * state.timeDilation;
        
        // 3. FLIGHT MECHANICS: WASD + Camera Direct Movement
        if (state.isLocked) {
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1; if (state.keys.s) moveDir.z += 1;
            if (state.keys.a) moveDir.x -= 1; if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion);
            const finalSpeed = state.player.speed * (state.keys.shift ? 3 : 1);
            camera.position.add(moveDir.multiplyScalar(finalSpeed * state.timeDilation * 60 * dt));
        }

        if (boss) {
            // Fix 3MF LookAt (requires compensating for the -PI/2 x-rot)
            boss.mesh.lookAt(camera.position);
            const dist = camera.position.distanceTo(boss.mesh.position);
            
            // Boss AI Cycle
            boss.attackTimer += dt;
            if (boss.attackTimer > 2.5 && dist < 150) {
                // Lunge Attack
                boss.state = 'lunging';
                const lungeDir = camera.position.clone().sub(boss.mesh.position).normalize();
                boss.lungeVel = lungeDir.multiplyScalar(1.2);
                boss.attackTimer = 0;
            } else if (boss.attackTimer > 0.8) {
                boss.state = 'tracking';
            }

            if (boss.state === 'lunging') {
                boss.mesh.position.add(boss.lungeVel);
            } else {
                const trackStep = camera.position.clone().sub(boss.mesh.position).normalize().multiplyScalar(0.45 * state.timeDilation);
                boss.mesh.position.add(trackStep);
            }
        }

        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
