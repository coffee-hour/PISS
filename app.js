/**
 * Sovereign: Imperium Simulator
 */

const CF_API_TOKEN = "";
const CF_ACCOUNT_ID = "";

const Sovereign = (() => {
    // --- State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50 },
        buildings: { farm: 0, woodcutter: 0, quarry: 0, foundry: 0, market: 0 },
        units: { infantry: 0, archer: 0, cavalry: 0, siege: 0 },
        clickLvl: 1,
        commanders: [],
        tech: [],
        era: 0,
        legacyPoints: 0,
        modifiers: { production: 1.0, combat: 1.0 },
        regions: [
            { id: 'r1', name: 'Grain Fields', difficulty: 1, captured: false, tribute: { food: 0.5 } },
            { id: 'r2', name: 'Great Forest', difficulty: 5, captured: false, tribute: { wood: 0.5 } },
            { id: 'r3', name: 'Iron Veins', difficulty: 20, captured: false, tribute: { ore: 0.8 } },
            { id: 'r4', name: 'Merchant Hub', difficulty: 100, captured: false, tribute: { gold: 1.0 } }
        ],
        lastUpdate: Date.now(),
        nextEventTime: Date.now() + 120000 // 2 minutes from start
    };

    // --- Config ---
    const config = {
        eras: ["Age of Discovery", "Feudal Age", "Imperial Age", "Industrial Age", "Space Age"],
        buildings: {
            farm: { name: "Farm", res: "food", baseCost: { wood: 10, food: 5 }, prod: 1.5 },
            woodcutter: { name: "Woodcutter Lodge", res: "wood", baseCost: { food: 10, wood: 5 }, prod: 1.2 },
            quarry: { name: "Quarry", res: "ore", baseCost: { wood: 30, ore: 5 }, prod: 1.0 },
            foundry: { name: "Foundry", res: "ore", baseCost: { wood: 100, ore: 50 }, prod: 4.0 },
            market: { name: "Market", res: "gold", baseCost: { wood: 50, gold: 20 }, prod: 0.5 }
        },
        units: {
            infantry: { name: "Infantry", baseCost: { food: 50, ore: 10 }, power: 10, upkeep: { food: 0.5 } },
            archer: { name: "Archer", baseCost: { food: 30, wood: 40 }, power: 15, upkeep: { food: 0.4 } },
            cavalry: { name: "Cavalry", baseCost: { food: 100, ore: 50, gold: 20 }, power: 60, upkeep: { food: 2, gold: 0.5 } },
            siege: { name: "Siege Engine", baseCost: { wood: 300, ore: 200, gold: 100 }, power: 250, upkeep: { gold: 5 } }
        },
        commanders: {
            legatus: { name: "Legatus", cost: { gold: 500 }, effect: "+20% Combat Power", combat: 0.2 },
            tactician: { name: "Master Tactician", cost: { gold: 750 }, effect: "+15% Global Production", production: 0.15 },
            spymaster: { name: "Spymaster", cost: { gold: 1200 }, effect: "+50% Tributes", tribute: 0.5 }
        },
        tech: [
            { id: 't1', name: 'Advanced Metallurgy', cost: { ore: 200, gold: 100 }, effect: '+20% Ore boost' },
            { id: 't2', name: 'Logistics Overhaul', cost: { wood: 1000, gold: 500 }, effect: '-30% Upkeep costs' },
            { id: 't3', name: 'Empire Tax Automation', cost: { gold: 5000 }, effect: 'Massive Gold Tribute scaling' }
        ],
        trades: [
            { id: 'food_to_gold', name: 'Sell Food', from: 'food', to: 'gold', rate: 0.1 },
            { id: 'gold_to_food', name: 'Buy Food', from: 'gold', to: 'food', rate: 5.0 },
            { id: 'wood_to_gold', name: 'Sell Wood', from: 'wood', to: 'gold', rate: 0.15 },
            { id: 'gold_to_wood', name: 'Buy Wood', from: 'gold', to: 'wood', rate: 4.0 },
            { id: 'ore_to_gold', name: 'Sell Ore', from: 'ore', to: 'gold', rate: 0.3 },
            { id: 'gold_to_ore', name: 'Buy Ore', from: 'gold', to: 'ore', rate: 2.0 }
        ]
    };

    const events = [
        {
            title: "Caravan Arrival",
            desc: "A rich merchant caravan has arrived. They offer a favorable trade or a small donation to your treasury.",
            options: [
                { text: "Accept donation (+200 Gold)", action: () => { state.resources.gold += 200; } },
                { text: "Barter goods (+500 Food/Wood)", action: () => { state.resources.food += 500; state.resources.wood += 500; } }
            ]
        },
        {
            title: "Bandit Raid",
            desc: "Hostile marauders are threatening your outlying villages!",
            options: [
                { text: "Repel with Military (Needs 100 Power)", action: () => { 
                    if (getTotalPower() >= 100) Sovereign.notify("Victory!"); 
                    else { state.resources.food *= 0.8; Sovereign.notify("Defeat! Resources lost."); }
                }},
                { text: "Pay off (100 Gold)", action: () => { state.resources.gold = Math.max(0, state.resources.gold - 100); } }
            ]
        },
        {
            title: "Bountiful Harvest",
            desc: "Favorable weather has led to an unexpected surplus.",
            options: [
                { text: "Fill Granaries (+500 Food)", action: () => { state.resources.food += 500; } },
                { text: "Market Excess (+150 Gold)", action: () => { state.resources.gold += 150; } }
            ]
        }
    ];

    // --- Core ---
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
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
        document.getElementById('upgrade-click-btn').addEventListener('click', upgradeClick);
        document.getElementById('prestige-btn').addEventListener('click', prestige);
    };

    const startLoop = () => {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - state.lastUpdate) / 1000;
            state.lastUpdate = now;
            update(delta);
            if (now > state.nextEventTime) triggerEvent();
        }, 100);
        setInterval(save, 5000);
    };

    const update = (delta) => {
        // Prod
        for (let id in state.buildings) {
            const b = config.buildings[id];
            state.resources[b.res] += b.prod * state.buildings[id] * delta * state.modifiers.production;
        }
        // Tributes
        const tributeMult = state.commanders.includes('spymaster') ? 1.5 : 1.0;
        state.regions.filter(r => r.captured).forEach(r => {
            for (let res in r.tribute) state.resources[res] += r.tribute[res] * delta * state.modifiers.production * tributeMult;
        });
        // Upkeep
        const upkeepMult = state.tech.includes('t2') ? 0.7 : 1.0;
        for (let id in state.units) {
            const u = config.units[id];
            for (let res in u.upkeep) state.resources[res] = Math.max(0, state.resources[res] - (u.upkeep[res] * state.units[id] * delta * upkeepMult));
        }
        renderResources();
    };

    const render = () => {
        renderResources();
        renderCiv();
        renderBarracks();
        renderMarket();
        renderCommanders();
        renderCampaign();
        renderTech();
        renderPrestige();
        document.getElementById('current-era').innerText = config.eras[state.era] || "Ascended";
    };

    const renderResources = () => {
        for (let res in state.resources) {
            const pill = document.getElementById(`res-${res}`);
            if (pill) {
                pill.querySelector('.res-value').innerText = Math.floor(state.resources[res]).toLocaleString();
                // Rough rate
                let rate = 0;
                for (let id in state.buildings) if (config.buildings[id].res === res) rate += config.buildings[id].prod * state.buildings[id];
                state.regions.filter(r => r.captured).forEach(r => { if(r.tribute[res]) rate += r.tribute[res]; });
                pill.querySelector('.res-rate').innerText = `+${(rate * state.modifiers.production).toFixed(1)}/s`;
            }
        }
    };

    const manualGather = (res) => {
        state.resources[res] += state.clickLvl;
        renderResources();
    };

    const upgradeClick = () => {
        const cost = Math.floor(100 * Math.pow(1.5, state.clickLvl - 1));
        if (state.resources.gold >= cost) {
            state.resources.gold -= cost;
            state.clickLvl++;
            renderCiv();
        }
    };

    const renderCiv = () => {
        document.getElementById('click-lvl').innerText = `Lvl ${state.clickLvl}`;
        document.getElementById('click-power').innerText = state.clickLvl;
        const upgradeCost = Math.floor(100 * Math.pow(1.5, state.clickLvl - 1));
        document.getElementById('upgrade-click-btn').innerText = `Upgrade (${upgradeCost} Gold)`;
        document.getElementById('upgrade-click-btn').disabled = state.resources.gold < upgradeCost;

        const container = document.getElementById('civ-buildings');
        container.innerHTML = '';
        for (let id in config.buildings) {
            const b = config.buildings[id];
            const count = state.buildings[id];
            const cost = calcCost(b.baseCost, count);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${b.name}</h3><span class="card-badge">Lv ${count}</span></div>
                <div class="card-body"><p>Produces ${b.prod} ${b.res}/s.</p><div class="cost-row">${renderCosts(cost)}</div>
                <button class="primary-btn" ${!canAfford(cost)?'disabled':''} onclick="Sovereign.buyBuilding('${id}')">Build</button></div>`;
            container.appendChild(card);
        }
    };

    const renderBarracks = () => {
        const container = document.getElementById('military-units');
        container.innerHTML = '';
        for (let id in config.units) {
            const u = config.units[id];
            const count = state.units[id];
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${u.name}</h3><span class="card-badge">${count} Armed</span></div>
                <div class="card-body"><p>Power: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v])=>`${v}${r[0]}`).join(', ')}</p>
                <div class="cost-row">${renderCosts(u.baseCost)}</div>
                <button class="primary-btn" ${!canAfford(u.baseCost)?'disabled':''} onclick="Sovereign.recruitUnit('${id}')">Recruit</button></div>`;
            container.appendChild(card);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-grid');
        container.innerHTML = '';
        config.trades.forEach(trade => {
            const card = document.createElement('div');
            card.className = 'action-card trade-card';
            card.innerHTML = `<div class="card-header"><h3>${trade.name}</h3></div>
                <div class="card-body"><p>Rate: 1 ${trade.from} = ${trade.rate} ${trade.to}</p>
                <div class="trade-btns">
                    <button class="primary-btn" onclick="Sovereign.trade('${trade.id}', 10)">x10</button>
                    <button class="primary-btn" onclick="Sovereign.trade('${trade.id}', 100)">x100</button>
                </div></div>`;
            container.appendChild(card);
        });
    };

    const renderCommanders = () => {
        const container = document.getElementById('commander-list');
        container.innerHTML = '';
        for (let id in config.commanders) {
            const c = config.commanders[id];
            const owned = state.commanders.includes(id);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${c.name}</h3>${owned?'<span class="card-badge">Hired</span>':''}</div>
                <div class="card-body"><p>${c.effect}</p><div class="cost-row">${renderCosts(c.cost)}</div>
                <button class="primary-btn" ${owned||!canAfford(c.cost)?'disabled':''} onclick="Sovereign.hireCommander('${id}')">${owned?'Hired':'Hire'}</button></div>`;
            container.appendChild(card);
        }
    };

    const renderCampaign = () => {
        const map = document.getElementById('campaign-map');
        map.innerHTML = '';
        state.regions.forEach(r => {
            const card = document.createElement('div');
            card.className = 'region-card';
            card.innerHTML = `<h3>${r.name}</h3><p>Def: ${r.difficulty}</p><p>${r.captured?'Status: Captured':'Status: Hostile'}</p>
                <button class="primary-btn" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">${r.captured?'Secured':'Deploy Force'}</button>`;
            map.appendChild(card);
        });
    };

    const renderTech = () => {
        const container = document.getElementById('tech-list');
        container.innerHTML = '';
        config.tech.forEach(t => {
            const owned = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${t.name}</h3>${owned?'<span class="card-badge">Owned</span>':''}</div>
                <div class="card-body"><p>${t.effect}</p><div class="cost-row">${renderCosts(t.cost)}</div>
                <button class="primary-btn" ${owned||!canAfford(t.cost)?'disabled':''} onclick="Sovereign.research('${t.id}')">Research</button></div>`;
            container.appendChild(card);
        });
    };

    const renderPrestige = () => {
        document.getElementById('legacy-points').innerText = state.legacyPoints;
        document.getElementById('prod-mult').innerText = state.modifiers.production.toFixed(2) + 'x';
        document.getElementById('combat-bonus').innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
    };

    const triggerEvent = () => {
        const ev = events[Math.floor(Math.random() * events.length)];
        document.getElementById('event-title').innerText = ev.title;
        document.getElementById('event-desc').innerText = ev.desc;
        const opts = document.getElementById('event-options');
        opts.innerHTML = '';
        ev.options.forEach(o => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = o.text;
            btn.onclick = () => {
                o.action();
                document.getElementById('event-overlay').style.display = 'none';
                state.nextEventTime = Date.now() + 180000; // 3 min
                render();
            };
            opts.appendChild(btn);
        });
        document.getElementById('event-overlay').style.display = 'flex';
    };

    // --- Actions ---
    const buyBuilding = (id) => {
        const b = config.buildings[id];
        const cost = calcCost(b.baseCost, state.buildings[id]);
        if (canAfford(cost)) { pay(cost); state.buildings[id]++; render(); }
    };

    const recruitUnit = (id) => {
        const cost = config.units[id].baseCost;
        if (canAfford(cost)) { pay(cost); state.units[id]++; render(); }
    };

    const trade = (id, amt) => {
        const t = config.trades.find(x => x.id === id);
        if (state.resources[t.from] >= amt) {
            state.resources[t.from] -= amt;
            state.resources[t.to] += amt * t.rate;
            render();
        }
    };

    const hireCommander = (id) => {
        const c = config.commanders[id];
        if (canAfford(c.cost)) {
            pay(c.cost);
            state.commanders.push(id);
            if (c.combat) state.modifiers.combat += c.combat;
            if (c.production) state.modifiers.production += c.production;
            render();
        }
    };

    const research = (id) => {
        const t = config.tech.find(x => x.id === id);
        if (canAfford(t.cost)) { pay(t.cost); state.tech.push(id); render(); }
    };

    const attack = (rid) => {
        const r = state.regions.find(x => x.id === rid);
        const power = getTotalPower();
        if (power >= r.difficulty * 40) {
            r.captured = true;
            Sovereign.notify(`Success! ${r.name} captured.`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.75);
            Sovereign.notify(`Defeat at ${r.name}. 25% losses.`);
        }
        render();
    };

    const prestige = () => {
        const gain = Math.floor(state.resources.gold / 2000);
        if (gain < 1) return alert("Needs 2000 Gold.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.1);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.05);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50 };
        state.buildings = { farm: 0, woodcutter: 0, quarry: 0, foundry: 0, market: 0 };
        state.units = { infantry: 0, archer: 0, cavalry: 0, siege: 0 };
        state.tech = []; state.commanders = []; state.clickLvl = 1;
        state.regions.forEach(r => r.captured = false);
        save(); render();
    };

    // --- Helpers ---
    const calcCost = (base, count) => {
        const cost = {};
        for (let r in base) cost[r] = Math.floor(base[r] * Math.pow(1.2, count));
        return cost;
    };
    const canAfford = (costs) => {
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };
    const pay = (costs) => { for (let r in costs) state.resources[r] -= costs[r]; };
    const getTotalPower = () => {
        let p = 0;
        for (let id in state.units) p += state.units[id] * config.units[id].power;
        return p * state.modifiers.combat;
    };
    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        const d = document.createElement('div');
        d.innerText = msg;
        entries.prepend(d);
    };

    const save = () => localStorage.setItem('sov_piss_save_v3', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_piss_save_v3');
        if (s) {
            const p = JSON.parse(s);
            state = { ...state, ...p };
            state.lastUpdate = Date.now();
        }
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, hireCommander, research, attack, notify };
})();

window.onload = Sovereign.init;
