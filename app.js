/**
 * Sovereign: Invincible (v2.6.1)
 * Invincible Rebranding, Threat Cycles, and Essence Collection.
 */

const Sovereign = (() => {
    // --- Imperial State ---
    let state = {
        treasury: 100,
        upgrades: {},
        advancements: {
            master_smithing: 0,
            imperial_logistics: 0,
            war_economy: 0,
            bloodthirst: 0,
            strategic_mastery: 0,
            imperial_command: 0,
            divine_wrath: 0,
            total_conquest: 0
        },
        totalGoldEarned: 0,
        lastUpdate: Date.now(),
        comboValue: 0,
        furyActive: false,
        furyTimer: 0,
        bossIndex: 0,
        bossHealth: 1000
    };

    const config = {
        bosses: [
            { name: "SEQUID SWARM", health: 1000, reward: 500 },
            { name: "FLAXAN INVASION", health: 10000, reward: 5000 },
            { name: "DOC SEISMIC", health: 100000, reward: 50000 },
            { name: "THRAGG", health: 1000000, reward: 500000 },
            { name: "OMNI-MAN", health: 10000000, reward: 5000000 }
        ],
        upgrades: [
            { id: 'militia', name: "Viltrumite Conscripts", desc: "+0.1 Essence/s", baseCost: 15, passive: 0.1, click: 0, icon: 'users' },
            { id: 'scouts', name: "Sky Scouts", desc: "+1 per Strike", baseCost: 50, passive: 0, click: 1, icon: 'eye' },
            { id: 'spearmen', name: "Iron Guardians", desc: "+1 Essence/s", baseCost: 100, passive: 1, click: 0, icon: 'shield' },
            { id: 'trebuchet', name: "Orbital Battery", desc: "+5 per Strike", baseCost: 500, passive: 0, click: 5, icon: 'target' },
            { id: 'knights', name: "Noble Vanguard", desc: "+8 Essence/s", baseCost: 1100, passive: 8, click: 0, icon: 'swords' },
            { id: 'v6', name: "Empire Ironclads", desc: "+20 Essence/s", baseCost: 5000, passive: 20, click: 0, icon: 'anchor' },
            { id: 'v7', name: "Solar Battery", desc: "+30 per Strike", baseCost: 12000, passive: 0, click: 30, icon: 'flame' },
            { id: 'v8', name: "Steel Falcons", desc: "+100 Essence/s", baseCost: 25000, passive: 100, click: 0, icon: 'bird' },
            { id: 'v9', name: "Void Saboteurs", desc: "+150 per Strike", baseCost: 55000, passive: 0, click: 150, icon: 'ghost' },
            { id: 'v10', name: "Praetorian Guard", desc: "+500 Essence/s", baseCost: 120000, passive: 500, click: 0, icon: 'shield-alert' },
            { id: 'v11', name: "Storm Walkers", desc: "+1200 Essence/s", baseCost: 350000, passive: 1200, click: 0, icon: 'bot' },
            { id: 'v12', name: "Titan Legion", desc: "+800 per Strike", baseCost: 800000, passive: 0, click: 800, icon: 'mountain' },
            { id: 'v13', name: "Eclipse Wraiths", desc: "+4000 Essence/s", baseCost: 2000000, passive: 4000, click: 0, icon: 'moon' },
            { id: 'v14', name: "Solar Engines", desc: "+2500 per Strike", baseCost: 5000000, passive: 0, click: 2500, icon: 'sun' },
            { id: 'v15', name: "Goliath Siege", desc: "+15000 Essence/s", baseCost: 15000000, passive: 15000, click: 0, icon: 'anvil' },
            { id: 'v16', name: "Nebula Wings", desc: "+50000 Essence/s", baseCost: 50000000, passive: 50000, click: 0, icon: 'sparkles' },
            { id: 'v17', name: "Star Eaters", desc: "+15000 per Strike", baseCost: 120000000, passive: 0, click: 15000, icon: 'star' },
            { id: 'v18', name: "Omega Division", desc: "+250000 Essence/s", baseCost: 400000000, passive: 250000, click: 0, icon: 'terminal' },
            { id: 'v19', name: "Singularity Core", desc: "+1M Essence/s", baseCost: 1500000000, passive: 1000000, click: 0, icon: 'circle-dot' },
            { id: 'v20', name: "Divine Arbiter", desc: "+10M Essence/s", baseCost: 10000000000, passive: 10000000, click: 0, icon: 'crown' },
            { id: 'v21', name: "Reality Breaker", desc: "+1M per Strike", baseCost: 50000000000, passive: 0, click: 1000000, icon: 'zap' },
            { id: 'v22', name: "Epoch Guard", desc: "+50M Essence/s", baseCost: 200000000000, passive: 50000000, click: 0, icon: 'hourglass' },
            { id: 'v23', name: "Abyssal Fleet", desc: "+250M Essence/s", baseCost: 1000000000000, passive: 250000000, click: 0, icon: 'waves' },
            { id: 'v24', name: "Void Titan", desc: "+1B Essence/s", baseCost: 5000000000000, passive: 1000000000, click: 0, icon: 'mountain-snow' },
            { id: 'v25', name: "Empire Overlord", desc: "+10B Essence/s", baseCost: 25000000000000, passive: 10000000000, click: 0, icon: 'castle' }
        ],
        advancements: [
            { id: 'master_smithing', name: "Master Smithing", desc: "+10% Essence Output", baseCost: 1000, multiplier: 1.1, type: 'passive', icon: 'hammer' },
            { id: 'imperial_logistics', name: "Imperial Logistics", desc: "+20% Strike Power", baseCost: 5000, multiplier: 1.2, type: 'click', icon: 'package' },
            { id: 'war_economy', name: "War Economy", desc: "Permanent -5% Upgrade Cost", baseCost: 25000, multiplier: 0.95, type: 'cost', icon: 'bar-chart' },
            { id: 'bloodthirst', name: "Bloodthirst", desc: "+50% Momentum Gain", baseCost: 100000, multiplier: 1.5, type: 'combo', icon: 'droplet' },
            { id: 'strategic_mastery', name: "Strategic Mastery", desc: "+25% Global Essence", baseCost: 1000000, multiplier: 1.25, type: 'global', icon: 'brain' },
            { id: 'imperial_command', name: "Imperial Command", desc: "Double Essence/s", baseCost: 10000000, multiplier: 2.0, type: 'passive', icon: 'megaphone' },
            { id: 'divine_wrath', name: "Divine Wrath", desc: "+5s Frenzy Duration", baseCost: 100000000, multiplier: 5, type: 'fury', icon: 'cloud-lightning' },
            { id: 'total_conquest', name: "Total Conquest", desc: "Triple Strike Power", baseCost: 1000000000, multiplier: 3.0, type: 'click', icon: 'swords' }
        ]
    };

    const initCursor = () => {
        const cursor = document.getElementById('custom-cursor');
        if (!cursor) return;
        const wrapper = cursor.querySelector('.sword-wrapper');
        document.addEventListener('mousemove', (e) => {
            cursor.style.left = `${e.clientX}px`;
            cursor.style.top = `${e.clientY}px`;
        });
        document.addEventListener('mousedown', () => {
            if (wrapper) {
                wrapper.classList.add('sword-strike');
                setTimeout(() => wrapper.classList.remove('sword-strike'), 100);
            }
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

    let audioCtx = null;
    const playImpactSound = (crit = false, frenzy = false) => {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = crit ? 'square' : 'sawtooth';
            osc.frequency.setValueAtTime(crit ? 100 : frenzy ? 240 : 180, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(crit ? 0.5 : 0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } catch(e) {}
    };

    let canvas, ctx, particles = [];
    const initParticles = () => {
        canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        requestAnimationFrame(updateParticles);
    };
    const resizeCanvas = () => { if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } };
    const spawnSparks = (x, y, multiplier = 1, crit = false) => {
        const count = (crit ? 30 : 10) * multiplier;
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y, vx: (Math.random() - 0.5) * (crit ? 30 : 18 + multiplier * 6),
                vy: (Math.random() - 0.5) * (crit ? 30 : 18 + multiplier * 6) - 5,
                life: 1.0, color: crit ? '#ff4500' : (Math.random() > 0.5 ? '#f59e0b' : '#ef4444'), 
                size: Math.random() * (4 + multiplier) + (crit ? 4 : 1)
            });
        }
    };
    const updateParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.45; p.life -= 0.02;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1.0; requestAnimationFrame(updateParticles);
    };

    const init = () => {
        load();
        config.upgrades.forEach(u => { if (state.upgrades[u.id] === undefined) state.upgrades[u.id] = 0; });
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
        if (!state.furyActive) state.comboValue = Math.max(0, state.comboValue - 1.2 * delta);
        else { state.furyTimer -= delta; if (state.furyTimer <= 0) deactivateFury(); }
        renderUI();
    };

    const calculatePassiveRate = () => {
        let base = config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.passive), 0);
        const sm = Math.pow(config.advancements[0].multiplier, state.advancements.master_smithing || 0);
        const st = Math.pow(config.advancements[4].multiplier, state.advancements.strategic_mastery || 0);
        const ic = Math.pow(config.advancements[5].multiplier, state.advancements.imperial_command || 0);
        return base * sm * st * ic;
    };

    const calculateClickPower = () => {
        let base = 1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.click), 0);
        const il = Math.pow(config.advancements[1].multiplier, state.advancements.imperial_logistics || 0);
        const tc = Math.pow(config.advancements[7].multiplier, state.advancements.total_conquest || 0);
        const finalBase = base * il * tc;
        return state.furyActive ? finalBase * 2 : finalBase;
    };

    const handleInteraction = (e) => {
        let power = calculateClickPower();
        const critChance = 0.1 + (state.comboValue / 50) + (state.furyActive ? 0.15 : 0);
        const isCrit = Math.random() < critChance;
        
        if (isCrit) power *= 5;

        state.treasury += power; state.totalGoldEarned += power;
        state.bossHealth -= power;

        const enemy = document.getElementById('enemy-sprite');
        if (enemy) { enemy.classList.remove('enemy-hit'); void enemy.offsetWidth; enemy.classList.add('enemy-hit'); }
        
        if (!state.furyActive) {
            const bt = Math.pow(config.advancements[3].multiplier, state.advancements.bloodthirst || 0);
            state.comboValue = Math.min(10, state.comboValue + (isCrit ? 0.8 : 0.4) * bt);
            if (state.comboValue >= 10) activateFury();
        }

        triggerShake(isCrit ? 20 : 2 + state.comboValue);
        spawnSparks(e.clientX, e.clientY, state.furyActive ? 5 : 1, isCrit);
        spawnCombatNumber(isCrit ? `CRITICAL! +${Math.floor(power)}` : `+${Math.floor(power)}`, e.clientX, e.clientY, isCrit);
        playImpactSound(isCrit, state.furyActive);
        
        if (state.bossHealth <= 0) defeatBoss();
        renderUI();
    };

    const defeatBoss = () => {
        const boss = config.bosses[state.bossIndex % config.bosses.length];
        state.treasury += boss.reward;
        
        document.body.classList.add('flashing');
        setTimeout(() => document.body.classList.remove('flashing'), 100);
        
        state.bossIndex++;
        const nextBoss = config.bosses[state.bossIndex % config.bosses.length];
        state.bossHealth = nextBoss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
        
        notify(`THREAT NEUTRALIZED: ${boss.name}. +${boss.reward.toLocaleString()} ESSENCE.`);
        spawnSparks(window.innerWidth / 2, window.innerHeight / 2, 20, true);
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
        p.innerText = text;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        const tx = (Math.random() - 0.5) * 200;
        const ty = -100 - Math.random() * 100;
        p.style.setProperty('--target-x', `${tx}px`);
        p.style.setProperty('--target-y', `${ty}px`);
        container.appendChild(p);
        setTimeout(() => p.remove(), 800);
    };

    const activateFury = () => {
        state.furyActive = true;
        const dw = (state.advancements.divine_wrath || 0) * config.advancements[6].multiplier;
        state.furyTimer = 5 + dw;
        document.body.classList.add('fury-active');
        notify("VILTRUMITE FURY ACTIVATED!");
    };
    
    const deactivateFury = () => {
        state.furyActive = false; state.comboValue = 0;
        document.body.classList.remove('fury-active');
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
            notify(`EMPIRE DECREE: ${adv.name} ASCENDED.`);
            render(); playImpactSound();
        }
    };

    const calculateUpgradeCost = (u) => {
        const base = u.baseCost * Math.pow(1.15, state.upgrades[u.id] || 0);
        const costMult = Math.pow(config.advancements[2].multiplier, state.advancements.war_economy || 0);
        return Math.floor(base * costMult);
    };

    const calculateAdvancementCost = (adv) => Math.floor(adv.baseCost * Math.pow(8, state.advancements[adv.id] || 0));

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
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${u.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${u.name}</div><div class="upgrade-desc">${u.desc}</div><div class="upgrade-cost">${cost.toLocaleString()} Essence</div></div><div class="upgrade-count">${state.upgrades[u.id] || 0}</div>`;
            gContainer.appendChild(card);
        });
        aContainer.innerHTML = '';
        config.advancements.forEach(adv => {
            const cost = calculateAdvancementCost(adv);
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.onclick = () => buyAdvancement(adv.id);
            card.innerHTML = `<div class="upgrade-icon"><i data-lucide="${adv.icon}"></i></div><div class="upgrade-info"><div class="upgrade-name">${adv.name}</div><div class="upgrade-desc">${adv.desc}</div><div class="upgrade-cost">${cost.toLocaleString()} Essence</div></div><div class="upgrade-count">${state.advancements[adv.id] || 0}</div>`;
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

        const boss = config.bosses[state.bossIndex % config.bosses.length];
        const bossNameEl = document.getElementById('boss-name');
        const bossFillEl = document.getElementById('boss-health-fill');
        if (bossNameEl) bossNameEl.innerText = boss.name;
        if (bossFillEl) {
            const max = boss.health * Math.pow(1.5, Math.floor(state.bossIndex / config.bosses.length));
            bossFillEl.style.width = `${Math.max(0, (state.bossHealth / max) * 100)}%`;
        }

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

    const save = () => localStorage.setItem('sov_tactility_v26', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_tactility_v26');
        if (s) {
            try { 
                const p = JSON.parse(s); 
                state = { ...state, ...p, lastUpdate: Date.now() }; 
                state.furyActive = false; 
                state.comboValue = 0;
            } catch(e) {}
        }
    };
    return { init, handleInteraction, switchTab };
})();
window.onload = Sovereign.init;
