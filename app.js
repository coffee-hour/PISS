/**
 * Sovereign v3.0.1: Viltrumite Carnage
 * Enhanced Enemy Visuals, Hit Stutter, and Impact FX.
 */

const Fighter = (() => {
    let state = {
        player: { hp: 100, maxHp: 100, momentum: 0 },
        target: { name: 'OMNI-MAN', hp: 1000, maxHp: 1000 },
        isAttacking: false,
        combo: 0
    };

    const init = () => {
        setupListeners();
        gameLoop();
        console.log("Sovereign Carnage v3.0.1 Initialized.");
    };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        
        layer.addEventListener('mousedown', (e) => {
            const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
            executePunch(side);
        });

        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 15;
            const y = (e.clientY / window.innerHeight - 0.5) * 15;
            const arena = document.getElementById('arena');
            const character = document.getElementById('enemy-character');
            
            // Perspective sway
            arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
            
            // Subtle parallax for enemy
            if (character) {
                character.style.transform = `translateX(${-x * 2}px) translateY(${y * 2}px)`;
            }
        });
    };

    const executePunch = (side) => {
        if (state.isAttacking) return;
        state.isAttacking = true;

        const arm = document.querySelector(`.arm-${side}`);
        const impactY = -280;
        const rotate = side === 'left' ? 30 : -30;

        // Animate Arm Punch
        arm.style.transform = `translateY(${impactY}px) rotate(${rotate}deg) scale(1.1)`;
        
        // Impact Logic with stutter
        setTimeout(() => {
            handleImpact();
            setTimeout(() => {
                arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 12 : -12}deg)`;
                state.isAttacking = false;
            }, 50);
        }, 100);
    };

    const handleImpact = () => {
        const container = document.getElementById('game-container');
        const enemy = document.getElementById('enemy-character');
        const flash = document.getElementById('fx-flash');

        // Visual Impact: Screen Shake
        const shake = 25;
        container.style.transform = `translate(${(Math.random()-0.5)*shake}px, ${(Math.random()-0.5)*shake}px)`;
        setTimeout(() => container.style.transform = 'translate(0,0)', 50);

        // Visual Impact: Enemy Hit Reaction
        if (enemy) {
            enemy.classList.remove('hit-active');
            void enemy.offsetWidth; // Trigger reflow
            enemy.classList.add('hit-active');
        }

        // Visual Impact: White Flash (Critical Feel)
        if (state.player.momentum >= 80) {
            flash.style.opacity = '0.3';
            setTimeout(() => flash.style.opacity = '0', 50);
        }

        // State Update
        const damage = 10 + Math.floor(state.player.momentum / 10);
        state.target.hp -= damage;
        state.player.momentum = Math.min(100, state.player.momentum + 4);
        
        renderUI();
    };

    const renderUI = () => {
        const playerHpFill = document.getElementById('player-hp');
        const enemyHpFill = document.getElementById('enemy-hp');
        const momentumFill = document.getElementById('momentum-fill');
        const momentumText = document.getElementById('momentum-text');

        if (playerHpFill) playerHpFill.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        if (enemyHpFill) enemyHpFill.style.width = `${(state.target.hp / state.target.maxHp) * 100}%`;
        if (momentumFill) momentumFill.style.width = `${state.player.momentum}%`;
        if (momentumText) momentumText.innerText = `MOMENTUM x${Math.floor(state.player.momentum / 10)}`;
    };

    const gameLoop = () => {
        // Natural momentum decay
        if (!state.isAttacking && state.player.momentum > 0) {
            state.player.momentum -= 0.05;
            renderUI();
        }
        requestAnimationFrame(gameLoop);
    };

    return { init };
})();

window.onload = Fighter.init;
