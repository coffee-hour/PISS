/**
 * Sovereign: Imperium Simulator
 * Core Logic & State Management
 */

const CF_API_TOKEN = "";
const CF_ACCOUNT_ID = "";

const Sovereign = (() => {
    // --- Initial State ---
    let state = {
        resources: { food: 100, wood: 100, ore: 50, gold: 50 },
        buildings: { farm: 0, woodcutter: 0, quarry: 0, foundry: 0, market: 0 },
        units: { infantry: 0, archer: 0, cavalry: 0, siege: 0 },
        commanders: [],
        tech: [],
        era: 0,
        legacyPoints: 0,
        modifiers: { production: 1.0, combat: 1.0 },
        regions: [
            { id: 'outpost_1', name: 'West Outpost', difficulty: 1, captured: false, tribute: { gold: 0.1, food: 0.2 } },
            { id: 'outpost_2', name: 'Iron Ridge', difficulty: 5, captured: false, tribute: { ore: 0.3, wood: 0.2 } },
            { id: 'fort_1', name: 'Azure Fortress', difficulty: 25, captured: false, tribute: { gold: 0.5, wood: 0.5 } },
            { id: 'fort_2', name: 'Black Keep', difficulty: 100, captured: false, tribute: { ore: 1.5, gold: 1.0 } },
            { id: 'capital', name: 'Imperial Capital', difficulty: 500, captured: false, tribute: { gold: 5.0, food: 5.0, wood: 5.0, ore: 5.0 } }
        ],
        lastUpdate: Date.now()
    };

    // --- Configuration ---
    const config = {
        eras: ["Age of Discovery", "Feudal Age", "Imperial Age", "Industrial Age", "Space Age"],
        buildings: {
            farm: { name: "Farm", res: "food", baseCost: { wood: 10, food: 5 }, prod: 1.5 },
            woodcutter: { name: "Woodcutter's Lodge", res: "wood", baseCost: { food: 10, wood: 5 }, prod: 1.2 },
            quarry: { name: "Quarry", res: "ore", baseCost: { wood: 30, ore: 5 }, prod: 1.0 },
            foundry: { name: "Foundry", res: "ore", baseCost: { wood: 60, ore: 30 }, prod: 2.5 },
            market: { name: "Market", res: "gold", baseCost: { wood: 50, gold: 20 }, prod: 0.5 }
        },
        units: {
            infantry: { name: "Infantry", baseCost: { food: 50, ore: 10 }, power: 10, upkeep: { food: 0.5 } },
            archer: { name: "Archer", baseCost: { food: 30, wood: 40 }, power: 15, upkeep: { food: 0.4 } },
            cavalry: { name: "Cavalry", baseCost: { food: 100, ore: 50, gold: 20 }, power: 50, upkeep: { food: 2, gold: 0.5 } },
            siege: { name: "Siege Engine", baseCost: { wood: 200, ore: 150, gold: 100 }, power: 200, upkeep: { gold: 5 } }
        },
        commanders: {
            legatus: { name: "Legatus", cost: { gold: 500 }, perk: "Legion Mastery", effect: "+20% Combat Strength", combat: 0.2 },
            tactician: { name: "Master Tactician", cost: { gold: 750 }, perk: "Efficiency Sweep", effect: "+15% Global Production", production: 0.15 },
            spymaster: { name: "Spymaster", cost: { gold: 1000 }, perk: "Shadow Tribute", effect: "+50% Region Tribute Rates", tribute: 0.5 }
        },
        tech: [
            { id: 'metallurgy', name: 'Advanced Metallurgy', cost: { ore: 200, gold: 100 }, effect: 'Unlock Cavalry & +20% Ore boost' },
            { id: 'logistics', name: 'Supply Logistics', cost: { food: 500, gold: 200 }, effect: '-25% Upkeep costs' },
            { id: 'tax_auto', name: 'Empire Tax Automation', cost: { gold: 2000, ore: 500 }, effect: 'Passive Gold boost based on total buildings' },
            { id: 'logistical_overhaul', name: 'Logistical Overhaul', cost: { wood: 1500, gold: 1000 }, effect: '+30% Global Production' }
        ]
    };

    const init = () => {
        load();
        setupNavigation();
        render();
        startLoops();
    };

    const setupNavigation = () => {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
        document.getElementById('prestige-btn').addEventListener('click', prestige);
    };

    const startLoops = () => {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - state.lastUpdate) / 1000;
            state.lastUpdate = now;
            update(delta);
        }, 100);
        setInterval(save, 5000);
    };

    const update = (delta) => {
        // Building Production
        for (const [id, count] of Object.entries(state.buildings)) {
            const b = config.buildings[id];
            const amount = b.prod * count * delta * state.modifiers.production;
            state.resources[b.res] += amount;
        }

        // Region Tributes
        const tributeMult = state.commanders.includes('spymaster') ? 1.5 : 1.0;
        state.regions.filter(r => r.captured).forEach(region => {
            for (const [res, amt] of Object.entries(region.tribute)) {
                state.resources[res] += amt * delta * tributeMult;
            }
        });

        // Unit Upkeep
        const upkeepMult = state.tech.includes('logistics') ? 0.75 : 1.0;
        for (const [id, count] of Object.entries(state.units)) {
            const unit = config.units[id];
            for (const [res, amt] of Object.entries(unit.upkeep)) {
                state.resources[res] = Math.max(0, state.resources[res] - (amt * count * delta * upkeepMult));
            }
        }

        renderResources();
    };

    const render = () => {
        renderResources();
        renderCiv();
        renderMilitary();
        renderCommanders();
        renderCampaign();
        renderTech();
        renderPrestige();
        document.getElementById('current-era').innerText = config.eras[state.era] || "Ascended";
    };

    const renderResources = () => {
        for (const res in state.resources) {
            const pill = document.getElementById(`res-${res}`);
            if (pill) {
                pill.querySelector('.res-value').innerText = Math.floor(state.resources[res]).toLocaleString();
                let rate = 0;
                for (const b in state.buildings) if (config.buildings[b].res === res) rate += config.buildings[b].prod * state.buildings[b];
                state.regions.filter(r => r.captured).forEach(r => { if(r.tribute[res]) rate += r.tribute[res] * (state.commanders.includes('spymaster') ? 1.5 : 1.0); });
                pill.querySelector('.res-rate').innerText = `+${(rate * state.modifiers.production).toFixed(1)}/s`;
            }
        }
    };

    const renderCiv = () => {
        const container = document.getElementById('civ-buildings');
        container.innerHTML = '';
        for (const [id, b] of Object.entries(config.buildings)) {
            const count = state.buildings[id];
            const cost = calculateCost(b.baseCost, count);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${b.name}</h3><span class="card-badge">Lv. ${count}</span></div>
                <div class="card-body"><p>Generates ${b.prod} ${b.res}/s.</p><div class="cost-row">${renderCosts(cost)}</div></div>`;
            card.onclick = () => buyBuilding(id);
            container.appendChild(card);
        }
    };

    const renderMilitary = () => {
        const container = document.getElementById('military-units');
        container.innerHTML = '';
        for (const [id, u] of Object.entries(config.units)) {
            const count = state.units[id];
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = `<div class="card-header"><h3>${u.name}</h3><span class="card-badge">${count} Armed</span></div>
                <div class="card-body"><p>Power: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v])=>`${v}${r[0]}`).join(', ')}</p>
                <div class="cost-row">${renderCosts(u.baseCost)}</div></div>`;
            card.onclick = () => recruitUnit(id);
            container.appendChild(card);
        }
    };

    const renderCommanders = () => {
        const container = document.getElementById('commander-list');
        container.innerHTML = '';
        for (const [id, c] of Object.entries(config.commanders)) {
            const hired = state.commanders.includes(id);
            const card = document.createElement('div');
            card.className = 'action-card';
            if (hired) card.style.opacity = '0.7';
            card.innerHTML = `<div class="card-header"><h3>${c.name}</h3>${hired ? '<span class="card-badge">Hired</span>':''}</div>
                <div class="card-body"><p><strong>${c.perk}:</strong> ${c.effect}</p>${hired ? '' : `<div class="cost-row">${renderCosts(c.cost)}</div>`}</div>`;
            if (!hired) card.onclick = () => hireCommander(id);
            container.appendChild(card);
        }
    };

    const renderCampaign = () => {
        const map = document.getElementById('campaign-map');
        map.innerHTML = '';
        state.regions.forEach(region => {
            const card = document.createElement('div');
            card.className = 'region-card';
            card.innerHTML = `<div class="region-status ${region.captured ? 'status-captured' : 'status-hostile'}">${region.captured ? 'Captured' : 'Hostile'}</div>
                <h3>${region.name}</h3><p>Def: ${region.difficulty}</p>
                <div class="tribute-info">Tribute: ${Object.entries(region.tribute).map(([r,v])=>`+${v}${r[0]}`).join(', ')}/s</div>
                <button class="primary-btn" ${region.captured ? 'disabled' : ''}>Deploy Force</button>`;
            card.querySelector('button').onclick = () => attackRegion(region);
            map.appendChild(card);
        });
    };

    const attackRegion = (region) => {
        let power = 0;
        for (const [id, count] of Object.entries(state.units)) power += count * config.units[id].power;
        power *= state.modifiers.combat;
        
        const log = document.getElementById('log-entries');
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        if (power >= region.difficulty * 40) {
            region.captured = true;
            entry.innerHTML = `<span style="color:var(--success)">Victory!</span> ${region.name} secured. Tributes started.`;
            render();
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            entry.innerHTML = `<span style="color:var(--danger)">Defeat!</span> Forces repelled at ${region.name}. 30% losses.`;
            render();
        }
        log.appendChild(entry);
    };

    const renderTech = () => {
        const container = document.getElementById('tech-list');
        container.innerHTML = '';
        config.tech.forEach(t => {
            const res = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'action-card';
            if (res) card.style.opacity = '0.5';
            card.innerHTML = `<div class="card-header"><h3>${t.name}</h3>${res ? '<span class="card-badge">Applied</span>':''}</div>
                <div class="card-body"><p>${t.effect}</p>${res ? '' : `<div class="cost-row">${renderCosts(t.cost)}</div>`}</div>`;
            if (!res) card.onclick = () => research(t.id);
            container.appendChild(card);
        });
    };

    const renderPrestige = () => {
        document.getElementById('legacy-points').innerText = state.legacyPoints;
        document.getElementById('prod-mult').innerText = state.modifiers.production.toFixed(2) + 'x';
        document.getElementById('combat-bonus').innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
    };

    const buyBuilding = (id) => {
        const count = state.buildings[id];
        const cost = calculateCost(config.buildings[id].baseCost, count);
        if (canAfford(cost)) { pay(cost); state.buildings[id]++; render(); }
    };

    const recruitUnit = (id) => {
        const cost = config.units[id].baseCost;
        if (canAfford(cost)) { pay(cost); state.units[id]++; render(); }
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
        if (canAfford(t.cost)) {
            pay(t.cost);
            state.tech.push(id);
            if (id === 'tactics') state.modifiers.combat += 0.2;
            if (id === 'logistical_overhaul') state.modifiers.production += 0.3;
            render();
        }
    };

    const prestige = () => {
        const gain = Math.floor(state.resources.gold / 2000) + state.era;
        if (gain < 1) return alert("Requires at least 2000 gold.");
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.15);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.08);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50 };
        state.buildings = { farm: 0, woodcutter: 0, quarry: 0, foundry: 0, market: 0 };
        state.units = { infantry: 0, archer: 0, cavalry: 0, siege: 0 };
        state.tech = [];
        state.commanders = [];
        state.regions.forEach(r => r.captured = false);
        render();
        save();
    };

    const calculateCost = (base, count) => {
        const cost = {};
        for (const r in base) cost[r] = Math.floor(base[r] * Math.pow(1.18, count));
        return cost;
    };

    const renderCosts = (costs) => {
        let h = '';
        for (const r in costs) {
            const aff = state.resources[r] >= costs[r];
            h += `<span class="cost-tag ${aff ? 'affordable' : ''}">${costs[r]} ${r}</span>`;
        }
        return h;
    };

    const canAfford = (costs) => {
        for (const r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };

    const pay = (costs) => { for (const r in costs) state.resources[r] -= costs[r]; };

    const save = () => localStorage.setItem('sov_save_v2', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_save_v2');
        if (s) {
            const parsed = JSON.parse(s);
            state = { ...state, ...parsed };
            state.lastUpdate = Date.now();
        }
    };

    return { init };
})();

window.onload = Sovereign.init;
