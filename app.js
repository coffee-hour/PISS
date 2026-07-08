import * as THREE from 'three';

/**
 * SOVEREIGN v5.7.3: 'EMERGENCY RENDER DIAGNOSTIC'
 * 1. Diagnostic Mode: Replaced complex scene with a minimal test cube.
 * 2. Unlit Material: Used MeshBasicMaterial to bypass light-array dependencies.
 * 3. Forced Mount: Re-initialized the renderer with explicit absolute sizing.
 * 4. Loop: Minimalist render loop to verify WebGL context health.
 */

const Sovereign = (() => {
    let scene, camera, renderer, clock;
    let testCube;
    
    let state = {
        initialized: false
    };

    const init = () => {
        if (state.initialized) return;
        state.initialized = true;

        console.log('Sovereign: Running v5.7.3 Diagnostic Render...');

        // 1. MINIMAL SCENE
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // Dark Grey diagnostic background

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 10;

        // 2. RENDERER (DIAGNOSTIC MOUNT)
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Force display parameters
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100vw';
        renderer.domElement.style.height = '100vh';
        renderer.domElement.style.zIndex = '0';
        document.body.appendChild(renderer.domElement);

        // 3. TEST GEOMETRY (UNLIT)
        // Using MeshBasicMaterial to ensure it renders even if lights fail.
        const geometry = new THREE.BoxGeometry(4, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0xffbf00, wireframe: true });
        testCube = new THREE.Mesh(geometry, material);
        scene.add(testCube);

        clock = new THREE.Clock();

        // 4. HUD OVERLAY (MINIMAL)
        const diagHUD = document.createElement('div');
        diagHUD.style = 'position:fixed; top:20px; left:20px; color:#ffbf00; font-family:monospace; z-index:9999; pointer-events:none;';
        diagHUD.innerHTML = 'ENGINE DIAGNOSTIC // v5.7.3<br>RENDERER: WEBGL_ACTIVE<br>MODE: UNLIT_WIRE_TEST';
        document.body.appendChild(diagHUD);

        window.addEventListener('resize', onWindowResize, false);
        animate();
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = () => {
        requestAnimationFrame(animate);
        
        // Rotate cube to verify loop is running
        if (testCube) {
            testCube.rotation.x += 0.01;
            testCube.rotation.y += 0.01;
        }

        renderer.render(scene, camera);
    };

    return { init };
})();

Sovereign.init();
