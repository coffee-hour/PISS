/**
 * Sovereign: Imperial Society Simulator - Core Logic
 */

const Sovereign = (() => {
    // --- State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50, pop: 10 },
        buildings: { farm: 0, lumber: 0, mine: 0, foundry: 0, market: 0 },
        units: { militia: 0, ranger: 0, knight: 0, siege: 0 },
        clickLvl: 1,
        ministers: [],
        tech: [],
        era: 0,
        legacyPoints: 0,
        modifiers: { production: 1.0, combat: 1.0 },
        regions: [
            { id: 'r1', name: 'Agrarian Frontier', difficulty: 1, captured: false, tribute: { food: 0.5 } },
            { id: 'r2', name: 'Highlands Timber', difficulty: 5, captured: false, tribute: { wood: 0.5 } },
            { id: 'r3', name: 'Iron Peaks', difficulty: 20, captured: false, tribute: { ore: 0.8 } },
            { id: 'r4', name: 'Imperial Hub', difficulty: 100, captured: false, tribute: { gold: 1.0 } }
        ],
        lastUpdate: Date.now()
    };

    const config = {
        eras: ["Age of Discovery", "Feudal Hegemony", "Imperial Sovereignty", "Industrial Epoch"],
        buildings: {
            farm: { name: "Communal Farm", res: "food", baseCost: { wood: 15, food: 5 }, prod: 1.5, pop: 2 },
            lumber: { name: "Lumber Yard", res: "wood", baseCost: { food: 20, wood: 5 }, prod: 1.2, pop: 2 },
            mine: { name: "Basic Shaft", res: "ore", baseCost: { wood: 40, ore: 10 }, prod: 1.0, pop: 3 },
            foundry: { name: "Great Smelter", res: "ore", baseCost: { wood: 150, ore: 80 }, prod: 5.0, pop: 5 },
            market: { name: "Town Square", res: "gold", baseCost: { wood: 100, gold: 50 }, prod: 0.5, pop: 1 }
        },
        units: {
            militia: { name: "Imperial Militia", baseCost: { food: 60, ore: 10 }, power: 12, upkeep: { food: 0.5 } },
            ranger: { name: "Frontier Ranger", baseCost: { food: 40, wood: 50 }, power: 18, upkeep: { food: 0.4 } },
            knight: { name: "Order Knight", baseCost: { food: 150, ore: 80, gold: 30 }, power: 75, upkeep: { food: 3, gold: 0.5 } },
            siege: { name: "Empire Ram", baseCost: { wood: 400, ore: 300, gold: 150 }, power: 300, upkeep: { gold: 6 } }
        },
        ministers: {
            steward: { id: 'steward', name: "High Steward", cost: { gold: 600 }, effect: "+20% Prod", production: 0.2 },
            marshal: { id: 'marshal', name: "Lord Marshal", cost: { gold: 800 }, effect: "+25% Combat", combat: 0.25 },
            treasurer: { id: 'treasurer', name: "Imperial Treasurer", cost: { gold: 1500 }, effect: "+60% Tribute", tribute: 0.6 }
        },
        tech: [
            { id: 't1', name: 'Irrigation Schemes', cost: { food: 200, wood: 100 }, effect: '+15% Food production' },
            { id: 't2', name: 'Scaffold Engineering', cost: { wood: 500, gold: 100 }, effect: '+20% Construction efficiency' },
            { id: 't3', name: 'Logistical Codex', cost: { gold: 1000 }, effect: '-25% Army upkeep' }
        ],
        trades: [
            { id: 'f_sell', name: 'Levy Food for Gold', from: 'food', to: 'gold', rate: 0.12 },
            { id: 'w_sell', name: 'Levy Wood for Gold', from: 'wood', to: 'gold', rate: 0.18 },
            { id: 'o_sell', name: 'Levy Ore for Gold', from: 'ore', to: 'gold', rate: 0.35 }
        ]
    };

    const init = () => {
        load();
        setupNav();
        render();
        startLoop();
        lucide.createIcons();
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
        if (upBtn) upBtn.addEventListener('click', upgradeClick);
        const presBtn = document.getElementById('prestige-btn');
        if (presBtn) presBtn.addEventListener('click', prestige);
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
        const tributeMult = state.ministers.includes('treasurer') ? 1.6 : 1.0;
        state.regions.filter(r => r.captured).forEach(r => {
            for (let res in r.tribute) state.resources[res] += r.tribute[res] * delta * state.modifiers.production * tributeMult;
        });
        const upkeepMult = state.tech.includes('t3') ? 0.75 : 1.0;
        for (let id in state.units) {
            const u = config.units[id];
            for (let res in u.upkeep) state.resources[res] = Math.max(0, state.resources[res] - (u.upkeep[res] * state.units[id] * delta * upkeepMult));
        }
        renderResourcesOnly();
    };

    const render = () => {
        renderResourcesOnly();
        renderSenate();
        renderGarrison();
        renderMarket();
        renderCouncil();
        renderExpansion();
        renderTech();
        renderPrestige();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = config.eras[state.era] || "Ascended Society";
        lucide.createIcons();
    };

    const renderResourcesOnly = () => {
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
            let currentPop = 10;
            for (let id in state.buildings) currentPop += config.buildings[id].pop * state.buildings[id];
            popEl.querySelector('.res-val').innerText = currentPop.toLocaleString();
        }
    };

    const renderSenate = () => {
        const lvlEl = document.getElementById('click-lvl');
        const powEl = document.getElementById('click-power');
        const upBtn = document.getElementById('upgrade-click-btn');
        if (lvlEl) lvlEl.innerText = `Lvl ${state.clickLvl}`;
        if (powEl) powEl.innerText = state.clickLvl;
        const cost = Math.floor(100 * Math.pow(1.6, state.clickLvl - 1));
        if (upBtn) {
            upBtn.innerText = `Optimize Workforce (${cost} Gold)`;
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
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="card-header"><h3>${b.name}</h3><span class="badge">Lv ${count}</span></div>
                <div class="card-body"><p>Imperial production yielding ${b.prod} ${b.res}/s. Employs ${b.pop} Citizens.</p>
                <div class="cost-group">${renderCosts(cost)}</div>
                <button class="action-btn glow" ${!canAfford(cost)?'disabled':''} onclick="Sovereign.buyBuilding('${id}')">Authorize Infrastructure</button></div>`;
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
            card.className = 'action-card';
            card.innerHTML = `
                <div class="card-header"><h3>${u.name}</h3><span class="badge">${count} Armed</span></div>
                <div class="card-body"><p>Tactical Power: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v])=>`${v}${r[0].toUpperCase()}`).join(', ')}</p>
                <div class="cost-group">${renderCosts(u.baseCost)}</div>
                <button class="action-btn glow" ${!canAfford(u.baseCost)?'disabled':''} onclick="Sovereign.recruitUnit('${id}')">Draft Unit</button></div>`;
            container.appendChild(card);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-list');
        if (!container) return;
        container.innerHTML = '';
        config.trades.forEach(t => {
            const div = document.createElement('div');
            div.className = 'market-item';
            div.innerHTML = `
                <div class="m-info"><h3>${t.name}</h3><p>Imperial Rate: 1 ${t.from.toUpperCase()} = ${t.rate} Gold</p></div>
                <div class="m-actions">
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
            card.className = 'action-card primary-border';
            card.innerHTML = `
                <div class="card-header"><h3>${m.name}</h3>${owned?'<span class="badge">Appointed</span>':''}</div>
                <div class="card-body"><p>${m.effect}</p><div class="cost-group">${renderCosts(m.cost)}</div>
                <button class="action-btn glow" ${owned||!canAfford(m.cost)?'disabled':''} onclick="Sovereign.hireMinister('${id}')">${owned?'In Service':'Assign Seat'}</button></div>`;
            container.appendChild(card);
        }
    };

    const renderExpansion = () => {
        const map = document.getElementById('expansion-map');
        if (!map) return;
        map.innerHTML = '';
        state.regions.forEach(r => {
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `
                <div class="card-header"><h3>${r.name}</h3><span class="badge">${r.captured?'Secured':'Hostile'}</span></div>
                <div class="card-body"><p>Defense Multiplier: ${r.difficulty}</p>
                <button class="action-btn glow" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">${r.captured?'Region Levying':'Mobilize Legions'}</button></div>`;
            map.appendChild(card);
        });
    };

    const renderTech = () => {
        const container = document.getElementById('tech-tree');
        if (!container) return;
        container.innerHTML = '';
        config.tech.forEach(t => {
            const owned = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <div class="card-header"><h3>${t.name}</h3>${owned?'<span class="badge">Deciphered</span>':''}</div>
                <div class="card-body"><p>${t.effect}</p><div class="cost-group">${renderCosts(t.cost)}</div>
                <button class="action-btn glow" ${owned||!canAfford(t.cost)?'disabled':''} onclick="Sovereign.research('${t.id}')">Authorize Research</button></div>`;
            container.appendChild(card);
        });
    };

    const renderPrestige = () => {
        const legEl = document.getElementById('legacy-points');
        const prodEl = document.getElementById('prod-mult');
        const combEl = document.getElementById('combat-bonus');
        if (legEl) legEl.innerText = state.legacyPoints;
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
        if (combEl) combEl.innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
    };

    // --- Actions ---
    const manualGather = (res) => {
        state.resources[res] += state.clickLvl;
        renderResourcesOnly();
    };

    const upgradeClick = () => {
        const cost = Math.floor(100 * Math.pow(1.6, state.clickLvl - 1));
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
        if (getTotalPower() >= r.difficulty * 50) {
            r.captured = true;
            Sovereign.notify(`STRATEGIC VICTORY: SECTOR ${r.name.toUpperCase()} SECURED.`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            Sovereign.notify(`STRATEGIC DEFEAT: ATTEMPT ON ${r.name.toUpperCase()} FAILED. 30% LOSSES.`);
        }
        render();
    };
    const prestige = () => {
        const gain = Math.floor(state.resources.gold / 2500);
        if (gain < 1) return alert("INSUFFICIENT TREASURY FOR DYNASTIC SUCCESSION.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.12);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.08);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50, pop: 10 };
        state.buildings = { farm: 0, lumber: 0, mine: 0, foundry: 0, market: 0 };
        state.units = { militia: 0, ranger: 0, knight: 0, siege: 0 };
        state.tech = []; state.ministers = []; state.clickLvl = 1;
        state.regions.forEach(r => r.captured = false);
        save(); render();
    };

    // --- Helpers ---
    const calcCost = (base, count) => {
        const cost = {};
        for (let r in base) cost[r] = Math.floor(base[r] * Math.pow(1.3, count));
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
            h += `<span class="cost-tag ${aff ? 'affordable' : ''}">${costs[r]} ${r.toUpperCase()}</span>`;
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
        d.innerHTML = `<span style="color:var(--slate-dim)">[${new Date().toLocaleTimeString()}]</span> > ${msg}`;
        entries.prepend(d);
    };
    const save = () => localStorage.setItem('sov_society_save_v1', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_society_save_v1');
        if (s) {
            const p = JSON.parse(s);
            state = { ...state, ...p };
            state.lastUpdate = Date.now();
        }
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, hireMinister, research, attack, notify };
})();

window.onload = Sovereign.init;
