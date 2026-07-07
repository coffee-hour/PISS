/**
 * Sovereign: Statecraft - Sovereign Engine (AAA V2 Hotfix)
 */

const Sovereign = (() => {
    // --- Realm State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50, pop: 12, faith: 0 },
        buildings: { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 },
        units: { guard: 0, ranger: 0, knight: 0, ram: 0 },
        clickLvl: 1,
        ministers: [],
        tech: [],
        faithId: 'none',
        statueImg: null,
        era: 0,
        legacyPoints: 0,
        modifiers: { production: 1.0, combat: 1.0, faith: 0 },
        regions: [
            { id: 'r1', name: 'Agrarian Outpost', difficulty: 1, captured: false, tribute: { food: 0.6 } },
            { id: 'r2', name: 'Blackwood Forest', difficulty: 5, captured: false, tribute: { wood: 0.6 } },
            { id: 'r3', name: 'Iron Vein Peak', difficulty: 25, captured: false, tribute: { ore: 0.9 } },
            { id: 'r4', name: 'Merchant Trade-Hub', difficulty: 120, captured: false, tribute: { gold: 1.2 } }
        ],
        lastUpdate: Date.now()
    };

    const religions = {
        none: { name: "No Faith", effect: "A secular state.", mult: {} },
        steel: { name: "The Steel Monolith", effect: "+25% Iron & Metallurgy", mult: { prod_ore: 0.25 }, icon: 'anvil' },
        solar: { name: "Solar Path", effect: "+20% Agrarian Output", mult: { prod_food: 0.20 }, icon: 'sun' },
        hearth: { name: "Cult of the Hearth", effect: "+15% Population Growth", mult: { prod_gold: 0.15 }, icon: 'home' }
    };

    const config = {
        eras: ["Age of Iron", "Feudal Reign", "Imperial Sovereignty", "Grand Dynasty"],
        buildings: {
            farm: { name: "Tenant Farm", res: "food", baseCost: { wood: 15, food: 5 }, prod: 1.5, pop: 3, icon: 'wheat' },
            lumber: { name: "Woodman's Camp", res: "wood", baseCost: { food: 20, wood: 5 }, prod: 1.2, pop: 2, icon: 'axe' },
            mine: { name: "Dug Quarry", res: "ore", baseCost: { wood: 45, ore: 10 }, prod: 1.0, pop: 4, icon: 'pickaxe' },
            forge: { name: "Iron Forge", res: "ore", baseCost: { wood: 180, ore: 100 }, prod: 6.0, pop: 6, icon: 'anvil' },
            market: { name: "Village Fair", res: "gold", baseCost: { wood: 120, gold: 60 }, prod: 0.6, pop: 2, icon: 'store' }
        },
        units: {
            guard: { name: "Steel Guard", baseCost: { food: 60, ore: 15 }, power: 15, upkeep: { food: 0.6 }, icon: 'shield' },
            ranger: { name: "Crossbowman", baseCost: { food: 45, wood: 60 }, power: 22, upkeep: { food: 0.5 }, icon: 'target' },
            knight: { name: "Imperial Knight", baseCost: { food: 200, ore: 120, gold: 50 }, power: 90, upkeep: { food: 4, gold: 1.0 }, icon: 'swords' },
            ram: { name: "Iron Ram", baseCost: { wood: 500, ore: 400, gold: 200 }, power: 400, upkeep: { gold: 8 }, icon: 'hammer' }
        }
    };

    const init = () => {
        load();
        setupNav();
        setupCanvas();
        render();
        startLoop();
    };

    const setupNav = () => {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(`tab-${tab}`);
                if (panel) {
                    panel.classList.add('active');
                    render(); // Re-render for safety on tab switch
                }
                lucide.createIcons();
            });
        });
        const upBtn = document.getElementById('upgrade-click-btn');
        if (upBtn) upBtn.onclick = (e) => { upgradeDecree(); triggerShake(); };
        const presBtn = document.getElementById('prestige-btn');
        if (presBtn) presBtn.onclick = concludeReign;
        const carveBtn = document.getElementById('carve-btn');
        if (carveBtn) carveBtn.onclick = carveStatue;
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
        const rel = religions[state.faithId] || religions.none;
        const getMult = (key) => 1 + (rel.mult[key] || 0);

        for (let id in state.buildings) {
            const b = config.buildings[id];
            const m = getMult(`prod_${b.res}`);
            state.resources[b.res] += b.prod * state.buildings[id] * delta * state.modifiers.production * m;
        }
        
        if (state.statueImg) {
            state.resources.faith += 0.5 * delta;
            state.modifiers.production = 1.0 + (state.resources.faith * 0.0001);
        }

        renderLedgerOnly();
    };

    const spawnParticle = (text, x, y) => {
        const container = document.getElementById('particle-container');
        if (!container) return;
        const p = document.createElement('div');
        p.className = 'float-particle';
        p.innerText = text;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 800);
    };

    const triggerShake = () => {
        const app = document.getElementById('app');
        if (app) {
            app.classList.add('shaking');
            setTimeout(() => app.classList.remove('shaking'), 400);
        }
    };

    const triggerCardEffect = (el) => {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight; 
        el.style.animation = 'cardShake 0.2s';
    };

    let ctx, painting = false, color = '#f5f5f0', size = 1;
    const setupCanvas = () => {
        const cvs = document.getElementById('statue-canvas');
        if (!cvs) return;
        ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        cvs.onmousedown = (e) => { painting = true; draw(e); };
        cvs.onmousemove = draw;
        window.onmouseup = () => painting = false;

        document.querySelectorAll('.palette-color').forEach(p => {
            p.onclick = () => {
                document.querySelectorAll('.palette-color').forEach(x => x.classList.remove('active'));
                p.classList.add('active');
                color = p.getAttribute('data-color');
            };
        });

        document.querySelectorAll('.brush-btn').forEach(b => {
            b.onclick = () => {
                document.querySelectorAll('.brush-btn').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                size = parseInt(b.getAttribute('data-size'));
            };
        });

        const undoBtn = document.getElementById('tool-undo');
        if (undoBtn) undoBtn.onclick = () => Sovereign.notify("Undo scroll currently under scribing...");
        const clearBtn = document.getElementById('tool-clear');
        if (clearBtn) clearBtn.onclick = () => ctx.clearRect(0,0,64,64);
        const gridBtn = document.getElementById('tool-grid');
        if (gridBtn) gridBtn.onclick = () => {
            const grid = document.getElementById('canvas-grid');
            if (grid) grid.classList.toggle('hidden');
            gridBtn.classList.toggle('active');
        };

        document.querySelectorAll('.bp-btn').forEach(btn => {
            btn.onclick = () => loadBlueprint(btn.getAttribute('data-bp'));
        });
    };

    const draw = (e) => {
        if (!painting || !ctx) return;
        const cvs = document.getElementById('statue-canvas');
        const rect = cvs.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (rect.width / 64));
        const y = Math.floor((e.clientY - rect.top) / (rect.height / 64));

        if (color === 'transparent') {
            ctx.clearRect(x, y, size, size);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, size, size);
        }
    };

    const loadBlueprint = (bp) => {
        if (!ctx) return;
        ctx.clearRect(0,0,64,64);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        if (bp === 'crown') ctx.fillRect(10, 30, 44, 20);
        if (bp === 'sword') ctx.fillRect(30, 5, 4, 50);
        if (bp === 'pillar') ctx.fillRect(20, 10, 24, 44);
    };

    const carveStatue = () => {
        const cvs = document.getElementById('statue-canvas');
        if (!cvs) return;
        state.statueImg = cvs.toDataURL();
        Sovereign.notify("THE MONUMENT HAS BEEN CARVED. FAITH RISES.");
        triggerShake();
        renderStatue();
        save();
    };

    const renderStatue = () => {
        const el = document.getElementById('active-statue');
        if (el && state.statueImg) {
            el.style.backgroundImage = `url(${state.statueImg})`;
        }
    };

    const render = () => {
        renderLedgerOnly();
        renderThroneRoom();
        renderPantheon();
        renderStatue();
        renderMarket();
        renderExpansion();
        renderArchive();
        renderDynasty();
        renderGarrison();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = config.eras[state.era] || "Divine Dynasty";
        lucide.createIcons();
    };

    const renderLedgerOnly = () => {
        for (let res in state.resources) {
            const node = document.getElementById(`res-${res}`);
            if (node) {
                const valEl = node.querySelector('.res-val');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
                const rateEl = node.querySelector('.res-rate');
                if (rateEl) {
                    let rTotal = 0;
                    for (let bid in state.buildings) if (config.buildings[bid].res === res) rTotal += config.buildings[bid].prod * state.buildings[bid];
                    state.regions.filter(reg => reg.captured).forEach(reg => { if(reg.tribute[res]) rTotal += reg.tribute[res]; });
                    rateEl.innerText = `+${(rTotal * state.modifiers.production).toFixed(1)}/s`;
                }
            }
        }
    };

    const renderThroneRoom = () => {
        const upBtn = document.getElementById('upgrade-click-btn');
        const cost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        if (upBtn) {
            upBtn.innerText = `Scribe Decree (${cost} Gold)`;
            upBtn.disabled = state.resources.gold < cost;
        }
        const lvlEl = document.getElementById('click-lvl');
        if (lvlEl) lvlEl.innerText = `Decree ${state.clickLvl}`;
        const powEl = document.getElementById('click-power');
        if (powEl) powEl.innerText = state.clickLvl;

        const container = document.getElementById('senate-buildings');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.buildings) {
            const b = config.buildings[id];
            const count = state.buildings[id];
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded clickable-card';
            card.onclick = () => triggerCardEffect(card);
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${b.icon}"></i> ${b.name}</h3><span class="seal">Lv ${count}</span></div>
                <div class="card-body"><p>Yield: ${b.prod} ${b.res}/s.</p>
                <button class="action-btn" onclick="Sovereign.buyBuilding('${id}')">Lease</button></div>`;
            container.appendChild(card);
        }
    };

    const renderPantheon = () => {
        const list = document.getElementById('religion-list');
        if (!list) return;
        list.innerHTML = '';
        for (let id in religions) {
            const r = religions[id];
            const btn = document.createElement('div');
            btn.className = `religion-btn ${state.faithId === id ? 'active' : ''}`;
            btn.innerHTML = `<h4>${r.name}</h4><p>${r.effect}</p>`;
            btn.onclick = () => { state.faithId = id; renderPantheon(); triggerShake(); };
            list.appendChild(btn);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-list');
        if (!container) return;
        container.innerHTML = '';
        const trades = [
            { id: 'f_sell', name: 'Grain Caravan', from: 'food', to: 'gold', rate: 0.15 },
            { id: 'w_sell', name: 'Lumber Caravan', from: 'wood', to: 'gold', rate: 0.20 },
            { id: 'o_sell', name: 'Iron Caravan', from: 'ore', to: 'gold', rate: 0.40 }
        ];
        trades.forEach(t => {
            const div = document.createElement('div');
            div.className = 'caravan-item iron-banded';
            div.innerHTML = `
                <div class="caravan-info"><h3>${t.name}</h3><p>Rate: 1 = ${t.rate} Gold</p></div>
                <div class="caravan-actions">
                    <button class="command-btn" onclick="Sovereign.trade('${t.id}', 10)">Trade 10</button>
                    <button class="command-btn" onclick="Sovereign.trade('${t.id}', 100)">Trade 100</button>
                </div>`;
            container.appendChild(div);
        });
    };

    const renderExpansion = () => {
        const map = document.getElementById('expansion-map');
        if (!map) return;
        map.innerHTML = '';
        state.regions.forEach(r => {
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3>${r.name}</h3><span class="seal">${r.captured?'Annexed':'Hostile'}</span></div>
                <button class="action-btn candle-glow" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">Mobilize</button>`;
            map.appendChild(card);
        });
    };

    const renderArchive = () => {
        const container = document.getElementById('tech-tree');
        if (!container) return;
        container.innerHTML = '';
        const techList = [
            { id: 't1', name: 'Crop Rotation Scrip', cost: { food: 250, wood: 150 }, effect: '+20% Grain prod', icon: 'scroll' },
            { id: 't2', name: 'Masonry Guilds', cost: { wood: 600, gold: 200 }, effect: '+25% Construction', icon: 'hammer' },
            { id: 't3', name: 'Military Logistics', cost: { gold: 1200 }, effect: '-30% Upkeep', icon: 'map' }
        ];
        techList.forEach(t => {
            const owned = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3>${t.name}</h3>${owned?'<span class="seal">Deciphered</span>':''}</div>
                <button class="action-btn" ${owned?'disabled':''} onclick="Sovereign.research('${t.id}')">Decipher</button>`;
            container.appendChild(card);
        });
    };

    const renderDynasty = () => {
        const legEl = document.getElementById('legacy-points');
        if (legEl) legEl.innerText = state.legacyPoints;
        const prodEl = document.getElementById('prod-mult');
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
    };

    const renderGarrison = () => {
        const container = document.getElementById('garrison-units');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.units) {
            const u = config.units[id];
            const count = state.units[id];
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3>${u.name}</h3><span class="seal">${count} Armed</span></div>
                <button class="action-btn" onclick="Sovereign.recruitUnit('${id}')">Draft</button>`;
            container.appendChild(card);
        }
    };

    const manualGather = (res, e) => {
        state.resources[res] += state.clickLvl;
        if (e) spawnParticle(`+${state.clickLvl}`, e.clientX, e.clientY);
        renderLedgerOnly();
    };

    const buyBuilding = (id) => {
        const b = config.buildings[id];
        const count = state.buildings[id];
        const cost = {};
        for (let r in b.baseCost) cost[r] = Math.floor(b.baseCost[r] * Math.pow(1.35, count));
        if (canAfford(cost)) {
            for (let r in cost) state.resources[r] -= cost[r];
            state.buildings[id]++;
            render();
        }
    };

    const recruitUnit = (id) => {
        const u = config.units[id];
        if (canAfford(u.baseCost)) {
            for (let r in u.baseCost) state.resources[r] -= u.baseCost[r];
            state.units[id]++;
            render();
        }
    };

    const trade = (id, amt) => {
        const t = { f_sell: { from: 'food', rate: 0.15 }, w_sell: { from: 'wood', rate: 0.20 }, o_sell: { from: 'ore', rate: 0.40 } }[id];
        if (state.resources[t.from] >= amt) {
            state.resources[t.from] -= amt;
            state.resources.gold += amt * t.rate;
            render();
        }
    };

    const research = (id) => {
        const t = { t1: { food: 250, wood: 150 }, t2: { wood: 600, gold: 200 }, t3: { gold: 1200 } }[id];
        if (canAfford(t)) {
            for (let r in t) state.resources[r] -= t[r];
            state.tech.push(id);
            render();
        }
    };

    const attack = (rid) => {
        const r = state.regions.find(x => x.id === rid);
        let p = 0;
        for (let id in state.units) p += state.units[id] * config.units[id].power;
        p *= state.modifiers.combat;

        if (p >= r.difficulty * 60) {
            r.captured = true;
            Sovereign.notify(`VICTORY: ${r.name.toUpperCase()} SECURED.`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            Sovereign.notify(`DEFEAT AT ${r.name.toUpperCase()}. 30% LOSSES.`);
        }
        render();
    };

    const upgradeDecree = () => {
        const cost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        if (state.resources.gold >= cost) {
            state.resources.gold -= cost;
            state.clickLvl++;
            render();
        }
    };

    const concludeReign = () => {
        const gain = Math.floor(state.resources.gold / 3000);
        if (gain < 1) return alert("TREASURY INSUFFICIENT.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.15);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50, pop: 12, faith: 0 };
        state.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 };
        state.units = { guard: 0, ranger: 0, knight: 0, ram: 0 };
        state.tech = []; state.clickLvl = 1; state.faithId = 'none';
        state.regions.forEach(r => r.captured = false);
        save(); render();
    };

    const canAfford = (costs) => {
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };

    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (!entries) return;
        const d = document.createElement('div');
        d.innerHTML = `> ${msg}`;
        entries.prepend(d);
    };

    const save = () => localStorage.setItem('sov_aaa_v2_hotfix', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_aaa_v2_hotfix');
        if (s) state = { ...state, ...JSON.parse(s), lastUpdate: Date.now() };
    };

    return { init, manualGather, triggerCardEffect, buyBuilding, recruitUnit, trade, research, attack, notify };
})();

window.onload = Sovereign.init;
