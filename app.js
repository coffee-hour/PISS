/**
 * Sovereign: Viltrumite Combat (v2.7.1)
 * Recovery build for Cursor and Boss Rendering.
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
            { id: 'militia', name: "Viltrumite Conscripts", passive: 0.1, click: 0, baseCost: 15, icon: 'users' },
            { id: 'scouts', name: "Sky Scouts", passive: 0, click: 1, baseCost: 50, icon: 'eye' },
            { id: 'v10', name: "Praetorian Guard", passive: 500, click: 0, baseCost: 120000, icon: 'shield-alert' }
        ],
        attributes: [
            { id: 'strength', name: "Strength", desc: "x2.0 Strike Power", baseCost: 5000, icon: 'dumbbell' },
            { id: 'durability', name: "Durability", desc: "+25 HP & Defense", baseCost: 10000, icon: 'shield-check' },
            { id: 'speed', name: "Speed", desc: "+15% Momentum", baseCost: 15000, icon: 'zap' }
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

    const init = () => {
        load();
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
    };

    const updateState = (delta) => {
        const speedMult = Math.pow(1.15, state.attributes.speed);
        state.treasury += calculatePassive() * delta * speedMult;
        if (!state.furyActive) state.comboValue = Math.max(0, state.comboValue - 1.2 * delta);
        else { state.furyTimer -= delta; if (state.furyTimer <= 0) deactivateFury(); }
        
        if (Date.now() - state.lastDamageTime >= 3000) { takeDamage(); state.lastDamageTime = Date.now(); }
        renderUI();
    };

    const calculatePassive = () => config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] || 0) * u.passive, 0);

    const takeDamage = () => {
        const dmg = 10 * (1 + state.bossIndex/5) * Math.pow(0.9, state.attributes.durability);
        state.playerHP -= dmg;
        if (state.playerHP <= 0) {
            state.treasury *= 0.9;
            state.playerHP = 100 + state.attributes.durability * 25;
            const boss = config.bosses[state.bossIndex % config.bosses.length];
            state.bossHealth = boss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        }
    };

    const handleInteraction = (e) => {
        let power = (1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] || 0) * u.click, 0)) * Math.pow(2, state.attributes.strength);
        const isCrit = Math.random() < (0.1 + state.comboValue/50);
        if (isCrit) power *= 5;

        state.treasury += power; state.bossHealth -= power;
        const enemy = document.getElementById('enemy-sprite');
        if (enemy) { enemy.classList.remove('enemy-hit'); void enemy.offsetWidth; enemy.classList.add('enemy-hit'); }
        
        if (!state.furyActive) {
            state.comboValue = Math.min(10, state.comboValue + (isCrit ? 0.8 : 0.4) * Math.pow(1.15, state.attributes.speed));
            if (state.comboValue >= 10) activateFury();
        }
        spawnCombatNumber(isCrit ? `CRIT! +${Math.floor(power)}` : `+${Math.floor(power)}`, e.clientX, e.clientY, isCrit);
        if (state.bossHealth <= 0) defeatBoss();
        renderUI();
    };

    const defeatBoss = () => {
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        state.treasury += boss.reward;
        state.bossIndex++;
        const next = config.bosses[state.bossIndex % config.bosses.length];
        state.bossHealth = next.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        render();
    };

    const spawnCombatNumber = (text, x, y, crit) => {
        const container = document.getElementById('text-particle-container');
        if (!container) return;
        const p = document.createElement('div');
        p.className = `text-particle ${crit ? 'crit' : ''}`;
        p.innerText = text; p.style.left = `${x}px`; p.style.top = `${y}px`;
        p.style.setProperty('--target-x', `${(Math.random()-0.5)*200}px`);
        p.style.setProperty('--target-y', `-150px`);
        container.appendChild(p); setTimeout(() => p.remove(), 800);
    };

    const activateFury = () => { state.furyActive = true; state.furyTimer = 5; document.body.classList.add('fury-active'); };
    const deactivateFury = () => { state.furyActive = false; state.comboValue = 0; document.body.classList.remove('fury-active'); };

    const switchTab = (tabId) => {
        document.querySelectorAll('.shop-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`shop-${tabId}`).classList.add('active');
        Array.from(document.querySelectorAll('.tab-btn')).find(b => b.onclick.toString().includes(tabId)).classList.add('active');
    };

    const render = () => {
        const g = document.getElementById('upgrade-container');
        const a = document.getElementById('advancement-container');
        if (g) g.innerHTML = config.upgrades.map(u => `<div class="upgrade-card ${state.treasury < Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id]||0)) ? 'disabled' : ''}" onclick="Sovereign.buyUpgrade('${u.id}')"><div><i data-lucide="${u.icon}"></i></div><div style="flex:1"><b>${u.name}</b><br>${Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id]||0)).toLocaleString()} Essence</div><div>${state.upgrades[u.id]||0}</div></div>`).join('');
        if (a) a.innerHTML = config.attributes.map(attr => `<div class="upgrade-card ${state.treasury < Math.floor(attr.baseCost * Math.pow(5, state.attributes[attr.id])) ? 'disabled' : ''}" onclick="Sovereign.buyAttr('${attr.id}')"><div><i data-lucide="${attr.icon}"></i></div><div style="flex:1"><b>${attr.name}</b><br>${Math.floor(attr.baseCost * Math.pow(5, state.attributes[attr.id])).toLocaleString()} Essence</div><div>${state.attributes[attr.id]}</div></div>`).join('');
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        const visual = document.getElementById('enemy-visual');
        if (visual) visual.className = `enemy-visual-geometric ${boss.class}`;
        lucide.createIcons();
    };

    const renderUI = () => {
        document.getElementById('treasury-count').innerText = Math.floor(state.treasury).toLocaleString();
        document.getElementById('combo-fill').style.width = `${state.comboValue * 10}%`;
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        const maxBoss = boss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        document.getElementById('boss-name').innerText = boss.name;
        document.getElementById('boss-health-fill').style.width = `${Math.max(0, (state.bossHealth / maxBoss) * 100)}%`;
        const maxPlayer = 100 + state.attributes.durability * 25;
        document.getElementById('player-health-fill').style.width = `${Math.max(0, (state.playerHP / maxPlayer) * 100)}%`;
    };

    const buyUpgrade = (id) => {
        const u = config.upgrades.find(x => x.id === id);
        const cost = Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[id]||0));
        if (state.treasury >= cost) { state.treasury -= cost; state.upgrades[id] = (state.upgrades[id]||0) + 1; render(); }
    };

    const buyAttr = (id) => {
        const attr = config.attributes.find(x => x.id === id);
        const cost = Math.floor(attr.baseCost * Math.pow(5, state.attributes[id]));
        if (state.treasury >= cost) { state.treasury -= cost; state.attributes[id]++; if (id === 'durability') state.playerHP += 25; render(); }
    };

    const save = () => localStorage.setItem('sov_combat_v271', JSON.stringify(state));
    const load = () => { try { const s = localStorage.getItem('sov_combat_v271') || localStorage.getItem('sov_combat_v27'); if (s) state = { ...state, ...JSON.parse(s), lastUpdate: Date.now() }; } catch(e) {} };

    return { init, handleInteraction, switchTab, buyUpgrade, buyAttr };
})();
window.onload = Sovereign.init;
