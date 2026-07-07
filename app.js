/**
 * Sovereign: Viltrumite Combat (v2.7.0)
 * Fist Cursor, Retaliatory Damage, Geometric Bosses, and Dynamic Scaling.
 */

const Sovereign = (() => {
    let state = {
        treasury: 100,
        upgrades: {},
        attributes: { strength: 0, durability: 0, speed: 0 },
        totalGoldEarned: 0,
        lastUpdate: Date.now(),
        comboValue: 0,
        furyActive: false,
        furyTimer: 0,
        bossIndex: 0,
        bossHealth: 1000,
        // Player Health
        playerHP: 100,
        lastDamageTime: Date.now()
    };

    const config = {
        bosses: [
            { name: "SEQUID SWARM", health: 1000, reward: 500, class: 'sprite-sequid' },
            { name: "FLAXAN INVASION", health: 10000, reward: 5000, class: 'sprite-flaxan' },
            { name: "DOC SEISMIC", health: 100000, reward: 50000, class: 'sprite-seismic' },
            { name: "THRAGG", health: 1000000, reward: 500000, class: 'sprite-thragg' },
            { name: "OMNI-MAN", health: 10000000, reward: 5000000, class: 'sprite-omniman' }
        ],
        upgrades: [
            { id: 'militia', name: "Viltrumite Conscripts", desc: "+0.1 Essence/s", baseCost: 15, passive: 0.1, click: 0, icon: 'users' },
            { id: 'scouts', name: "Sky Scouts", desc: "+1 per Strike", baseCost: 50, passive: 0, click: 1, icon: 'eye' },
            { id: 'spearmen', name: "Iron Guardians", desc: "+1 Essence/s", baseCost: 100, passive: 1, click: 0, icon: 'shield' },
            { id: 'trebuchet', name: "Orbital Battery", desc: "+5 per Strike", baseCost: 500, passive: 0, click: 5, icon: 'target' },
            { id: 'v10', name: "Praetorian Guard", desc: "+500 Essence/s", baseCost: 120000, passive: 500, click: 0, icon: 'shield-alert' },
            { id: 'v25', name: "Empire Overlord", desc: "+10B Essence/s", baseCost: 25000000000000, passive: 10000000000, click: 0, icon: 'castle' }
        ],
        attributes: [
            { id: 'strength', name: "Strength", desc: "x2.0 Strike Damage", baseCost: 5000, icon: 'dumbbell' },
            { id: 'durability', name: "Durability", desc: "+25 Max HP & -10% Dmg Taken", baseCost: 10000, icon: 'shield-check' },
            { id: 'speed', name: "Speed", desc: "+15% Passive & Combo Gain", baseCost: 15000, icon: 'zap' }
        ]
    };

    const initCursor = () => {
        const cursor = document.getElementById('custom-cursor');
        if (!cursor) return;
        const wrapper = cursor.querySelector('.fist-wrapper');
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`;
        });
        document.addEventListener('mousedown', () => {
            if (wrapper) { wrapper.classList.add('fist-strike'); setTimeout(() => wrapper.classList.remove('fist-strike'), 100); }
        });
    };

    const switchTab = (tabId) => {
        document.querySelectorAll('.shop-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const panel = document.getElementById(`shop-${tabId}`);
        if (panel) panel.classList.add('active');
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
        if (activeBtn) activeBtn.classList.add('active');
    };

    const init = () => {
        load();
        config.upgrades.forEach(u => { if (state.upgrades[u.id] === undefined) state.upgrades[u.id] = 0; });
        initCursor();
        render();
        startLoop();
        lucide.createIcons();
    };

    const startLoop = () => {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - state.lastUpdate) / 1000;
            state.lastUpdate = now;
            updateState(delta);
        }, 100);
        setInterval(save, 5000);
    };

    const updateState = (delta) => {
        // Passive Income
        let speedMult = Math.pow(1.15, state.attributes.speed);
        const passiveRate = calculatePassiveRate() * speedMult;
        state.treasury += passiveRate * delta;
        state.totalGoldEarned += passiveRate * delta;

        // Combo Decay
        if (!state.furyActive) state.comboValue = Math.max(0, state.comboValue - 1.2 * delta);
        else { state.furyTimer -= delta; if (state.furyTimer <= 0) deactivateFury(); }

        // Retaliatory Damage (Every 3 seconds)
        const now = Date.now();
        if (now - state.lastDamageTime >= 3000) {
            takeDamage();
            state.lastDamageTime = now;
        }

        renderUI();
    };

    const calculatePassiveRate = () => config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.passive), 0);

    const takeDamage = () => {
        const baseDamage = 10 * (1 + (state.bossIndex / 5));
        const durMult = Math.pow(0.9, state.attributes.durability);
        const finalDamage = baseDamage * durMult;
        state.playerHP -= finalDamage;
        triggerShake(5 + finalDamage);

        if (state.playerHP <= 0) {
            notify("CRITICAL CONDITION: XAVIER RECOVERING...");
            const penalty = state.treasury * 0.1;
            state.treasury -= penalty;
            state.playerHP = 100 + (state.attributes.durability * 25);
            // Reset current boss HP
            const boss = config.bosses[state.bossIndex % config.bosses.length];
            state.bossHealth = boss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        }
    };

    const handleInteraction = (e) => {
        let strMult = Math.pow(2, state.attributes.strength);
        let power = calculateClickPower() * strMult;
        
        const critChance = 0.1 + (state.comboValue / 50) + (state.furyActive ? 0.15 : 0);
        const isCrit = Math.random() < critChance;
        if (isCrit) power *= 5;

        state.treasury += power; state.totalGoldEarned += power;
        state.bossHealth -= power;

        const enemy = document.getElementById('enemy-sprite');
        if (enemy) { enemy.classList.remove('enemy-hit'); void enemy.offsetWidth; enemy.classList.add('enemy-hit'); }
        
        if (!state.furyActive) {
            let speedMult = Math.pow(1.15, state.attributes.speed);
            state.comboValue = Math.min(10, state.comboValue + (isCrit ? 0.8 : 0.4) * speedMult);
            if (state.comboValue >= 10) activateFury();
        }

        triggerShake(isCrit ? 20 : 2 + state.comboValue);
        spawnCombatNumber(isCrit ? `CRIT! +${Math.floor(power)}` : `+${Math.floor(power)}`, e.clientX, e.clientY, isCrit);
        
        if (state.bossHealth <= 0) defeatBoss();
        renderUI();
    };

    const calculateClickPower = () => 1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.click), 0);

    const defeatBoss = () => {
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        state.treasury += boss.reward;
        document.body.classList.add('flashing');
        setTimeout(() => document.body.classList.remove('flashing'), 100);
        
        state.bossIndex++;
        const nextBoss = config.bosses[state.bossIndex % config.bosses.length];
        state.bossHealth = nextBoss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        
        notify(`THREAT NEUTRALIZED: ${boss.name}.`);
        render(); // Update sprite
    };

    const triggerShake = (intensity) => {
        const app = document.getElementById('app');
        if (!app) return;
        const x = (Math.random() - 0.5) * intensity;
        const y = (Math.random() - 0.5) * intensity;
        app.style.transform = `translate(${x}px, ${y}px)`;
        setTimeout(() => app.style.transform = `translate(0, 0)`, 50);
    };

    const spawnCombatNumber = (text, x, y, crit) => {
        const container = document.getElementById('text-particle-container');
        if (!container) return;
        const p = document.createElement('div');
        p.className = `text-particle ${crit ? 'crit' : ''}`;
        p.innerText = text; p.style.left = `${x}px`; p.style.top = `${y}px`;
        const tx = (Math.random() - 0.5) * 200; const ty = -100 - Math.random() * 100;
        p.style.setProperty('--target-x', `${tx}px`); p.style.setProperty('--target-y', `${ty}px`);
        container.appendChild(p); setTimeout(() => p.remove(), 800);
    };

    const activateFury = () => { state.furyActive = true; state.furyTimer = 5; document.body.classList.add('fury-active'); notify("VILTRUMITE FURY!"); };
    const deactivateFury = () => { state.furyActive = false; state.comboValue = 0; document.body.classList.remove('fury-active'); };

    const buyUpgrade = (id) => {
        const u = config.upgrades.find(x => x.id === id);
        const cost = Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id] || 0));
        if (state.treasury >= cost) { state.treasury -= cost; state.upgrades[id]++; render(); }
    };

    const buyAttribute = (id) => {
        const attr = config.attributes.find(x => x.id === id);
        const cost = Math.floor(attr.baseCost * Math.pow(5, state.attributes[id]));
        if (state.treasury >= cost) {
            state.treasury -= cost; state.attributes[id]++;
            if (id === 'durability') state.playerHP += 25;
            notify(`${attr.name.toUpperCase()} AUGMENTED.`);
            render();
        }
    };

    const render = () => {
        const gContainer = document.getElementById('upgrade-container');
        const aContainer = document.getElementById('advancement-container');
        if (!gContainer || !aContainer) return;
        gContainer.innerHTML = '';
        config.upgrades.forEach(u => {
            const cost = Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id] || 0));
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.onclick = () => buyUpgrade(u.id);
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${u.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${u.name}</div><div class="upgrade-cost">${cost.toLocaleString()} Essence</div></div><div>${state.upgrades[u.id] || 0}</div>`;
            gContainer.appendChild(card);
        });
        aContainer.innerHTML = '';
        config.attributes.forEach(attr => {
            const cost = Math.floor(attr.baseCost * Math.pow(5, state.attributes[attr.id]));
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.onclick = () => buyAttribute(attr.id);
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${attr.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${attr.name}</div><div class="upgrade-desc">${attr.desc}</div><div class="upgrade-cost">${cost.toLocaleString()} Essence</div></div><div>${state.attributes[attr.id]}</div>`;
            aContainer.appendChild(card);
        });

        // Sprite Rendering
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        const visual = document.getElementById('enemy-visual');
        if (visual) { visual.className = `enemy-visual-geometric ${boss.class}`; }

        lucide.createIcons();
    };

    const renderUI = () => {
        document.getElementById('treasury-count').innerText = Math.floor(state.treasury).toLocaleString();
        document.getElementById('passive-rate').innerText = `+${(calculatePassiveRate() * Math.pow(1.15, state.attributes.speed)).toFixed(1)}/s`;
        document.getElementById('combo-fill').style.width = `${state.comboValue * 10}%`;
        document.getElementById('combo-text').innerText = state.furyActive ? `FRENZY: ${state.furyTimer.toFixed(1)}s` : `STRIKE x${Math.floor(state.comboValue)}`;

        // Boss & Player HP
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        const maxBoss = boss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        document.getElementById('boss-name').innerText = boss.name;
        document.getElementById('boss-health-fill').style.width = `${Math.max(0, (state.bossHealth / maxBoss) * 100)}%`;

        const maxPlayer = 100 + (state.attributes.durability * 25);
        document.getElementById('player-health-fill').style.width = `${Math.max(0, (state.playerHP / maxPlayer) * 100)}%`;
    };

    const notify = (msg) => {
        const container = document.getElementById('log-entries');
        if (!container) return;
        const div = document.createElement('div'); div.innerText = `> ${msg}`;
        container.prepend(div); if (container.children.length > 5) container.lastChild.remove();
    };

    const save = () => localStorage.setItem('sov_combat_v27', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_combat_v27') || localStorage.getItem('sov_tactility_v26');
        if (s) { try { const p = JSON.parse(s); state = { ...state, ...p, lastUpdate: Date.now() }; } catch(e) {} }
    };
    return { init, handleInteraction, switchTab };
})();
window.onload = Sovereign.init;
