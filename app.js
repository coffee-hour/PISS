/**
 * Sovereign v3.2.0: Progression
 * Blood Particles, Shop System, Leveling Loop, and Recognizable Sprites.
 */

const Fighter = (() => {
    let state = {
        player: { 
            hp: 100, maxHp: 100, momentum: 0, essence: 0,
            strength: 1, speed: 1, crit: 0.1
        },
        enemies: [
            { id: 'sequid', name: 'SEQUID SWARM', hp: 200, maxHp: 200, class: 'sequid', attackRate: 4000, power: 5, reward: 50 },
            { id: 'flaxan', name: 'FLAXAN COMMANDER', hp: 800, maxHp: 800, class: 'flaxan', attackRate: 3500, power: 12, reward: 150 },
            { id: 'thragg', name: 'GRAND REGENT THRAGG', hp: 3000, maxHp: 3000, class: 'thragg', attackRate: 3000, power: 25, reward: 500 },
            { id: 'omniman', name: 'OMNI-MAN', hp: 10000, maxHp: 10000, class: 'omniman', attackRate: 2500, power: 45, reward: 2000 }
        ],
        level: 1,
        currentTargetIdx: 0,
        isAttacking: false,
        gameActive: true,
        lastAttackTime: Date.now(),
        shopOpen: false
    };

    const shopItems = [
        { id: 'str', name: "Omni-Strength", desc: "x1.5 Punch Damage", cost: 100, icon: 'dumbbell' },
        { id: 'spd', name: "Viltrumite Speed", desc: "-10% Enemy Attack Window", cost: 250, icon: 'zap' },
        { id: 'hp', name: "Imperial Fortitude", desc: "+50 Max HP", cost: 150, icon: 'heart' }
    ];

    let bloodParticles = [];
    const canvas = document.getElementById('blood-canvas');
    const ctx = canvas?.getContext('2d');

    const init = () => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        setupListeners();
        renderTarget();
        renderShop();
        gameLoop();
        lucide.createIcons();
    };

    const resizeCanvas = () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } };

    const setupListeners = () => {
        const layer = document.getElementById('interaction-layer');
        layer.addEventListener('mousedown', (e) => {
            if (!state.gameActive || state.shopOpen) return;
            const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
            executePunch(side, e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (state.shopOpen) return;
            const x = (e.clientX / window.innerWidth - 0.5) * 10;
            const y = (e.clientY / window.innerHeight - 0.5) * 10;
            const arena = document.getElementById('arena');
            if (arena) arena.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
        });
    };

    const executePunch = (side, x, y) => {
        if (state.isAttacking) return;
        state.isAttacking = true;

        const arm = document.querySelector(`.arm-${side}`);
        arm.style.transform = `translateY(-300px) rotate(${side === 'left' ? 25 : -25}deg) scale(1.2)`;
        
        setTimeout(() => {
            handleImpact(x, y);
            setTimeout(() => {
                arm.style.transform = `translateY(150px) rotate(${side === 'left' ? 12 : -12}deg)`;
                state.isAttacking = false;
            }, 50);
        }, 100);
    };

    const handleImpact = (x, y) => {
        const enemy = state.enemies[state.currentTargetIdx];
        const enemyEl = document.getElementById('enemy-character');
        
        // FX
        triggerShake(20);
        spawnBlood(x, y);
        if (enemyEl) { enemyEl.classList.remove('hit-active'); void enemyEl.offsetWidth; enemyEl.classList.add('hit-active'); }

        // Damage
        let dmg = (10 + Math.floor(state.player.momentum / 5)) * state.player.strength;
        if (Math.random() < state.player.crit) dmg *= 3;
        
        enemy.hp -= dmg;
        state.player.momentum = Math.min(100, state.player.momentum + 5);

        if (enemy.hp <= 0) defeatEnemy();
        renderUI();
    };

    const spawnBlood = (x, y) => {
        for (let i = 0; i < 15; i++) {
            bloodParticles.push({
                x, y,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1.0,
                size: Math.random() * 8 + 2
            });
        }
    };

    const updateParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bloodParticles = bloodParticles.filter(p => p.life > 0);
        bloodParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.life -= 0.02;
            ctx.fillStyle = `rgba(185, 28, 28, ${p.life})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        });
    };

    const defeatEnemy = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        state.player.essence += enemy.reward;
        log(`TARGET EXTERMINATED: +${enemy.reward} ESSENCE`);
        
        state.currentTargetIdx = (state.currentTargetIdx + 1) % state.enemies.length;
        state.level++;
        
        const character = document.getElementById('enemy-character');
        if (character) character.style.opacity = '0';
        
        setTimeout(() => {
            const next = state.enemies[state.currentTargetIdx];
            next.hp = next.maxHp * (1 + (state.level * 0.1)); // Dynamic scaling
            renderTarget();
        }, 1000);
    };

    const enemyAttack = () => {
        if (!state.gameActive || state.shopOpen) return;
        const enemyEl = document.getElementById('enemy-character');
        if (enemyEl) enemyEl.classList.add('enemy-attack');
        
        setTimeout(() => {
            if (enemyEl) enemyEl.classList.remove('enemy-attack');
            const enemy = state.enemies[state.currentTargetIdx];
            state.player.hp -= enemy.power;
            triggerShake(40);
            if (state.player.hp <= 0) showDeath();
            renderUI();
        }, 200);
    };

    const renderTarget = () => {
        const enemy = state.enemies[state.currentTargetIdx];
        const character = document.getElementById('enemy-character');
        const nameLabel = document.getElementById('enemy-name');
        if (character) { character.className = `enemy-character ${enemy.class}`; character.style.opacity = '1'; }
        if (nameLabel) nameLabel.innerText = `TARGET: ${enemy.name}`;
        renderUI();
    };

    const renderUI = () => {
        document.getElementById('player-hp').style.width = `${(state.player.hp / state.player.maxHp) * 100}%`;
        const enemy = state.enemies[state.currentTargetIdx];
        document.getElementById('enemy-hp').style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
        document.getElementById('essence-count').innerText = Math.floor(state.player.essence);
        document.getElementById('momentum-fill').style.width = `${state.player.momentum}%`;
        document.getElementById('level-num').innerText = state.level;
    };

    const toggleShop = () => {
        state.shopOpen = !state.shopOpen;
        document.getElementById('shop-overlay').classList.toggle('hidden', !state.shopOpen);
        if (state.shopOpen) renderShop();
    };

    const renderShop = () => {
        const list = document.getElementById('shop-list');
        if (!list) return;
        list.innerHTML = shopItems.map(item => `
            <div class="shop-item">
                <div class="item-info">
                    <strong>${item.name}</strong><br><small>${item.desc}</small>
                </div>
                <button class="buy-btn" ${state.player.essence < item.cost ? 'disabled' : ''} onclick="Fighter.buyAbility('${item.id}')">
                    ${item.cost} ESSENCE
                </button>
            </div>
        `).join('');
    };

    const buyAbility = (id) => {
        const item = shopItems.find(x => x.id === id);
        if (state.player.essence >= item.cost) {
            state.player.essence -= item.cost;
            if (id === 'str') state.player.strength += 0.5;
            if (id === 'spd') state.enemies.forEach(e => e.attackRate *= 0.95);
            if (id === 'hp') { state.player.maxHp += 50; state.player.hp += 50; }
            item.cost = Math.floor(item.cost * 1.5);
            renderShop();
            renderUI();
            log(`ABILITY ACQUIRED: ${item.name}`);
        }
    };

    const showDeath = () => {
        state.gameActive = false;
        document.getElementById('death-overlay').classList.remove('hidden');
    };

    const triggerShake = (i) => {
        const c = document.getElementById('game-container');
        c.style.transform = `translate(${(Math.random()-0.5)*i}px, ${(Math.random()-0.5)*i}px)`;
        setTimeout(() => c.style.transform = 'translate(0,0)', 50);
    };

    const log = (msg) => { document.getElementById('combat-log').innerText = msg; };

    const gameLoop = () => {
        updateParticles();
        if (state.gameActive && !state.shopOpen) {
            if (!state.isAttacking && state.player.momentum > 0) state.player.momentum -= 0.1;
            const now = Date.now();
            const enemy = state.enemies[state.currentTargetIdx];
            if (now - state.lastAttackTime >= enemy.attackRate) {
                enemyAttack();
                state.lastAttackTime = now;
            }
        }
        requestAnimationFrame(gameLoop);
    };

    return { init, toggleShop, buyAbility };
})();

window.onload = Fighter.init;
