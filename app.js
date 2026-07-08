import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

/**
 * SOVEREIGN v5.1.1: '3MF Asset Integration'
 * 1. Integrated 'omni-man.3mf' from repository.
 * 2. Implemented 3MFLoader for direct model injection.
 * 3. Maintained v5.1.0 Forensic Fallback and Combat Engine.
 */

const Sovereign = (() => {
    let scene, camera, renderer, raycaster, clock;
    let sunLight, ambientLight;
    
    let state = {
        player: { hp: 100, punchRange: 14.4, speed: 1.5, isFlying: false, height: 2.8 },
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
    let bloodSystem = null;
    let injectedModel = null;

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

        ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xff8c00, 2.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        scene.add(sunLight);

        createArena();
        createForensicHands();
        bloodSystem = new BloodParticleSystem(scene);
        
        // Load omni-man.3mf
        const loader = new ThreeMFLoader();
        loader.load('omni-man.3mf', (object) => {
            console.log('omni-man.3mf successfully loaded.');
            injectedModel = object;
            injectedModel.scale.set(0.1, 0.1, 0.1); // Scaled for 3MF units
            spawnInjectedBoss();
        }, (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        }, (error) => {
            console.warn('omni-man.3mf load failed. Defaulting to Forensic Sentinel.');
            spawnForensicOmniMan();
        });

        setupInput();
        window.addEventListener('resize', onWindowResize);
        animate();
    };

    const createArena = () => {
        const groundGeo = new THREE.PlaneGeometry(5000, 5000, 20, 20);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
        for (let i = 0; i < 300; i++) {
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

    const createForensicHands = () => {
        const mat = new THREE.MeshLambertMaterial({ color: 0x1e88e5 }); 
        const createHand = (side) => {
            const group = new THREE.Group();
            const handBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.8), mat);
            group.add(handBody);
            for(let i=0; i<4; i++) {
                const k = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
                k.position.set(-0.25 + i*0.17, 0.15, 0.4);
                group.add(k);
            }
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
                    j.add(seg);
                    prev.add(j);
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

    const spawnInjectedBoss = () => {
        if (boss || !injectedModel) return;
        const group = injectedModel.clone();
        group.position.set((Math.random()-0.5)*200, 10, (Math.random()-0.5)*200);
        scene.add(group);
        boss = { mesh: group, hp: 40000, maxHp: 40000 };
    };

    const spawnForensicOmniMan = () => {
        if (boss) return;
        const omni = new THREE.Group();
        const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
        const white = mat(0xffffff); const red = mat(0xb71c1c); const skin = mat(0xffdbac); const black = mat(0x111111); const grey = mat(0x888888);
        const head = new THREE.Group();
        head.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), skin));
        const stache = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 20, Math.PI), black);
        stache.position.set(0, -0.35, 0.75); stache.rotation.x = Math.PI/2;
        head.add(stache);
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 24, 0, Math.PI*2, 0, Math.PI/2), black);
        hair.rotation.x = -0.2; head.add(hair);
        for(let side of [-1, 1]) {
            const temple = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), grey);
            temple.position.set(0.75 * side, 0.3, 0.2); temple.scale.set(1, 1.5, 1);
            head.add(temple);
        }
        head.position.y = 8.6; omni.add(head);
        const torso = new THREE.Group();
        torso.add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 5.5, 32), white));
        for(let side of [-1, 1]) {
            const pec = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 24), red);
            pec.position.set(0.6 * side, 1.8, 0.55); pec.scale.set(1.1, 0.9, 0.4);
            torso.add(pec);
        }
        for(let i=0; i<6; i++) {
            const ab = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), white);
            ab.position.set((i%2?0.35:-0.35), 0.6 - Math.floor(i/2)*0.7, 0.7); ab.scale.set(1.1, 0.7, 0.4);
            torso.add(ab);
        }
        torso.position.y = 5.2; omni.add(torso);
        const createLimb = (x, y, color, side) => {
            const g = new THREE.Group();
            for(let i=0; i<40; i++) {
                const s = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i*0.01, 16, 16), mat(color));
                s.position.y = -i * 0.2; s.position.x = Math.sin(i*0.15) * 0.15 * side; g.add(s);
            }
            g.position.set(x, y, 0); return g;
        };
        omni.add(createLimb(-2.1, 7.2, 0xffffff, -1)); omni.add(createLimb(2.1, 7.2, 0xffffff, 1));
        omni.add(createLimb(-1.0, 3.0, 0xb71c1c, -1)); omni.add(createLimb(1.0, 3.0, 0xb71c1c, 1));
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(5, 9.5), red);
        cape.position.set(0, 4.5, -1.2); cape.rotation.x = 0.1; omni.add(cape);
        omni.position.set((Math.random()-0.5)*200, 0, (Math.random()-0.5)*200);
        scene.add(omni);
        boss = { mesh: omni, hp: 30000, maxHp: 30000, cape: cape };
    };

    class BloodParticleSystem {
        constructor(scene) {
            this.count = 2000; this.geometry = new THREE.BufferGeometry();
            this.positions = new Float32Array(this.count * 3); this.velocities = Array.from({length: this.count}, () => new THREE.Vector3());
            this.lifetimes = new Float32Array(this.count); for(let i=0; i<this.count; i++) this.positions[i*3] = 10000;
            this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
            this.material = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.12, transparent: true });
            this.points = new THREE.Points(this.geometry, this.material); scene.add(this.points);
        }
        emit(pos, impactVel) {
            let emitted = 0;
            for (let i = 0; i < this.count && emitted < 60; i++) {
                if (this.lifetimes[i] <= 0) {
                    this.lifetimes[i] = 1.0;
                    this.positions[i*3] = pos.x; this.positions[i*3+1] = pos.y; this.positions[i*3+2] = pos.z;
                    this.velocities[i].set((Math.random()-0.5)*6+impactVel.x, Math.random()*6+impactVel.y, (Math.random()-0.5)*6+impactVel.z);
                    emitted++;
                }
            }
        }
        update(dt) {
            const posAttr = this.geometry.getAttribute('position');
            for (let i = 0; i < this.count; i++) {
                if (this.lifetimes[i] > 0) {
                    this.lifetimes[i] -= dt * 1.5;
                    this.positions[i*3] += this.velocities[i].x * dt * 60; this.positions[i*3+1] += this.velocities[i].y * dt * 60; this.positions[i*3+2] += this.velocities[i].z * dt * 60;
                    this.velocities[i].y -= 0.25;
                } else { this.positions[i*3] = 10000; }
            }
            posAttr.needsUpdate = true;
        }
    }

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
                state.yaw -= e.movementX * 0.002; state.pitch -= e.movementY * 0.002;
                camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
            }
        });
    };

    const performAttack = () => {
        state.lastArmUsed = state.lastArmUsed === 'right' ? 'left' : 'right';
        const hand = playerHands[state.lastArmUsed];
        const initialZ = hand.position.z;
        hand.position.z -= 2.2;
        setTimeout(() => hand.position.z = initialZ, 80);
        if (boss) {
            const dist = camera.position.distanceTo(boss.mesh.position);
            const dir = boss.mesh.position.clone().sub(camera.position).normalize();
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            if (dist <= state.player.punchRange && dir.dot(forward) > 0.5) {
                boss.hp -= 1500;
                bloodSystem.emit(boss.mesh.position.clone().add(new THREE.Vector3(0, 7, 0)), forward.multiplyScalar(5));
                const fill = document.getElementById('boss-hp-fill');
                if (fill) fill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
                if (boss.hp <= 0) {
                    scene.remove(boss.mesh); boss = null;
                    state.combat.kills++; document.getElementById('kills').innerText = state.combat.kills;
                    setTimeout(injectedModel ? spawnInjectedBoss : spawnForensicOmniMan, 1000);
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
        if (state.isLocked) {
            const moveDir = new THREE.Vector3();
            if (state.keys.w) moveDir.z -= 1; if (state.keys.s) moveDir.z += 1; if (state.keys.a) moveDir.x -= 1; if (state.keys.d) moveDir.x += 1;
            moveDir.normalize().applyQuaternion(camera.quaternion); moveDir.y = 0;
            camera.position.add(moveDir.multiplyScalar(state.player.speed * state.timeDilation * 50 * 0.016));
        }
        if (boss) {
            boss.mesh.lookAt(camera.position.x, boss.mesh.position.y, camera.position.z);
            const dist = camera.position.distanceTo(boss.mesh.position);
            if (dist > 15 && dist < 1200) {
                const step = boss.mesh.position.clone().sub(camera.position).normalize().multiplyScalar(-0.45 * state.timeDilation);
                boss.mesh.position.add(step); boss.mesh.position.y = 10 + Math.sin(Date.now() * 0.002) * 6;
            }
        }
        if (bloodSystem) bloodSystem.update(dt);
        renderer.render(scene, camera);
    };
    return { init };
})();

Sovereign.init();
