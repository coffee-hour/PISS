/**
 * Sovereign v3.3.1: Attack & Offset Fix
 * Fixed click listener registration and stick-figure leg alignment.
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
        lastArmUsed: 'right'
    };

    const roster = [
        { id: 'sequid', name: 'SEQUID HOST', class: 'sequid', weight: 1, hp: 120, power: 8 },
        { id: 'flaxan', name: 'FLAXAN SCOUT', class: 'flaxan', weight: 1, hp: 150, power: 10 },
        { id: 'duplikate', name: 'DUPLI-KATE', class: 'duplikate', weight: 1, hp: 140, power: 9 },
        { id: 'shrinkingrae', name: 'SHRINKING RAE', class: 'shrinkingrae', weight: 1, hp: 130, power: 8 },
        { id: 'rexsplode', name: 'REX SPLODE', class: 'rexsplode', weight: 2, hp: 300, power: 15 },
        { id: 'atomeve', name: 'ATOM EVE', class: 'atomeve', weight: 2, hp: 350, power: 16 },
        { id: 'robot', name: 'ROBOT', class: 'robot', weight: 3, hp: 700, power: 25 },
        { id: 'monstergirl', name: 'MONSTER GIRL', class: 'monstergirl', weight: 3, hp: 800, power: 28 },
        { id: 'battlebeast', name: 'BATTLE BEAST', class: 'battlebeast', weight: 5, hp: 4000, power: 45 },
        { id: 'omniman', name: 'OMNI-MAN', class: 'omniman', weight: 10, hp: 20000, power: 90 },
        { id: 'thragg', name: 'GRAND REGENT THRAGG', class: 'thragg', weight: 10, hp: 25000, power: 100 }
    ];

    const augmentations = [
        { id: 'str', name: 'Pure Strength', desc: 'Punch Output +50%', apply: () => state.player.strength += 0.5 },
        { id: 'hp', name: 'Imperial Vitality', desc: 'Full Heal & +50 Max HP', apply: () => { state.player.maxHp += 50; state.player.hp = state.player.maxHp; } },
        { id: 'spd', name: 'Viltrumite Speed', desc: 'Enemy Attack Delay +15%', apply: () => state.player.speed *= 1.15 },
        { id: 'luck', name: 'Combat Precision', desc: 'Critical Strike Chance +10%', apply: () => state.player.luck += 0.1 }
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
        console.log("Sovereign v3.3.1: Attack & Offset Repair Live.");
    };

    const resizeCanvas = () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } };

    const setupListeners = () => {
        // REPAIR: Ensuring interaction layer catch all clicks globally for centering consistency
        const layer = document.getElementById('interaction-layer');
        if (layer) {
            layer.addEventListener('mousedown', (e) => {
                if (!state.run.active || state.run.choicesPending) return;
                const side = state.lastArmUsed === 'left' ? 'right' : 'left';
                executePunch(side, e.clientX, e.clientY);
            });
        }

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
        const tier = state.run.tier;
        let minWeight = Math.max(1, Math.floor(tier / 2));
        let maxWeight = Math.min(10, tier + 1);
        
        const pool = roster.filter(r => r.weight >= minWeight && r.weight <= maxWeight);
        const base = pool[Math.floor(Math.random() * pool.length)] || roster[0];
        const scaling = 1 + (state.run.kills * 0.12);
        
        state.currentTarget = {
            ...base,
            hp: Math.floor(base.hp * scaling),
            maxHp: Math.floor(base.hp * scaling),
            attackRate: 3500 / (1 + (tier * 0.1)) / state.player.speed
        };

        const char = document.getElementById('enemy-character');
        const nameLabel = document.getElementById('enemy-name');
        if (char) { char.className = `enemy-character ${state.currentTarget.class}`; }
        if (nameLabel) nameLabel.innerText = `TARGET: ${state.currentTarget.name}`;
        
        renderUI();
    };

    const executePunch = (side, x, y) => {
        if (state.isAttacking) return;
        state.isAttacking = true;
        state.lastArmUsed = side;
        const arm = document.querySelector(`.arm-${side}`);
        if (arm) arm.style.transform = `translateY(-350px) rotate(${side === 'left' ? 25 : -25}deg) scale(1.15)`;
        
        setTimeout(() => {
            handleImpact(x, y);
            setTimeout(() => {
                if (arm) arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 15 : -15}deg)`;
                state.isAttacking = false;
            }, 60);
        }, 80);
    };

    const handleImpact = (x, y) => {
        const enemy = state.currentTarget;
        const enemyEl = document.getElementById('enemy-character');
        triggerShake(15);
        
        const bloodVolume = 10 + Math.floor((1 - (enemy.hp / enemy.maxHp)) * 50);
        spawnBlood(x, y, bloodVolume);

        if (enemyEl) { enemyEl.classList.remove('hit-active'); void enemyEl.offsetWidth; enemyEl.classList.add('hit-active'); }
        
        let dmg = (10 + Math.floor(state.player.momentum / 5)) * state.player.strength;
        if (Math.random() < state.player.luck) { dmg *= 3; log("CRITICAL BLOW!"); }
        
        enemy.hp -= dmg;
        state.player.momentum = Math.min(100, state.player.momentum + 6);
        if (enemy.hp <= 0) defeatEnemy();
        renderUI();
    };

    const spawnBlood = (x, y, volume) => {
        for (let i = 0; i < volume; i++) {
            bloodParticles.push({
                x, y, vx: (Math.random() - 0.5) * 35, vy: (Math.random() - 0.5) * 35,
                life: 1.0, size: Math.random() * 8 + 2
            });
        }
    };

    const updateParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bloodParticles = bloodParticles.filter(p => p.life > 0);
        bloodParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.8; p.life -= 0.035;
            ctx.fillStyle = `rgba(185, 28, 28, ${p.life})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        });
    };

    const defeatEnemy = () => {
        state.run.kills++;
        state.run.tier = Math.floor(state.run.kills / 2) + 1;
        state.player.momentum = Math.min(100, state.player.momentum + 50);
        if (state.run.kills % 2 === 0) presentChoices();
        else spawnNewEnemy();
    };

    const presentChoices = () => {
        state.run.choicesPending = true;
        const overlay = document.getElementById('choice-overlay');
        const list = document.getElementById('choice-list');
        if (overlay) overlay.classList.remove('hidden');
        
        const shuffled = [...augmentations].sort(() => 0.5 - Math.random()).slice(0, 3);
        if (list) {
            list.innerHTML = shuffled.map(a => `
                <div class="augment-btn" onclick="Fighter.applyAugment('${a.id}')">
                    <div class="augment-info">
                        <b>${a.name}</b>
                        <span>${a.desc}</span>
                    </div>
                </div>
            `).join('');
        }
    };

    const applyAugment = (id) => {
        const aug = augmentations.find(a => a.id === id);
        if (aug) aug.apply();
        state.run.choicesPending = false;
        const overlay = document.getElementById('choice-overlay');
        if (overlay) overlay.classList.add('hidden');
        spawnNewEnemy();
    };

    const enemyAttack = () => {
        if (!state.run.active || state.run.choicesPending) return;
        const enemyEl = document.getElementById('enemy-character');
        if (enemyEl) enemyEl.classList.add('enemy-attack');
        setTimeout(() => {
            if (enemyEl) enemyEl.classList.remove('enemy-attack');
            state.player.hp -= state.currentTarget.power * (1 + state.run.tier * 0.15);
            triggerShake(40);
            if (state.player.hp <= 0) die();
            renderUI();
        }, 200);
    };

    const die = () => { state.run.active = false; const d = document.getElementById('death-overlay'); if (d) d.classList.remove('hidden'); };
    const resetRun = () => { location.reload(); };

    const renderUI = () => {
        const php = document.getElementById('player-hp');
        const ehp = document.getElementById('enemy-hp');
        const d = document.getElementById('enemies-defeated');
        const m = document.getElementById('momentum-fill');
        const t = document.getElementById('run-tier');
        const mod = document.getElementById('run-modifier');

        if (php) php.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        if (ehp && state.currentTarget) ehp.style.width = `${Math.max(0, (state.currentTarget.hp / state.currentTarget.maxHp) * 100)}%`;
        if (d) d.innerText = state.run.kills;
        if (m) m.style.width = `${state.player.momentum}%`;
        if (t) t.innerText = state.run.tier;
        if (mod) mod.innerText = `STR +${((state.player.strength - 1) * 100).toFixed(0)}%`;
    };

    const triggerShake = (i) => {
        const c = document.getElementById('game-container');
        if (c) c.style.transform = `translate(${(Math.random()-0.5)*i}px, ${(Math.random()-0.5)*i}px)`;
        setTimeout(() => { if (c) c.style.transform = 'translate(0,0)'; }, 50);
    };

    const log = (msg) => { const l = document.getElementById('combat-log-overlay'); if (l) l.innerText = msg; };

    const gameLoop = () => {
        updateParticles();
        if (state.run.active && !state.run.choicesPending) {
            if (!state.isAttacking && state.player.momentum > 0) state.player.momentum -= 0.15;
            const now = Date.now();
            if (state.currentTarget && now - state.lastAttackTime >= state.currentTarget.attackRate) {
                enemyAttack(); state.lastAttackTime = now;
            }
        }
        requestAnimationFrame(gameLoop);
    };

    return { init, applyAugment, resetRun };
})();

window.onload = Fighter.init;
