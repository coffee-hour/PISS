/**
 * Sovereign v3.2.2: HUD Restructure & Combo Flow
 * Single-line header HUD, automatic alternating arms, and Rogue-like integrity.
 */

const Fighter = (() => {
    let state = {
        player: { 
            hp: 100, maxHp: 100, momentum: 0, 
            strength: 1, speed: 1, luck: 0.1
        },
        run: {
            kills: 0,
            tier: 1,
            active: true,
            choicesPending: false
        },
        currentTarget: null,
        isAttacking: false,
        lastAttackTime: Date.now(),
        lastArmUsed: 'right' // Tracks for automatic alternating
    };

    const enemyPool = [
        { id: 'sequid', name: 'SEQUID SWARM', hp: 150, class: 'sequid', attackRate: 4000, power: 8 },
        { id: 'flaxan', name: 'FLAXAN COMMANDER', hp: 600, class: 'flaxan', attackRate: 3500, power: 15 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', hp: 2500, class: 'thragg', attackRate: 3000, power: 25 },
        { id: 'omniman', name: 'OMNI-MAN', hp: 8000, class: 'omniman', attackRate: 2500, power: 40 }
    ];

    const augmentations = [
        { id: 'str', name: 'PURE STRENGTH', desc: '+50% Damage', apply: () => state.player.strength += 0.5 },
        { id: 'hp', name: 'EMPIRE VITALITY', desc: '+50 Max HP', apply: () => { state.player.maxHp += 50; state.player.hp = state.player.maxHp; } },
        { id: 'spd', name: 'VILTRUMITE SPEED', desc: '-15% Enemy Attack Speed', apply: () => state.player.speed *= 1.15 },
        { id: 'luck', name: 'COMBAT PRECISION', desc: '+10% Crit Chance', apply: () => state.player.luck += 0.1 }
    ];

    let bloodParticles = [];
    const canvas = document.getElementById('blood-canvas');
    const ctx = canvas?.getContext('2d');

    const init = () => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        setupListeners();
        spawnNewEnemy();
        gameLoop();
        console.log("Sovereign HUD Refresh v3.2.2 Initialized.");
    };

    const resizeCanvas = () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        layer.addEventListener('mousedown', (e) => {
            if (!state.run.active || state.run.choicesPending) return;
            // Alternating arm logic
            const side = state.lastArmUsed === 'left' ? 'right' : 'left';
            executePunch(side, e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (state.run.choicesPending) return;
            const x = (e.clientX / window.innerWidth - 0.5) * 8;
            const y = (e.clientY / window.innerHeight - 0.5) * 8;
            const arena = document.getElementById('arena');
            const arms = document.getElementById('arms-container');
            if (arena) arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
            if (arms) arms.style.transform = `translateX(${x * 2}px) translateY(${y * 2}px)`;
        });
    };

    const spawnNewEnemy = () => {
        const base = enemyPool[Math.min(enemyPool.length - 1, Math.floor(state.run.kills / 2))];
        const scaling = 1 + (state.run.kills * 0.2);
        
        state.currentTarget = {
            ...base,
            hp: Math.floor(base.hp * scaling),
            maxHp: Math.floor(base.hp * scaling),
            attackRate: base.attackRate / (state.player.speed)
        };

        const char = document.getElementById('enemy-character');
        const nameLabel = document.getElementById('enemy-name');
        if (char) { char.className = `enemy-character ${state.currentTarget.class}`; char.style.opacity = '1'; }
        if (nameLabel) nameLabel.innerText = `TARGET: ${state.currentTarget.name}`;
        
        log(`NEXT TARGET DETECTED: ${state.currentTarget.name}`);
        renderUI();
    };

    const executePunch = (side, x, y) => {
        if (state.isAttacking) return;
        state.isAttacking = true;
        state.lastArmUsed = side;

        const arm = document.querySelector(`.arm-${side}`);
        arm.style.transform = `translateY(-350px) rotate(${side === 'left' ? 25 : -25}deg) scale(1.1)`;
        
        setTimeout(() => {
            handleImpact(x, y);
            setTimeout(() => {
                arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 15 : -15}deg)`;
                state.isAttacking = false;
            }, 60);
        }, 80);
    };

    const handleImpact = (x, y) => {
        const enemy = state.currentTarget;
        const enemyEl = document.getElementById('enemy-character');
        
        triggerShake(20);
        spawnBlood(x, y);
        if (enemyEl) { enemyEl.classList.remove('hit-active'); void enemyEl.offsetWidth; enemyEl.classList.add('hit-active'); }

        let dmg = (10 + Math.floor(state.player.momentum / 5)) * state.player.strength;
        if (Math.random() < state.player.luck) { dmg *= 3; log("CRITICAL IMPACT!"); }
        
        enemy.hp -= dmg;
        state.player.momentum = Math.min(100, state.player.momentum + 5);

        if (enemy.hp <= 0) defeatEnemy();
        renderUI();
    };

    const spawnBlood = (x, y) => {
        for (let i = 0; i < 12; i++) {
            bloodParticles.push({
                x, y, vx: (Math.random() - 0.5) * 25, vy: (Math.random() - 0.5) * 25,
                life: 1.0, size: Math.random() * 6 + 2
            });
        }
    };

    const updateParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bloodParticles = bloodParticles.filter(p => p.life > 0);
        bloodParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.6; p.life -= 0.025;
            ctx.fillStyle = `rgba(185, 28, 28, ${p.life})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        });
    };

    const defeatEnemy = () => {
        state.run.kills++;
        state.run.tier = Math.floor(state.run.kills / 2) + 1;
        state.player.momentum = Math.min(100, state.player.momentum + 50);
        
        if (state.run.kills % 2 === 0) {
            presentChoices();
        } else {
            spawnNewEnemy();
        }
    };

    const presentChoices = () => {
        state.run.choicesPending = true;
        const overlay = document.getElementById('choice-overlay');
        const list = document.getElementById('choice-list');
        overlay.classList.remove('hidden');
        
        const shuffled = [...augmentations].sort(() => 0.5 - Math.random()).slice(0, 3);
        list.innerHTML = shuffled.map(a => `
            <div class="choice-card" onclick="Fighter.applyAugment('${a.id}')">
                <b>${a.name}</b>
                <p>${a.desc}</p>
            </div>
        `).join('');
    };

    const applyAugment = (id) => {
        const augment = augmentations.find(a => a.id === id);
        augment.apply();
        state.run.choicesPending = false;
        document.getElementById('choice-overlay').classList.add('hidden');
        log(`AUGMENTATION APPLIED: ${augment.name}`);
        spawnNewEnemy();
    };

    const enemyAttack = () => {
        if (!state.run.active || state.run.choicesPending) return;
        const enemyEl = document.getElementById('enemy-character');
        if (enemyEl) enemyEl.classList.add('enemy-attack');
        
        setTimeout(() => {
            if (enemyEl) enemyEl.classList.remove('enemy-attack');
            state.player.hp -= state.currentTarget.power * (1 + state.run.kills * 0.1);
            triggerShake(40);
            if (state.player.hp <= 0) die();
            renderUI();
        }, 200);
    };

    const die = () => {
        state.run.active = false;
        document.getElementById('death-overlay').classList.remove('hidden');
        log("CONQUEST TERMINATED.");
    };

    const resetRun = () => { location.reload(); };

    const renderUI = () => {
        const playerHpEl = document.getElementById('player-hp');
        if (playerHpEl) playerHpEl.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        
        if (state.currentTarget) {
            const enemyHpEl = document.getElementById('enemy-hp');
            if (enemyHpEl) enemyHpEl.style.width = `${Math.max(0, (state.currentTarget.hp / state.currentTarget.maxHp) * 100)}%`;
        }
        
        const defeatedEl = document.getElementById('enemies-defeated');
        if (defeatedEl) defeatedEl.innerText = state.run.kills;
        
        const momentumEl = document.getElementById('momentum-fill');
        if (momentumEl) momentumEl.style.width = `${state.player.momentum}%`;
        
        const tierEl = document.getElementById('run-tier');
        if (tierEl) tierEl.innerText = state.run.tier;
        
        const modEl = document.getElementById('run-modifier');
        if (modEl) modEl.innerText = `STR +${((state.player.strength - 1) * 100).toFixed(0)}%`;
    };

    const triggerShake = (i) => {
        const c = document.getElementById('game-container');
        c.style.transform = `translate(${(Math.random()-0.5)*i}px, ${(Math.random()-0.5)*i}px)`;
        setTimeout(() => c.style.transform = 'translate(0,0)', 50);
    };

    const log = (msg) => { 
        const logEl = document.getElementById('combat-log-overlay');
        if (logEl) logEl.innerText = msg;
    };

    const gameLoop = () => {
        updateParticles();
        if (state.run.active && !state.run.choicesPending) {
            if (!state.isAttacking && state.player.momentum > 0) state.player.momentum -= 0.1;
            const now = Date.now();
            if (state.currentTarget && now - state.lastAttackTime >= state.currentTarget.attackRate) {
                enemyAttack();
                state.lastAttackTime = now;
            }
        }
        requestAnimationFrame(gameLoop);
    };

    return { init, applyAugment, resetRun };
})();

window.onload = Fighter.init;
