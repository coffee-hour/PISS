/**
 * Sovereign: Imperial Clicker (v2.0.0)
 * Pure One-Click Military Idle Engine
 */

const Sovereign = (() => {
    // --- Imperial State ---
    let state = {
        treasury: 0,
        upgrades: {
            militia: 0,     // +0.1 Passive
            spearmen: 0,    // +1 Passive
            scouts: 0,      // +1 Click
            knights: 0,     // +8 Passive
            trebuchet: 0,   // +5 Click
            commander: 0,   // +40 Passive
            arsenal: 0,     // +15 Click
            automata: 0     // +200 Passive
        },
        totalClicks: 0,
        lastUpdate: Date.now()
    };

    const config = {
        upgrades: [
            { id: 'militia', name: "Conscripted Militia", desc: "Basic civilian levies. +0.1 Passive/s", baseCost: 15, passive: 0.1, click: 0, icon: 'users' },
            { id: 'scouts', name: "Border Scouts", desc: "Light cavalry for raiding. +1 per Click", baseCost: 50, passive: 0, click: 1, icon: 'eye' },
            { id: 'spearmen', name: "Iron Spearmen", desc: "Disciplined front-line troops. +1 Passive/s", baseCost: 100, passive: 1, click: 0, icon: 'shield' },
            { id: 'trebuchet', name: "Imperial Trebuchet", desc: "Heavy siege engineering. +5 per Click", baseCost: 500, passive: 0, click: 5, icon: 'target' },
            { id: 'knights', name: "Gilded Knights", desc: "Heavy armored cavalry. +8 Passive/s", baseCost: 1100, passive: 8, click: 0, icon: 'swords' },
            { id: 'arsenal', name: "Royal Arsenal", desc: "High-grade weaponry tech. +15 per Click", baseCost: 5000, passive: 0, click: 15, icon: 'zap' },
            { id: 'commander', name: "Lord Marshal", desc: "Supreme tactical leadership. +40 Passive/s", baseCost: 12000, passive: 40, click: 0, icon: 'crown' },
            { id: 'automata', name: "Ancient Automata", desc: "Living mechanical relics. +200 Passive/s", baseCost: 50000, passive: 200, click: 0, icon: 'cpu' }
        ]
    };

    const init = () => {
        load();
        render();
        startLoop();
        lucide.createIcons();
        notify("Imperial Throne Secured. Fund the War Machine.");
    };

    const startLoop = () => {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - state.lastUpdate) / 1000;
            state.lastUpdate = now;
            update(delta);
        }, 100);
        setInterval(save, 5000);
    };

    const update = (delta) => {
        const passiveRate = calculatePassiveRate();
        state.treasury += passiveRate * delta;
        
        renderUI();
    };

    const calculatePassiveRate = () => {
        return config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.passive), 0);
    };

    const calculateClickPower = () => {
        return 1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.click), 0);
    };

    const manualClick = (e) => {
        const power = calculateClickPower();
        state.treasury += power;
        state.totalClicks++;
        
        spawnParticle(`+${power}`, e.clientX, e.clientY);
        renderUI();
    };

    const buyUpgrade = (id) => {
        const u = config.upgrades.find(x => x.id === id);
        const cost = calculateCost(u);
        
        if (state.treasury >= cost) {
            state.treasury -= cost;
            state.upgrades[id]++;
            notify(`Militia Deployment: ${u.name} reinforced.`);
            render();
        }
    };

    const calculateCost = (u) => {
        return Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id]));
    };

    const render = () => {
        const container = document.getElementById('upgrade-container');
        if (!container) return;
        
        container.innerHTML = '';
        config.upgrades.forEach(u => {
            const cost = calculateCost(u);
            const count = state.upgrades[u.id];
            
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.id = `upgrade-${u.id}`;
            card.onclick = () => buyUpgrade(u.id);
            
            card.innerHTML = `
                <div class="upgrade-icon"><i data-lucide="${u.icon}"></i></div>
                <div class="upgrade-info">
                    <div class="upgrade-name">${u.name}</div>
                    <div class="upgrade-desc">${u.desc}</div>
                    <div class="upgrade-cost">${Math.floor(cost).toLocaleString()} Gold</div>
                </div>
                <div class="upgrade-count">${count}</div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
    };

    const renderUI = () => {
        const countEl = document.getElementById('treasury-count');
        const rateEl = document.getElementById('passive-rate');
        
        if (countEl) countEl.innerText = Math.floor(state.treasury).toLocaleString();
        if (rateEl) rateEl.innerText = `+${calculatePassiveRate().toFixed(1)}/s`;
        
        // Dynamic disable/enable based on treasury
        config.upgrades.forEach(u => {
            const card = document.getElementById(`upgrade-${u.id}`);
            if (card) {
                const cost = calculateCost(u);
                if (state.treasury < cost) card.classList.add('disabled');
                else card.classList.remove('disabled');
            }
        });
    };

    const spawnParticle = (text, x, y) => {
        const container = document.getElementById('particle-container');
        const p = document.createElement('div');
        p.className = 'particle';
        p.innerText = text;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 800);
    };

    const notify = (msg) => {
        const container = document.getElementById('log-entries');
        if (!container) return;
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        container.prepend(div);
        if (container.children.length > 5) container.lastChild.remove();
    };

    const save = () => localStorage.setItem('sov_clicker_v1', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_clicker_v1');
        if (s) {
            try {
                const p = JSON.parse(s);
                state = { ...state, ...p, lastUpdate: Date.now() };
            } catch(e) {}
        }
    };

    return { init, manualClick };
})();

window.onload = Sovereign.init;
