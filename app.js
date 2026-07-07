/**
 * Sovereign: Statecraft - Sovereign Engine (V3.1 Stabilization & Fixes)
 */

const Sovereign = (() => {
    // --- Realm State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50, pop: 12, faith: 0 },
        buildings: { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 },
        units: { guard: 0, ranger: 0, knight: 0, ram: 0 },
        clickLvl: 1,
        ministers: [],
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
        const upBtn = document.getElementById('upgrade-click-btn');
        if (upBtn) upBtn.onclick = upgradeDecree;
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
        renderPrices(); // Ensure prices and per-sec rates update every tick
    };

    // --- Pricing & Gen Rates ---
    const getBuildingCost = (id) => {
        const b = config.buildings[id];
        const count = state.buildings[id];
        const cost = {};
        for (let r in b.baseCost) cost[r] = Math.floor(b.baseCost[r] * Math.pow(1.35, count));
        return cost;
    };

    const getDecreeCost = () => Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));

    const canAfford = (costs) => {
        if (typeof costs === 'number') return state.resources.gold >= costs;
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };

    const renderPrices = () => {
        // Decree Price
        const decreeCost = getDecreeCost();
        const decreePriceEl = document.getElementById('click-price');
        const upBtn = document.getElementById('upgrade-click-btn');
        if (decreePriceEl) {
            const aff = canAfford(decreeCost);
            decreePriceEl.innerHTML = `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">Cost: ${decreeCost} GOLD</span>`;
            if (upBtn) upBtn.disabled = !aff;
        }

        // Building Prices
        for (let id in config.buildings) {
            const cost = getBuildingCost(id);
            const container = document.getElementById(`price-${id}`);
            const btn = document.getElementById(`buy-${id}`);
            if (container) {
                container.innerHTML = Object.entries(cost).map(([res, val]) => {
                    const aff = state.resources[res] >= val;
                    return `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">${val} ${res.toUpperCase()}</span>`;
                }).join('');
                if (btn) btn.disabled = !canAfford(cost);
            }
        }

        // Unit Prices
        for (let id in config.units) {
            const cost = config.units[id].baseCost;
            const btn = document.getElementById(`recruit-${id}`);
            const container = document.getElementById(`price-unit-${id}`);
            if (container) {
                container.innerHTML = Object.entries(cost).map(([res, val]) => {
                    const aff = state.resources[res] >= val;
                    return `<span class="price-tag ${aff?'can-afford':'cannot-afford'}">${val} ${res.toUpperCase()}</span>`;
                }).join('');
                if (btn) btn.disabled = !canAfford(cost);
            }
        }
    };

    // --- Rendering ---
    const render = () => {
        renderLedgerOnly();
        renderThroneRoom();
        renderPantheon();
        renderMarket();
        renderExpansion();
        renderGarrison();
        renderDynasty();
        renderStatue();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = ["Age of Iron", "Feudal Reign", "Imperial Sovereignty", "Grand Dynasty"][state.era] || "Ethereal Society";
        lucide.createIcons();
    };

    const renderLedgerOnly = () => {
        const rel = religions[state.faithId] || religions.none;
        const getMult = (key) => 1 + (rel.mult[key] || 0);

        for (let res in state.resources) {
            const node = document.getElementById(`res-${res}`);
            if (node) {
                const valEl = node.querySelector('.res-val');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
                
                const rateEl = node.querySelector('.res-rate');
                if (rateEl) {
                    let rTotal = 0;
                    for (let bid in state.buildings) {
                        const b = config.buildings[bid];
                        if (b.res === res) rTotal += b.prod * state.buildings[bid];
                    }
                    state.regions.filter(reg => reg.captured).forEach(reg => {
                        if (reg.tribute[res]) rTotal += reg.tribute[res];
                    });
                    const m = getMult(`prod_${res}`);
                    const finalRate = rTotal * state.modifiers.production * m;
                    rateEl.innerText = `+${finalRate.toFixed(1)}/s`;
                }
            }
        }
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
            btn.onclick = () => { state.faithId = id; renderPantheon(); renderLedgerOnly(); };
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
            { id: 'f_sell', name: 'Grain Caravan', from: 'food', to: 'gold', rate: 0.15, icon: 'wheat', clr: 'icon-grain' },
            { id: 'w_sell', name: 'Lumber Caravan', from: 'wood', to: 'gold', rate: 0.20, icon: 'hammer', clr: 'icon-wood' },
            { id: 'o_sell', name: 'Iron Caravan', from: 'ore', to: 'gold', rate: 0.40, icon: 'anvil', clr: 'icon-iron' }
        ];
        trades.forEach(t => {
            const div = document.createElement('div');
            div.className = 'caravan-item iron-banded';
            div.innerHTML = `
                <div class="caravan-info"><h3><i data-lucide="${t.icon}" class="${t.clr}"></i> ${t.name}</h3><p>Rate: 1 = ${t.rate} Gold</p></div>
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
                <div class="card-header"><h3><i data-lucide="map" class="icon-grain"></i> ${r.name}</h3><span class="seal">${r.captured?'Annexed':'Hostile'}</span></div>
                <button class="action-btn candle-glow" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">Mobilize Legion</button>`;
            map.appendChild(card);
        });
    };

    const renderDynasty = () => {
        const legEl = document.getElementById('legacy-points');
        if (legEl) legEl.innerText = state.legacyPoints;
        const prodEl = document.getElementById('prod-mult');
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
    };

    const renderStatue = () => {
        const el = document.getElementById('active-statue');
        if (el && state.statueImg) el.style.backgroundImage = `url(${state.statueImg})`;
    };

    // --- Actions ---
    const manualGather = (res, e) => {
        state.resources[res] += state.clickLvl;
        if (e && typeof spawnParticle === 'function') spawnParticle(`+${state.clickLvl}`, e.clientX, e.clientY);
        renderLedgerOnly();
    };

    const upgradeDecree = () => {
        const cost = getDecreeCost();
        if (canAfford(cost)) {
            state.resources.gold -= cost;
            state.clickLvl++;
            render();
        }
    };

    const buyBuilding = (id) => {
        const cost = getBuildingCost(id);
        if (canAfford(cost)) {
            for (let r in cost) state.resources[r] -= cost[r];
            state.buildings[id]++;
            render();
        }
    };

    const recruitUnit = (id) => {
        const cost = config.units[id].baseCost;
        if (canAfford(cost)) {
            for (let r in cost) state.resources[r] -= cost[r];
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
            notify(`ANNEXED: ${r.name}`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            notify(`REPELLED FROM ${r.name}`);
        }
        render();
    };

    const concludeReign = () => {
        const gain = Math.floor(state.resources.gold / 3000);
        if (gain < 1) return alert("INSUFFICIENT TREASURY.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.15);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50, pop: 12, faith: 0 };
        state.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 };
        state.units = { guard: 0, ranger: 0, knight: 0, ram: 0 };
        state.clickLvl = 1; state.faithId = 'none';
        state.regions.forEach(reg => reg.captured = false);
        save(); render();
    };

    // --- Feedback ---
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

    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (entries) {
            const d = document.createElement('div');
            d.innerHTML = `> ${msg}`;
            entries.prepend(d);
        }
    };

    const save = () => localStorage.setItem('sov_aaa_v3_polish', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_aaa_v3_polish');
        if (s) state = { ...state, ...JSON.parse(s), lastUpdate: Date.now() };
    };

    // --- Statue Creator (Restored & Stabilized) ---
    let canvasCtx, painting = false, activeColor = '#f5f5f0', brushSize = 1;
    
    const setupCanvas = () => {
        const cvs = document.getElementById('statue-canvas');
        if (!cvs) return;
        canvasCtx = cvs.getContext('2d');
        canvasCtx.imageSmoothingEnabled = false;

        cvs.onmousedown = (e) => { painting = true; drawPixel(e); };
        cvs.onmousemove = drawPixel;
        window.addEventListener('mouseup', () => painting = false);

        // Palette Listeners
        document.querySelectorAll('.palette-color').forEach(p => {
            p.onclick = () => {
                document.querySelectorAll('.palette-color').forEach(x => x.classList.remove('active'));
                p.classList.add('active');
                activeColor = p.getAttribute('data-color');
            };
        });

        // Tool Listeners
        const clearBtn = document.getElementById('tool-clear');
        if (clearBtn) clearBtn.onclick = () => canvasCtx.clearRect(0,0,64,64);

        const gridBtn = document.getElementById('tool-grid');
        if (gridBtn) gridBtn.onclick = () => {
            const grid = document.getElementById('canvas-grid');
            if (grid) grid.classList.toggle('hidden');
            gridBtn.classList.toggle('active');
        };

        const brushBtns = document.querySelectorAll('.brush-btn');
        brushBtns.forEach(b => {
            b.onclick = () => {
                brushBtns.forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                brushSize = parseInt(b.getAttribute('data-size'));
            };
        });

        // Blueprint Listeners
        document.querySelectorAll('.bp-btn').forEach(btn => {
            btn.onclick = () => loadTemplate(btn.getAttribute('data-bp'));
        });
    };

    const drawPixel = (e) => {
        if (!painting || !canvasCtx) return;
        const cvs = document.getElementById('statue-canvas');
        const rect = cvs.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / (rect.width / 64));
        const y = Math.floor((e.clientY - rect.top) / (rect.height / 64));

        if (activeColor === 'transparent') {
            canvasCtx.clearRect(x, y, brushSize, brushSize);
        } else {
            canvasCtx.fillStyle = activeColor;
            canvasCtx.fillRect(x, y, brushSize, brushSize);
        }
    };

    const loadTemplate = (bp) => {
        if (!canvasCtx) return;
        canvasCtx.clearRect(0,0,64,64);
        canvasCtx.fillStyle = 'rgba(255,255,255,0.15)';
        if (bp === 'crown') canvasCtx.fillRect(10, 30, 44, 20);
        if (bp === 'sword') canvasCtx.fillRect(30, 5, 4, 50);
        if (bp === 'pillar') canvasCtx.fillRect(20, 10, 24, 44);
    };

    const carveStatue = () => {
        const cvs = document.getElementById('statue-canvas');
        if (cvs) {
            state.statueImg = cvs.toDataURL();
            renderStatue();
            save();
            notify("MONUMENT CARVED: FAITH RADIATES THROUGH THE REALM.");
        }
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, attack };
})();

window.onload = Sovereign.init;
