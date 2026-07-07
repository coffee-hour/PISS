/**
 * Sovereign: Statecraft - Sovereign Engine (V4.1 Targeted Fixes)
 */

const Sovereign = (() => {
    // --- Realm State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50, pop: 100, faith: 0 },
        buildings: { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 },
        units: { guard: 0, ranger: 0, knight: 0, ram: 0 },
        clickLvl: 1,
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
        steel: { name: "The Steel Monolith", effect: "+25% Iron & Metallurgy", mult: { prod_ore: 0.25 } },
        solar: { name: "Solar Path", effect: "+20% Agrarian Output", mult: { prod_food: 0.20 } },
        hearth: { name: "Cult of the Hearth", effect: "+15% Population Growth", mult: { prod_gold: 0.15 } }
    };

    const councilMembers = [
        { id: 'steward', name: 'High Steward', icon: 'key', desc: 'Oversees agrarian logistics and biomass distribution.' },
        { id: 'marshal', name: 'Lord Marshal', icon: 'shield', desc: 'Commands the imperial garrison and tactical maneuvers.' },
        { id: 'treasurer', name: 'Grand Treasurer', icon: 'banknote', desc: 'Manages merchant caravans and credit arbitrage.' },
        { id: 'chancellor', name: 'High Chancellor', icon: 'scroll', desc: 'Scribes imperial decrees and diplomatic protocols.' }
    ];

    const config = {
        buildings: {
            farm: { name: "Tenant Farm", res: "food", baseCost: { wood: 15, food: 5 }, prod: 1.5, pop: 3, icon: 'wheat', clr: 'icon-grain' },
            lumber: { name: "Woodman's Camp", res: "wood", baseCost: { food: 20, wood: 5 }, prod: 1.2, pop: 2, icon: 'hammer', clr: 'icon-wood' },
            mine: { name: "Dug Quarry", res: "ore", baseCost: { wood: 45, ore: 10 }, prod: 1.0, pop: 4, icon: 'anvil', clr: 'icon-iron' },
            forge: { name: "Iron Forge", res: "ore", baseCost: { wood: 180, ore: 100 }, prod: 6.0, pop: 6, icon: 'anvil', clr: 'icon-iron' },
            market: { name: "Village Fair", res: "gold", baseCost: { wood: 120, gold: 60 }, prod: 0.6, pop: 2, icon: 'coins', clr: 'icon-gold' }
        },
        units: {
            guard: { name: "Steel Guard", baseCost: { food: 60, ore: 15 }, power: 15, upkeep: { food: 0.6 }, icon: 'shield', clr: 'icon-combat' },
            ranger: { name: "Crossbowman", baseCost: { food: 45, wood: 60 }, power: 22, upkeep: { food: 0.5 }, icon: 'target', clr: 'icon-combat' },
            knight: { name: "Imperial Knight", baseCost: { food: 200, ore: 120, gold: 50 }, power: 90, upkeep: { food: 4, gold: 1.0 }, icon: 'swords', clr: 'icon-combat' },
            ram: { name: "Iron Ram", baseCost: { wood: 500, ore: 400, gold: 200 }, power: 400, upkeep: { gold: 8 }, icon: 'hammer', clr: 'icon-iron' }
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
                if (panel) panel.classList.add('active');
                render();
                lucide.createIcons();
            });
        });
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
        const gen = calculateGeneration();
        for (let res in state.resources) {
            state.resources[res] += gen[res] * delta;
        }
        
        if (state.statueImg) {
            state.resources.faith += 0.5 * delta;
            state.modifiers.production = 1.0 + (state.resources.faith * 0.0001);
        }

        renderLedgerOnly(gen);
        renderPrices();
    };

    const calculateGeneration = () => {
        const rel = religions[state.faithId] || religions.none;
        const getMult = (res) => 1 + (rel.mult[`prod_${res}`] || 0);

        const gen = { food: 0, wood: 0, ore: 0, gold: 0, faith: 0 };
        for (let id in state.buildings) {
            const b = config.buildings[id];
            gen[b.res] += b.prod * state.buildings[id] * state.modifiers.production * getMult(b.res);
        }
        state.regions.filter(r => r.captured).forEach(r => {
            for (let res in r.tribute) gen[res] += r.tribute[res] * state.modifiers.production;
        });
        for (let id in state.units) {
            const u = config.units[id];
            for (let res in u.upkeep) gen[res] -= u.upkeep[res] * state.units[id];
        }
        if (state.statueImg) gen.faith = 0.5;
        return gen;
    };

    const renderLedgerOnly = (gen = null) => {
        if (!gen) gen = calculateGeneration();
        for (let res in state.resources) {
            const node = document.getElementById(`res-${res}`);
            const rateEl = document.getElementById(`rate-${res}`);
            if (node) {
                const valEl = node.querySelector('.res-val');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
            }
            if (rateEl) {
                const prefix = gen[res] >= 0 ? '+' : '';
                rateEl.innerText = `${prefix}${gen[res].toFixed(1)}/s`;
                rateEl.style.color = gen[res] >= 0 ? 'var(--success)' : 'var(--danger)';
            }
        }
        // Handle pop separately
        const popNode = document.getElementById('res-pop');
        if (popNode) {
            const popValEl = popNode.querySelector('.res-val');
            if (popValEl) popValEl.innerText = Math.floor(state.pop || 0).toLocaleString();
        }
    };

    const renderPrices = () => {
        const decCost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        const decPriceEl = document.getElementById('click-price');
        const upBtn = document.getElementById('upgrade-click-btn');
        if (decPriceEl) {
            const aff = state.resources.gold >= decCost;
            decPriceEl.innerHTML = `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">Cost: ${decCost} GOLD</span>`;
            if (upBtn) upBtn.disabled = !aff;
        }

        for (let id in config.buildings) {
            const b = config.buildings[id];
            const count = state.buildings[id];
            const container = document.getElementById(`price-${id}`);
            const btn = document.getElementById(`buy-${id}`);
            if (container) {
                let html = '';
                let affAll = true;
                for (let r in b.baseCost) {
                    const costVal = Math.floor(b.baseCost[r] * Math.pow(1.35, count));
                    const aff = state.resources[r] >= costVal;
                    if (!aff) affAll = false;
                    html += `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">${costVal} ${r.toUpperCase()}</span>`;
                }
                container.innerHTML = html;
                if (btn) btn.disabled = !affAll;
            }
        }

        for (let id in config.units) {
            const u = config.units[id];
            const container = document.getElementById(`price-unit-${id}`);
            const btn = document.getElementById(`recruit-${id}`);
            if (container) {
                let html = '';
                let affAll = true;
                for (let r in u.baseCost) {
                    const aff = state.resources[r] >= u.baseCost[r];
                    if (!aff) affAll = false;
                    html += `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">${u.baseCost[r]} ${r.toUpperCase()}</span>`;
                }
                container.innerHTML = html;
                if (btn) btn.disabled = !affAll;
            }
        }
    };

    const render = () => {
        renderLedgerOnly();
        renderThroneRoom();
        renderPantheon();
        renderMarket();
        renderExpansion();
        renderGarrison();
        renderDynasty();
        renderStatue();
        renderGrandCouncil();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = ["Age of Iron", "Feudal Reign", "Imperial Sovereignty", "Grand Dynasty"][state.era] || "Divine Reign";
        lucide.createIcons();
    };

    const renderThroneRoom = () => {
        const lvlEl = document.getElementById('click-lvl');
        const powEl = document.getElementById('click-power');
        if (lvlEl) lvlEl.innerText = `Decree ${state.clickLvl}`;
        if (powEl) powEl.innerText = state.clickLvl;

        const container = document.getElementById('senate-buildings');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.buildings) {
            const b = config.buildings[id];
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded clickable-card';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${b.icon}" class="${b.clr}"></i> ${b.name}</h3><span class="seal">Lv ${state.buildings[id]}</span></div>
                <div class="card-body"><p>Imperial yield: ${b.prod} ${b.res}/s. Employs ${b.pop} subjects.</p>
                <div class="price-display" id="price-${id}"></div>
                <button class="action-btn" id="buy-${id}" onclick="Sovereign.buyBuilding('${id}')">Authorize Lease</button></div>`;
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
            btn.onclick = () => { state.faithId = id; renderPantheon(); renderLedgerOnly(); triggerShake(); };
            list.appendChild(btn);
        }
    };

    const renderGarrison = () => {
        const container = document.getElementById('garrison-units');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.units) {
            const u = config.units[id];
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${u.icon}" class="${u.clr}"></i> ${u.name}</h3><span class="seal">${state.units[id]} Ready</span></div>
                <div class="card-body"><p>Power: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v])=>`${v}${r[0].toUpperCase()}`).join(', ')}</p>
                <div class="price-display" id="price-unit-${id}"></div>
                <button class="action-btn" id="recruit-${id}" onclick="Sovereign.recruitUnit('${id}')">Mobilize</button></div>`;
            container.appendChild(card);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-list');
        if (!container) return;
        container.innerHTML = '';
        const trades = [
            { id: 'f_sell', name: 'Grain Caravan', from: 'food', rate: 0.15, icon: 'wheat', clr: 'icon-grain' },
            { id: 'w_sell', name: 'Lumber Caravan', from: 'wood', rate: 0.20, icon: 'hammer', clr: 'icon-wood' },
            { id: 'o_sell', name: 'Iron Caravan', from: 'ore', rate: 0.40, icon: 'anvil', clr: 'icon-iron' }
        ];
        trades.forEach(t => {
            const div = document.createElement('div');
            div.className = 'chamber-card iron-banded';
            div.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${t.icon}" class="${t.clr}"></i> ${t.name}</h3></div>
                <div class="card-body"><p>Rate: 1 = ${t.rate} Gold</p>
                <button class="command-btn" onclick="Sovereign.trade('${t.id}', 10)">Trade 10</button>
                <button class="command-btn" onclick="Sovereign.trade('${t.id}', 100)">Trade 100</button></div>`;
            container.appendChild(div);
        });
    };

    const renderGrandCouncil = () => {
        const container = document.getElementById('council-ministers');
        if (!container) return;
        container.innerHTML = '';
        councilMembers.forEach(m => {
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${m.icon}" class="icon-stone"></i> ${m.name}</h3></div>
                <div class="card-body"><p>${m.desc}</p>
                <button class="action-btn candle-glow" onclick="Sovereign.notify('Minister ${m.name} assigned to regional oversight.')">Appoint Minister</button></div>`;
            container.appendChild(card);
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
                <div class="card-header"><h3><i data-lucide="map" class="icon-grain"></i> ${r.name}</h3><span class="seal">${r.captured?'Annexed':'Hostile'}</span></div>
                <button class="action-btn candle-glow" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">Mobilize Legion</button>`;
            map.appendChild(card);
        });
    };

    const renderDynasty = () => {
        const legEl = document.getElementById('legacy-points');
        const prodEl = document.getElementById('prod-mult');
        if (legEl) legEl.innerText = state.legacyPoints;
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
    };

    const renderStatue = () => {
        const el = document.getElementById('active-statue');
        if (el && state.statueImg) el.style.backgroundImage = `url(${state.statueImg})`;
    };

    // --- Actions ---
    const manualGather = (res, e) => {
        state.resources[res] += state.clickLvl;
        if (e) spawnParticle(`+${state.clickLvl}`, e.clientX, e.clientY);
        renderLedgerOnly();
    };

    const upgradeDecree = () => {
        const cost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        if (state.resources.gold >= cost) {
            state.resources.gold -= cost;
            state.clickLvl++;
            render();
            triggerShake();
        }
    };

    const buyBuilding = (id) => {
        const b = config.buildings[id];
        const count = state.buildings[id];
        let canAfford = true;
        let costs = {};
        for (let r in b.baseCost) {
            costs[r] = Math.floor(b.baseCost[r] * Math.pow(1.35, count));
            if (state.resources[r] < costs[r]) canAfford = false;
        }
        if (canAfford) {
            for (let r in costs) state.resources[r] -= costs[r];
            state.buildings[id]++;
            render();
        }
    };

    const recruitUnit = (id) => {
        const u = config.units[id];
        let canAfford = true;
        for (let r in u.baseCost) {
            if (state.resources[r] < u.baseCost[r]) canAfford = false;
        }
        if (canAfford) {
            for (let r in u.baseCost) state.resources[r] -= u.baseCost[r];
            state.units[id]++;
            render();
        }
    };

    const trade = (id, amt) => {
        const rates = { f_sell: { from: 'food', r: 0.15 }, w_sell: { from: 'wood', r: 0.20 }, o_sell: { from: 'ore', r: 0.40 } };
        const t = rates[id];
        if (state.resources[t.from] >= amt) {
            state.resources[t.from] -= amt;
            state.resources.gold += amt * t.r;
            renderLedgerOnly();
        }
    };

    const attack = (rid) => {
        const r = state.regions.find(x => x.id === rid);
        let p = 0;
        for (let id in state.units) p += state.units[id] * config.units[id].power;
        p *= state.modifiers.combat;
        if (p >= r.difficulty * 60) {
            r.captured = true;
            notify(`ANNEXED: ${r.name}`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            notify(`REPELLED FROM ${r.name}`);
        }
        render();
        triggerShake();
    };

    const concludeReign = () => {
        const gain = Math.floor(state.resources.gold / 3000);
        if (gain < 1) return alert("INSUFFICIENT TREASURY.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.15);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50, pop: 100, faith: 0 };
        state.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 };
        state.units = { guard: 0, ranger: 0, knight: 0, ram: 0 };
        state.clickLvl = 1; state.faithId = 'none';
        state.regions.forEach(reg => reg.captured = false);
        save(); render();
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

    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (entries) {
            const d = document.createElement('div');
            d.innerHTML = `> ${msg}`;
            entries.prepend(d);
        }
    };

    let ctx, painting = false, color = '#f5f5f0', brushSize = 1;
    const setupCanvas = () => {
        const cvs = document.getElementById('statue-canvas');
        if (!cvs) return;
        ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        cvs.onmousedown = (e) => { painting = true; paint(e); };
        cvs.onmousemove = paint;
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
                brushSize = parseInt(b.getAttribute('data-size'));
            };
        });

        const clearBtn = document.getElementById('tool-clear');
        if (clearBtn) clearBtn.onclick = () => ctx.clearRect(0, 0, 64, 64);
        const gridBtn = document.getElementById('tool-grid');
        if (gridBtn) gridBtn.onclick = () => {
            const g = document.getElementById('canvas-grid');
            if (g) g.classList.toggle('hidden');
            gridBtn.classList.toggle('active');
        };

        document.querySelectorAll('.bp-btn').forEach(btn => {
            btn.onclick = () => loadBlueprint(btn.getAttribute('data-bp'));
        });

        if (state.statueImg) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = state.statueImg;
        }
    };

    const paint = (e) => {
        if (!painting) return;
        const cvs = document.getElementById('statue-canvas');
        const rect = cvs.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (rect.width / 64));
        const y = Math.floor((e.clientY - rect.top) / (rect.height / 64));

        if (color === 'transparent') {
            ctx.clearRect(x, y, brushSize, brushSize);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, brushSize, brushSize);
        }
    };

    const loadBlueprint = (bp) => {
        ctx.clearRect(0,0,64,64);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        if (bp === 'crown') ctx.fillRect(10, 30, 44, 20);
        if (bp === 'sword') ctx.fillRect(30, 5, 4, 50);
        if (bp === 'pillar') ctx.fillRect(20, 10, 24, 44);
    };

    const carveStatue = () => {
        const cvs = document.getElementById('statue-canvas');
        if (cvs) {
            state.statueImg = cvs.toDataURL();
            renderStatue();
            save();
            notify("MONUMENT CARVED. FAITH TRICKLE ACTIVE.");
            triggerShake();
        }
    };

    const save = () => localStorage.setItem('sov_statue_image', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_statue_image');
        if (s) {
            const p = JSON.parse(s);
            state = { ...state, ...p, lastUpdate: Date.now() };
        }
        if (isNaN(state.pop)) state.pop = 100;
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, attack, upgradeDecree, carveStatue, concludeReign, notify };
})();

window.onload = Sovereign.init;
