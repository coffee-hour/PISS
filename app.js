/**
 * Sovereign: Statecraft - Sovereign Engine
 */

const Sovereign = (() => {
    // --- Realm State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50, pop: 12 },
        buildings: { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 },
        units: { guard: 0, ranger: 0, knight: 0, ram: 0 },
        clickLvl: 1,
        ministers: [],
        tech: [],
        era: 0,
        legacyPoints: 0,
        modifiers: { production: 1.0, combat: 1.0 },
        regions: [
            { id: 'r1', name: 'Agrarian Outpost', difficulty: 1, captured: false, tribute: { food: 0.6 } },
            { id: 'r2', name: 'Blackwood Forest', difficulty: 5, captured: false, tribute: { wood: 0.6 } },
            { id: 'r3', name: 'Iron Vein Peak', difficulty: 25, captured: false, tribute: { ore: 0.9 } },
            { id: 'r4', name: 'Merchant Trade-Hub', difficulty: 120, captured: false, tribute: { gold: 1.2 } }
        ],
        lastUpdate: Date.now()
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
        },
        ministers: {
            steward: { id: 'steward', name: "High Steward", cost: { gold: 750 }, effect: "+20% Prod", production: 0.2, icon: 'briefcase' },
            marshal: { id: 'marshal', name: "Lord Marshal", cost: { gold: 1000 }, effect: "+30% Power", combat: 0.3, icon: 'shield-check' },
            treasurer: { id: 'treasurer', name: "Chancellor", cost: { gold: 2000 }, effect: "+75% Tribute", tribute: 0.75, icon: 'book-open' }
        },
        tech: [
            { id: 't1', name: 'Crop Rotation Scrip', cost: { food: 250, wood: 150 }, effect: '+20% Grain prod', icon: 'scroll' },
            { id: 't2', name: 'Masonry Guilds', cost: { wood: 600, gold: 200 }, effect: '+25% Construction', icon: 'hammer' },
            { id: 't3', name: 'Military Logistics', cost: { gold: 1200 }, effect: '-30% Upkeep', icon: 'map' }
        ],
        trades: [
            { id: 'f_sell', name: 'Grain Caravan', from: 'food', to: 'gold', rate: 0.15 },
            { id: 'w_sell', name: 'Lumber Caravan', from: 'wood', to: 'gold', rate: 0.20 },
            { id: 'o_sell', name: 'Iron Caravan', from: 'ore', to: 'gold', rate: 0.40 }
        ]
    };

    // --- Core Loops ---
    const init = () => {
        load();
        setupNav();
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
                lucide.createIcons();
            });
        });
        const upBtn = document.getElementById('upgrade-click-btn');
        if (upBtn) upBtn.addEventListener('click', upgradeDecree);
        const presBtn = document.getElementById('prestige-btn');
        if (presBtn) presBtn.addEventListener('click', concludeReign);
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
        for (let id in state.buildings) {
            const b = config.buildings[id];
            state.resources[b.res] += b.prod * state.buildings[id] * delta * state.modifiers.production;
        }
        const tributeMult = state.ministers.includes('treasurer') ? 1.75 : 1.0;
        state.regions.filter(r => r.captured).forEach(r => {
            for (let res in r.tribute) state.resources[res] += r.tribute[res] * delta * state.modifiers.production * tributeMult;
        });
        const upkeepMult = state.tech.includes('t3') ? 0.7 : 1.0;
        for (let id in state.units) {
            const u = config.units[id];
            for (let res in u.upkeep) state.resources[res] = Math.max(0, state.resources[res] - (u.upkeep[res] * state.units[id] * delta * upkeepMult));
        }
        renderLedgerOnly();
    };

    // --- Rendering ---
    const render = () => {
        renderLedgerOnly();
        renderThroneRoom();
        renderGarrison();
        renderMarket();
        renderCouncil();
        renderWarTable();
        renderArchive();
        renderDynasty();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = config.eras[state.era] || "Divine Dynasty";
        lucide.createIcons();
    };

    const renderLedgerOnly = () => {
        for (let res in state.resources) {
            const node = document.getElementById(`res-${res}`);
            if (node) {
                const valEl = node.querySelector('.res-val');
                const rateEl = node.querySelector('.res-rate');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
                if (rateEl) {
                    let rTotal = 0;
                    for (let bid in state.buildings) if (config.buildings[bid].res === res) rTotal += config.buildings[bid].prod * state.buildings[bid];
                    state.regions.filter(reg => reg.captured).forEach(reg => { if(reg.tribute[res]) rTotal += reg.tribute[res]; });
                    rateEl.innerText = `+${(rTotal * state.modifiers.production).toFixed(1)}/s`;
                }
            }
        }
        const popEl = document.getElementById('res-pop');
        if (popEl) {
            let currentPop = 12;
            for (let id in state.buildings) currentPop += config.buildings[id].pop * state.buildings[id];
            popEl.querySelector('.res-val').innerText = currentPop.toLocaleString();
        }
    };

    const renderThroneRoom = () => {
        const lvlEl = document.getElementById('click-lvl');
        const powEl = document.getElementById('click-power');
        const upBtn = document.getElementById('upgrade-click-btn');
        if (lvlEl) lvlEl.innerText = `Decree ${state.clickLvl}`;
        if (powEl) powEl.innerText = state.clickLvl;
        const cost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        if (upBtn) {
            upBtn.innerText = `Scribe Decree (${cost} Gold)`;
            upBtn.disabled = state.resources.gold < cost;
        }

        const container = document.getElementById('senate-buildings');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.buildings) {
            const b = config.buildings[id];
            const count = state.buildings[id];
            const cost = calcCost(b.baseCost, count);
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${b.icon}"></i> ${b.name}</h3><span class="seal">Lv ${count}</span></div>
                <div class="card-body"><p>Sovereign yield: ${b.prod} ${b.res}/s. Employs ${b.pop} subjects.</p>
                <div class="cost-stack">${renderCosts(cost)}</div>
                <button class="action-btn candle-glow" ${!canAfford(cost)?'disabled':''} onclick="Sovereign.buyBuilding('${id}')">Authorize Lease</button></div>`;
            container.appendChild(card);
        }
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
                <div class="card-header"><h3><i data-lucide="${u.icon}"></i> ${u.name}</h3><span class="seal">${count} Ready</span></div>
                <div class="card-body"><p>Tactical Power: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v])=>`${v}${r[0].toUpperCase()}`).join(', ')}</p>
                <div class="cost-stack">${renderCosts(u.baseCost)}</div>
                <button class="action-btn candle-glow" ${!canAfford(u.baseCost)?'disabled':''} onclick="Sovereign.recruitUnit('${id}')">Mobilize</button></div>`;
            container.appendChild(card);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-list');
        if (!container) return;
        container.innerHTML = '';
        config.trades.forEach(t => {
            const div = document.createElement('div');
            div.className = 'caravan-item iron-banded';
            div.innerHTML = `
                <div class="caravan-info"><h3><i data-lucide="truck"></i> ${t.name}</h3><p>Merchant Rate: 1 ${t.from.toUpperCase()} = ${t.rate} Gold</p></div>
                <div class="caravan-actions">
                    <button class="action-btn" onclick="Sovereign.trade('${t.id}', 10)">Trade 10</button>
                    <button class="action-btn" onclick="Sovereign.trade('${t.id}', 100)">Trade 100</button>
                </div>`;
            container.appendChild(div);
        });
    };

    const renderCouncil = () => {
        const container = document.getElementById('council-ministers');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.ministers) {
            const m = config.ministers[id];
            const owned = state.ministers.includes(id);
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${m.icon}"></i> ${m.name}</h3>${owned?'<span class="seal">In Seat</span>':''}</div>
                <div class="card-body"><p>${m.effect}</p><div class="cost-stack">${renderCosts(m.cost)}</div>
                <button class="action-btn candle-glow" ${owned||!canAfford(m.cost)?'disabled':''} onclick="Sovereign.hireMinister('${id}')">${owned?'In Service':'Assign Seat'}</button></div>`;
            container.appendChild(card);
        }
    };

    const renderWarTable = () => {
        const map = document.getElementById('expansion-map');
        if (!map) return;
        map.innerHTML = '';
        state.regions.forEach(r => {
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3>${r.name}</h3><span class="seal">${r.captured?'Annexed':'Hostile'}</span></div>
                <div class="card-body"><p>Fortification Strength: ${r.difficulty}</p>
                <button class="action-btn candle-glow" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">${r.captured?'Tribute Secured':'Mobilize Legion'}</button></div>`;
            map.appendChild(card);
        });
    };

    const renderArchive = () => {
        const container = document.getElementById('tech-tree');
        if (!container) return;
        container.innerHTML = '';
        config.tech.forEach(t => {
            const owned = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded';
            card.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${t.icon}"></i> ${t.name}</h3>${owned?'<span class="seal">Deciphered</span>':''}</div>
                <div class="card-body"><p>${t.effect}</p><div class="cost-stack">${renderCosts(t.cost)}</div>
                <button class="action-btn candle-glow" ${owned||!canAfford(t.cost)?'disabled':''} onclick="Sovereign.research('${t.id}')">Decipher Script</button></div>`;
            container.appendChild(card);
        });
    };

    const renderDynasty = () => {
        const legEl = document.getElementById('legacy-points');
        const prodEl = document.getElementById('prod-mult');
        const combEl = document.getElementById('combat-bonus');
        if (legEl) legEl.innerText = state.legacyPoints;
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
        if (combEl) combEl.innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
    };

    // --- Sovereignty Actions ---
    const manualGather = (res) => {
        state.resources[res] += state.clickLvl;
        renderLedgerOnly();
    };

    const upgradeDecree = () => {
        const cost = Math.floor(120 * Math.pow(1.65, state.clickLvl - 1));
        if (state.resources.gold >= cost) {
            state.resources.gold -= cost;
            state.clickLvl++;
            render();
        }
    };

    const buyBuilding = (id) => {
        const b = config.buildings[id];
        const cost = calcCost(b.baseCost, state.buildings[id]);
        if (canAfford(cost)) { pay(cost); state.buildings[id]++; render(); }
    };
    const recruitUnit = (id) => {
        const u = config.units[id];
        if (canAfford(u.baseCost)) { pay(u.baseCost); state.units[id]++; render(); }
    };
    const trade = (id, amt) => {
        const t = config.trades.find(x => x.id === id);
        if (state.resources[t.from] >= amt) {
            state.resources[t.from] -= amt;
            state.resources[t.to] += amt * t.rate;
            render();
        }
    };
    const hireMinister = (id) => {
        const m = config.ministers[id];
        if (canAfford(m.cost)) {
            pay(m.cost);
            state.ministers.push(id);
            if (m.combat) state.modifiers.combat += m.combat;
            if (m.production) state.modifiers.production += m.production;
            render();
        }
    };
    const research = (id) => {
        const t = config.tech.find(x => x.id === id);
        if (canAfford(t.cost)) { pay(t.cost); state.tech.push(id); render(); }
    };
    const attack = (rid) => {
        const r = state.regions.find(x => x.id === rid);
        if (getTotalPower() >= r.difficulty * 60) {
            r.captured = true;
            Sovereign.notify(`ANNEXATION LOG: TERRITORY ${r.name.toUpperCase()} HAS SURRENDERED.`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            Sovereign.notify(`ANNEXATION LOG: THE LEGION WAS REPELLED FROM ${r.name.toUpperCase()}. HEAVY LOSSES.`);
        }
        render();
    };
    const concludeReign = () => {
        const gain = Math.floor(state.resources.gold / 3000);
        if (gain < 1) return alert("TREASURY INSUFFICIENT TO SEAL DYNASTIC LEGACY.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.15);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.10);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50, pop: 12 };
        state.buildings = { farm: 0, lumber: 0, mine: 0, forge: 0, market: 0 };
        state.units = { guard: 0, ranger: 0, knight: 0, ram: 0 };
        state.tech = []; state.ministers = []; state.clickLvl = 1;
        state.regions.forEach(r => r.captured = false);
        save(); render();
    };

    // --- Helpers ---
    const calcCost = (base, count) => {
        const cost = {};
        for (let r in base) cost[r] = Math.floor(base[r] * Math.pow(1.35, count));
        return cost;
    };
    const canAfford = (costs) => {
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };
    const pay = (costs) => { for (let r in costs) state.resources[r] -= costs[r]; };
    const renderCosts = (costs) => {
        let h = '';
        for (const r in costs) {
            const aff = state.resources[r] >= costs[r];
            h += `<span class="cost-scroll ${aff ? 'can-pay' : ''}">${costs[r]} ${r.toUpperCase()}</span>`;
        }
        return h;
    };
    const getTotalPower = () => {
        let p = 0;
        for (let id in state.units) p += state.units[id] * config.units[id].power;
        return p * state.modifiers.combat;
    };
    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (!entries) return;
        const d = document.createElement('div');
        d.innerHTML = `<span style="color:var(--ink-dim)">[LEGALIS]</span> > ${msg}`;
        entries.prepend(d);
    };
    const save = () => localStorage.setItem('sov_statecraft_v1', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_statecraft_v1');
        if (s) {
            const p = JSON.parse(s);
            state = { ...state, ...p };
            state.lastUpdate = Date.now();
        }
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, hireMinister, research, attack, notify };
})();

window.onload = Sovereign.init;
