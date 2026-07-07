/**
 * Sovereign v3.1.0: Viltrumite Conflict
 * Multi-Target Manager, Enemy AI, and Retaliation Logic.
 */

const Fighter = (() => {
    let state = {
        player: { hp: 100, maxHp: 100, momentum: 0, lastDamage: 0 },
        enemies: [
            { id: 'sequid', name: 'SEQUID SWARM', hp: 500, maxHp: 500, class: 'sequid', attackRate: 4000, power: 8 },
            { id: 'flaxan', name: 'FLAXAN COMMANDER', hp: 1500, maxHp: 1500, class: 'flaxan', attackRate: 3500, power: 12 },
            { id: 'thragg', name: 'GRAND REGENT THRAGG', hp: 5000, maxHp: 5000, class: 'thragg', attackRate: 3000, power: 25 },
            { id: 'omniman', name: 'OMNI-MAN', hp: 10000, maxHp: 10000, class: 'omniman', attackRate: 2500, power: 40 }
        ],
        currentTargetIdx: 0,
        isAttacking: false,
        isBeingHit: false,
        gameActive: true
    };

    const init = () => {
        setupListeners();
        gameLoop();
        renderTarget();
        console.log("Sovereign Conflict v3.1.0 Initialized.");
    };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        layer.addEventListener('mousedown', (e) => {
            if (!state.gameActive) return;
            const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
            executePunch(side);
        });

        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 15;
            const y = (e.clientY / window.innerHeight - 0.5) * 15;
            const arena = document.getElementById('arena');
            const character = document.getElementById('enemy-character');
            if (arena) arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
            if (character) character.style.transform = `translateX(${-x * 2}px) translateY(${y * 2}px)`;
        });
    };

    const renderTarget = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        const character = document.getElementById('enemy-character');
        const nameLabel = document.getElementById('enemy-name');
        
        if (character) {
            character.className = `enemy-character ${enemy.class}`;
            character.style.opacity = '1';
        }
        if (nameLabel) nameLabel.innerText = `TARGET: ${enemy.name}`;
        log(`NEW TARGET ACQUIRED: ${enemy.name}`);
        renderUI();
    };

    const executePunch = (side) => {
        if (state.isAttacking) return;
        state.isAttacking = true;

        const arm = document.querySelector(`.arm-${side}`);
        arm.style.transform = `translateY(-280px) rotate(${side === 'left' ? 30 : -30}deg) scale(1.1)`;
        
        setTimeout(() => {
            handleImpact();
            setTimeout(() => {
                arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 12 : -12}deg)`;
                state.isAttacking = false;
            }, 50);
        }, 100);
    };

    const handleImpact = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        const enemyEl = document.getElementById('enemy-character');
        
        // Shake & Flash
        triggerScreenShake(25);
        if (enemyEl) {
            enemyEl.classList.remove('hit-active');
            void enemyEl.offsetWidth;
            enemyEl.classList.add('hit-active');
        }

        // Damage Logic
        const dmg = 10 + Math.floor(state.player.momentum / 10);
        enemy.hp -= dmg;
        state.player.momentum = Math.min(100, state.player.momentum + 4);

        if (enemy.hp <= 0) {
            defeatEnemy();
        }
        renderUI();
    };

    const defeatEnemy = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        log(`TARGET NEUTRALIZED: ${enemy.name}`);
        state.player.momentum = Math.min(100, state.player.momentum + 50);
        
        const character = document.getElementById('enemy-character');
        if (character) character.style.opacity = '0';
        
        setTimeout(() => {
            state.currentTargetIdx = (state.currentTargetIdx + 1) % state.enemies.length;
            renderTarget();
        }, 1000);
    };

    const enemyAttack = () => {
        if (!state.gameActive || state.player.hp <= 0) return;
        const enemy = state.enemies[state.currentTargetIdx];
        const enemyEl = document.getElementById('enemy-character');

        // Animation
        if (enemyEl) enemyEl.classList.add('enemy-attack');
        
        setTimeout(() => {
            if (enemyEl) enemyEl.classList.remove('enemy-attack');
            
            // Damage Player
            const finalDmg = enemy.power;
            state.player.hp -= finalDmg;
            document.body.classList.add('damaged');
            triggerScreenShake(40);
            
            setTimeout(() => document.body.classList.remove('damaged'), 300);
            
            if (state.player.hp <= 0) gameOver();
            renderUI();
        }, 200);
    };

    const triggerScreenShake = (intensity) => {
        const container = document.getElementById('game-container');
        container.style.transform = `translate(${(Math.random()-0.5)*intensity}px, ${(Math.random()-0.5)*intensity}px)`;
        setTimeout(() => container.style.transform = 'translate(0,0)', 50);
    };

    const renderUI = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        document.getElementById('player-hp').style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        document.getElementById('enemy-hp').style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
        document.getElementById('momentum-fill').style.width = `${state.player.momentum}%`;
        document.getElementById('momentum-text').innerText = `MOMENTUM x${Math.floor(state.player.momentum / 10)}`;
    };

    const log = (msg) => {
        const logEl = document.getElementById('combat-log');
        if (logEl) logEl.innerText = msg;
    };

    const gameOver = () => {
        state.gameActive = false;
        log("CRITICAL FAILURE: VILTRUMITE CONDITION LOST.");
        setTimeout(() => location.reload(), 3000);
    };

    const gameLoop = () => {
        if (state.gameActive) {
            // Passive Momentum Decay
            if (!state.isAttacking && state.player.momentum > 0) {
                state.player.momentum -= 0.05;
            }

            // Enemy Attack Check
            const now = Date.now();
            const enemy = state.enemies[state.currentTargetIdx];
            if (now - state.player.lastDamage >= enemy.attackRate) {
                enemyAttack();
                state.player.lastDamage = now;
            }
        }
        requestAnimationFrame(gameLoop);
    };

    return { init };
})();

window.onload = Fighter.init;
