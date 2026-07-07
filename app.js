/**
 * Sovereign v4.0.0: Invincible-Hot
 * Time-dilation engine: Time moves only when you move or strike.
 */

const Fighter = (() => {
    let state = {
        player: { hp: 100, maxHp: 100, strength: 1, speed: 1, luck: 0.1 },
        run: { kills: 0, tier: 1, active: true, choicesPending: false },
        currentTarget: null,
        isAttacking: false,
        lastArmUsed: 'right',
        timeDilation: 0, // 0 to 1
        lastMouseMove: Date.now()
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
        { id: 'spd', name: 'Viltrumite Reflex', desc: 'Time Flow Dilation +20%', apply: () => state.player.speed *= 1.2 }
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
        console.log("v4.0.0: TIME ONLY MOVES WHEN YOU MOVE.");
    };

    const resizeCanvas = () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        
        layer.addEventListener('mousedown', (e) => {
            if (!state.run.active || state.run.choicesPending) return;
            state.timeDilation = 1.0; // Instant time burst on strike
            const side = state.lastArmUsed === 'left' ? 'right' : 'left';
            executePunch(side, e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (state.run.choicesPending) return;
            state.timeDilation = 1.0;
            state.lastMouseMove = Date.now();
            
            // Parallax
            const x = (e.clientX / window.innerWidth - 0.5) * 15;
            const y = (e.clientY / window.innerHeight - 0.5) * 15;
            const arena = document.getElementById('arena');
            const arms = document.getElementById('arms-container');
            if (arena) arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
            if (arms) arms.style.transform = `translateX(${x * 2}px) translateY(${y * 2}px)`;
        });
    };

    const spawnNewEnemy = () => {
        const tier = state.run.tier;
        const pool = roster.filter(r => r.weight >= Math.max(1, tier-2) && r.weight <= tier + 1);
        const base = pool[Math.floor(Math.random() * pool.length)] || roster[0];
        
        state.currentTarget = {
            ...base,
            hp: Math.floor(base.hp * (1 + state.run.kills * 0.1)),
            maxHp: Math.floor(base.hp * (1 + state.run.kills * 0.1)),
            attackProgress: 0
        };

        const char = document.getElementById('enemy-character');
        const nameLabel = document.getElementById('enemy-name');
        if (char) char.className = `enemy-character ${state.currentTarget.class}`;
        if (nameLabel) nameLabel.innerText = state.currentTarget.name;
        
        renderUI();
    };

    const executePunch = (side, x, y) => {
        if (state.isAttacking) return;
        state.isAttacking = true;
        state.lastArmUsed = side;
        const arm = document.querySelector(`.arm-${side}`);
        if (arm) arm.style.transform = `translateY(-350px) rotate(${side === 'left' ? 25 : -25}deg) scale(1.1)`;
        
        setTimeout(() => {
            handleImpact(x, y);
            setTimeout(() => {
                if (arm) arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 15 : -15}deg)`;
                state.isAttacking = false;
            }, 50);
        }, 50);
    };

    const handleImpact = (x, y) => {
        const enemy = state.currentTarget;
        const enemyEl = document.getElementById('enemy-character');
        
        const bloodVolume = 5 + Math.floor((1 - (enemy.hp / enemy.maxHp)) * 40);
        spawnBlood(x, y, bloodVolume);

        if (enemyEl) { 
            enemyEl.classList.remove('hit-active'); 
            void enemyEl.offsetWidth; 
            enemyEl.classList.add('hit-active'); 
        }
        
        enemy.hp -= 15 * state.player.strength;
        if (enemy.hp <= 0) defeatEnemy();
        renderUI();
    };

    const spawnBlood = (x, y, volume) => {
        for (let i = 0; i < volume; i++) {
            bloodParticles.push({
                x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
                life: 1.0, size: Math.random() * 10 + 2
            });
        }
    };

    const updateParticles = (dt) => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bloodParticles = bloodParticles.filter(p => p.life > 0);
        bloodParticles.forEach(p => {
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.8 * dt; p.life -= 0.02 * dt;
            ctx.fillStyle = `rgba(185, 28, 28, ${p.life})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        });
    };

    const defeatEnemy = () => {
        state.run.kills++;
        state.run.tier = Math.floor(state.run.kills / 2) + 1;
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
                    <b>${a.name}</b>
                    <span>${a.desc}</span>
                </div>
            `).join('');
        }
    };

    const applyAugment = (id) => {
        const aug = augmentations.find(a => a.id === id);
        if (aug) aug.apply();
        state.run.choicesPending = false;
        document.getElementById('choice-overlay').classList.add('hidden');
        spawnNewEnemy();
    };

    const gameLoop = () => {
        const now = Date.now();
        
        // Time Dilation Logic
        if (now - state.lastMouseMove > 100 && !state.isAttacking) {
            state.timeDilation = Math.max(0, state.timeDilation - 0.05);
        }

        const dt = state.timeDilation;
        const timeStatus = document.getElementById('time-status');
        if (timeStatus) {
            timeStatus.innerText = dt > 0.1 ? "TIME MOVING" : "TIME FROZEN";
            timeStatus.className = dt > 0.1 ? "time-active" : "time-frozen";
        }

        updateParticles(dt);

        if (state.run.active && !state.run.choicesPending && state.currentTarget) {
            // Enemy Attack Progress moves with Time
            state.currentTarget.attackProgress += (0.01 * state.run.tier * dt);
            if (state.currentTarget.attackProgress >= 1.0) {
                state.player.hp -= state.currentTarget.power;
                state.currentTarget.attackProgress = 0;
                if (state.player.hp <= 0) die();
            }
        }

        renderUI();
        requestAnimationFrame(gameLoop);
    };

    const die = () => { state.run.active = false; document.getElementById('death-overlay').classList.remove('hidden'); };
    const resetRun = () => { location.reload(); };

    const renderUI = () => {
        const php = document.getElementById('player-hp');
        const ehp = document.getElementById('enemy-hp');
        if (php) php.style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        if (ehp && state.currentTarget) ehp.style.width = `${Math.max(0, (state.currentTarget.hp / state.currentTarget.maxHp) * 100)}%`;
        
        const kills = document.getElementById('enemies-defeated');
        const tier = document.getElementById('run-tier');
        if (kills) kills.innerText = state.run.kills;
        if (tier) tier.innerText = state.run.tier;
    };

    return { init, applyAugment, resetRun };
})();

window.onload = Fighter.init;
