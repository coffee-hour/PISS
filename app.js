/**
 * Sovereign: Nemesis (v2.4.0)
 * Obsidian-Amber Sword Cursor, Dynamic Enemy Model, and Hit Mechanics.
 */

const Sovereign = (() => {
    // --- Imperial State ---
    let state = {
        treasury: 0,
        upgrades: {
            militia: 0, spearmen: 0, scouts: 0, knights: 0,
            trebuchet: 0, commander: 0, arsenal: 0, automata: 0,
            skyfortress: 0, orbital_laser: 0
        },
        advancements: {
            master_smithing: 0,
            imperial_logistics: 0,
            war_economy: 0
        },
        totalGoldEarned: 0,
        lastUpdate: Date.now(),
        // Combo System
        comboValue: 0,
        furyActive: false,
        furyTimer: 0
    };

    const config = {
        upgrades: [
            { id: 'militia', name: "Conscripted Militia", desc: "Basic levies. +0.1 Passive/s", baseCost: 15, passive: 0.1, click: 0, icon: 'users' },
            { id: 'scouts', name: "Border Scouts", desc: "Raiding scouts. +1 per Click", baseCost: 50, passive: 0, click: 1, icon: 'eye' },
            { id: 'spearmen', name: "Iron Spearmen", desc: "Line infantry. +1 Passive/s", baseCost: 100, passive: 1, click: 0, icon: 'shield' },
            { id: 'trebuchet', name: "Imperial Trebuchet", desc: "Siege engineering. +5 per Click", baseCost: 500, passive: 0, click: 5, icon: 'target' },
            { id: 'knights', name: "Gilded Knights", desc: "Heavy cavalry. +8 Passive/s", baseCost: 1100, passive: 8, click: 0, icon: 'swords' },
            { id: 'arsenal', name: "Royal Arsenal", desc: "Weaponry tech. +15 per Click", baseCost: 5000, passive: 0, click: 15, icon: 'zap' },
            { id: 'commander', name: "Lord Marshal", desc: "Tactical leadership. +40 Passive/s", baseCost: 12000, passive: 40, click: 0, icon: 'crown' },
            { id: 'automata', name: "Ancient Automata", desc: "Mechanical relics. +200 Passive/s", baseCost: 50000, passive: 200, click: 0, icon: 'cpu' },
            { id: 'skyfortress', name: "Sky Fortress", desc: "Aerial bastion. +1000 Passive/s", baseCost: 250000, passive: 1000, click: 0, icon: 'cloud-lightning' },
            { id: 'orbital_laser', name: "Orbital Laser", desc: "Celestial strike. +500 per Click", baseCost: 1000000, passive: 0, click: 500, icon: 'sun' }
        ],
        advancements: [
            { id: 'master_smithing', name: "Master Smithing", desc: "+10% Passive Output", baseCost: 1000, multiplier: 1.1, type: 'passive', icon: 'hammer' },
            { id: 'imperial_logistics', name: "Imperial Logistics", desc: "+20% Click Power", baseCost: 5000, multiplier: 1.2, type: 'click', icon: 'package' },
            { id: 'war_economy', name: "War Economy", desc: "Permanent -5% Upgrade Cost", baseCost: 25000, multiplier: 0.95, type: 'cost', icon: 'bar-chart' }
        ]
    };

    // --- Custom Cursor (Sword) ---
    const initCursor = () => {
        const cursor = document.getElementById('custom-cursor');
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;
        });
    };

    // --- Tab Switching ---
    const switchTab = (tabId) => {
        document.querySelectorAll('.shop-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`shop-${tabId}`).classList.add('active');
        const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase() === tabId);
        if (activeBtn) activeBtn.classList.add('active');
    };

    // --- Audio Synthesis ---
    let audioCtx = null;
    const playImpactSound = (fury = false) => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = fury ? 'square' : 'sawtooth';
        osc.frequency.setValueAtTime(fury ? 220 : 180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.1);
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(fury ? 400 : 800, audioCtx.currentTime);
        gain.gain.setValueAtTime(fury ? 0.4 : 0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    };

    // --- Particle System ---
    let canvas, ctx, particles = [];
    const initParticles = () => {
        canvas = document.getElementById('particle-canvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        requestAnimationFrame(updateParticles);
    };
    const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    const spawnSparks = (x, y, multiplier = 1) => {
        for (let i = 0; i < 8 * multiplier; i++) {
            particles.push({
                x, y, vx: (Math.random() - 0.5) * (15 + multiplier * 5),
                vy: (Math.random() - 0.5) * (15 + multiplier * 5) - 5,
                life: 1.0, color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444', size: Math.random() * (3 + multiplier) + 1
            });
        }
    };
    const updateParticles = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1.0; requestAnimationFrame(updateParticles);
    };

    // --- Core Logic ---
    const init = () => {
        load();
        initCursor();
        initParticles();
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
        const passiveRate = calculatePassiveRate();
        state.treasury += passiveRate * delta;
        state.totalGoldEarned += passiveRate * delta;
        if (!state.furyActive) state.comboValue = Math.max(0, state.comboValue - 1.5 * delta);
        else { state.furyTimer -= delta; if (state.furyTimer <= 0) deactivateFury(); }
        renderUI();
    };

    const calculatePassiveRate = () => {
        let base = config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.passive), 0);
        const mult = Math.pow(config.advancements[0].multiplier, state.advancements.master_smithing);
        return base * mult;
    };

    const calculateClickPower = () => {
        let base = 1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.click), 0);
        const mult = Math.pow(config.advancements[1].multiplier, state.advancements.imperial_logistics);
        const finalBase = base * mult;
        return state.furyActive ? finalBase * 2 : finalBase;
    };

    const handleInteraction = (e) => {
        const power = calculateClickPower();
        state.treasury += power; state.totalGoldEarned += power;
        
        // Enemy Hit Visuals
        const enemy = document.getElementById('enemy-sprite');
        enemy.classList.remove('enemy-hit');
        void enemy.offsetWidth;
        enemy.classList.add('enemy-hit');

        if (!state.furyActive) {
            state.comboValue = Math.min(10, state.comboValue + 0.4);
            if (state.comboValue >= 10) activateFury();
        }
        
        triggerRecoil(); spawnSparks(e.clientX, e.clientY, state.furyActive ? 5 : 1);
        spawnTextParticle(`+${Math.floor(power)}`, e.clientX, e.clientY);
        playImpactSound(state.furyActive); renderUI();
    };

    const activateFury = () => {
        state.furyActive = true; state.furyTimer = 5;
        document.body.classList.add('fury-active');
        notify("BATTLE FRENZY: 2X LOOT MULTIPLIER!");
    };
    
    const deactivateFury = () => {
        state.furyActive = false; state.comboValue = 0;
        document.body.classList.remove('fury-active');
    };

    const triggerRecoil = () => {
        const app = document.getElementById('app');
        app.classList.remove('recoil'); void app.offsetWidth; app.classList.add('recoil');
    };

    const spawnTextParticle = (text, x, y) => {
        const container = document.getElementById('text-particle-container');
        const p = document.createElement('div');
        p.className = 'text-particle'; if (state.furyActive) p.style.color = '#fff';
        p.innerText = text; p.style.left = `${x}px`; p.style.top = `${y}px`;
        container.appendChild(p); setTimeout(() => p.remove(), 800);
    };

    const buyUpgrade = (id) => {
        const u = config.upgrades.find(x => x.id === id);
        const cost = calculateUpgradeCost(u);
        if (state.treasury >= cost) {
            state.treasury -= cost; state.upgrades[id]++;
            render(); playImpactSound();
        }
    };

    const buyAdvancement = (id) => {
        const adv = config.advancements.find(x => x.id === id);
        const cost = calculateAdvancementCost(adv);
        if (state.treasury >= cost) {
            state.treasury -= cost; state.advancements[id]++;
            notify(`BATTLE ADVANCEMENT: ${adv.name}`);
            render(); playImpactSound();
        }
    };

    const calculateUpgradeCost = (u) => {
        const base = u.baseCost * Math.pow(1.15, state.upgrades[u.id]);
        const costMult = Math.pow(config.advancements[2].multiplier, state.advancements.war_economy);
        return Math.floor(base * costMult);
    };

    const calculateAdvancementCost = (adv) => {
        return Math.floor(adv.baseCost * Math.pow(5, state.advancements[adv.id]));
    };

    const render = () => {
        const gContainer = document.getElementById('upgrade-container');
        const aContainer = document.getElementById('advancement-container');
        if (!gContainer || !aContainer) return;
        
        gContainer.innerHTML = '';
        config.upgrades.forEach(u => {
            const cost = calculateUpgradeCost(u);
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.id = `upgrade-${u.id}`;
            card.onclick = () => buyUpgrade(u.id);
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${u.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${u.name}</div><div class="upgrade-desc">${u.desc}</div><div class="upgrade-cost">${cost.toLocaleString()} Gold</div></div><div class="upgrade-count">${state.upgrades[u.id]}</div>`;
            gContainer.appendChild(card);
        });

        aContainer.innerHTML = '';
        config.advancements.forEach(adv => {
            const cost = calculateAdvancementCost(adv);
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.onclick = () => buyAdvancement(adv.id);
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${adv.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${adv.name}</div><div class="upgrade-desc">${adv.desc}</div><div class="upgrade-cost">${cost.toLocaleString()} Gold</div></div><div class="upgrade-count">${state.advancements[adv.id]}</div>`;
            aContainer.appendChild(card);
        });
        lucide.createIcons();
    };

    const renderUI = () => {
        const countEl = document.getElementById('treasury-count');
        const rateEl = document.getElementById('passive-rate');
        if (countEl) countEl.innerText = Math.floor(state.treasury).toLocaleString();
        if (rateEl) rateEl.innerText = `+${calculatePassiveRate().toFixed(1)}/s`;
        
        const fillEl = document.getElementById('combo-fill');
        const textEl = document.getElementById('combo-text');
        if (fillEl) fillEl.style.width = `${state.comboValue * 10}%`;
        if (textEl) textEl.innerText = state.furyActive ? `FRENZY: ${state.furyTimer.toFixed(1)}s` : `STRIKE x${Math.floor(state.comboValue)}`;

        config.upgrades.forEach(u => {
            const card = document.getElementById(`upgrade-${u.id}`);
            if (card) {
                if (state.treasury < calculateUpgradeCost(u)) card.classList.add('disabled');
                else card.classList.remove('disabled');
            }
        });
    };

    const notify = (msg) => {
        const container = document.getElementById('log-entries');
        if (!container) return;
        const div = document.createElement('div'); div.innerText = `> ${msg}`;
        container.prepend(div); if (container.children.length > 5) container.lastChild.remove();
    };

    const save = () => localStorage.setItem('sov_nemesis_v24', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_nemesis_v24');
        if (s) {
            try { const p = JSON.parse(s); state = { ...state, ...p, lastUpdate: Date.now() }; state.furyActive = false; state.comboValue = 0; } catch(e) {}
        }
    };

    return { init, handleInteraction, switchTab };
})();

window.onload = Sovereign.init;
