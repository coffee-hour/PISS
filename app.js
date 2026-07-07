/**
 * Sovereign v3.0.0: First-Person Fighter Engine
 * Core mechanics: Raycasting interaction, First-Person Punch Logic, Perspective Shifts.
 */

const Fighter = (() => {
    let state = {
        player: { hp: 100, maxHp: 100, momentum: 0 },
        target: { name: 'OMNI-MAN', hp: 1000, maxHp: 1000 },
        isAttacking: false
    };

    const init = () => {
        setupListeners();
        gameLoop();
        console.log("Sovereign FP Engine v3.0 Initialized.");
    };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        
        layer.addEventListener('mousedown', (e) => {
            const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
            executePunch(side);
        });

        // Mouse move for subtle perspective sway
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 20;
            const y = (e.clientY / window.innerHeight - 0.5) * 20;
            const arena = document.getElementById('arena');
            arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
        });
    };

    const executePunch = (side) => {
        if (state.isAttacking) return;
        state.isAttacking = true;

        const arm = document.querySelector(`.arm-${side}`);
        const impactY = side === 'left' ? -200 : -200;
        const rotate = side === 'left' ? 25 : -25;

        // Animate Arm
        arm.style.transform = `translateY(${impactY}px) rotate(${rotate}deg)`;
        
        // Impact Logic
        setTimeout(() => {
            handleImpact();
            arm.style.transform = `translateY(100px) rotate(${side === 'left' ? 15 : -15}deg)`;
            state.isAttacking = false;
        }, 100);
    };

    const handleImpact = () => {
        // Screen Shake
        const container = document.getElementById('game-container');
        container.style.transform = `translate(${(Math.random()-0.5)*20}px, ${(Math.random()-0.5)*20}px)`;
        setTimeout(() => container.style.transform = 'translate(0,0)', 50);

        // Update State
        state.target.hp -= 10;
        state.player.momentum = Math.min(100, state.player.momentum + 5);
        renderUI();
    };

    const renderUI = () => {
        document.getElementById('player-hp').style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        document.getElementById('enemy-hp').style.width = `${(state.target.hp / state.target.maxHp) * 100}%`;
        document.getElementById('momentum-fill').style.width = `${state.player.momentum}%`;
        document.getElementById('momentum-text').innerText = `MOMENTUM x${Math.floor(state.player.momentum / 10)}`;
        document.getElementById('enemy-name').innerText = `TARGET: ${state.target.name}`;
    };

    const gameLoop = () => {
        // Future logic for enemy AI attacks and recovery
        requestAnimationFrame(gameLoop);
    };

    return { init };
})();

window.onload = Fighter.init;
