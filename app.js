/**
 * Sovereign: Imperium Simulator
 * Core Logic & State Management
 */

const CF_API_TOKEN = "";
const CF_ACCOUNT_ID = "";

const Sovereign = (() => {
    // --- Initial State ---
    let state = {
        resources: {
            food: 100,
            wood: 100,
            ore: 50,
            gold: 50
        },
        buildings: {
            farm: 0,
            quarry: 0,
            foundry: 0,
            market: 0
        },
        units: {
            infantry: 0,
            archer: 0,
            cavalry: 0,
            siege: 0
        },
        tech: [],
        era: 0,
        legacyPoints: 0,
        modifiers: {
            production: 1.0,
            combat: 1.0
        },
        regions: [
            { id: 'outpost_1', name: 'West Outpost', difficulty: 1, captured: false, reward: { prod: 0.05 } },
            { id: 'outpost_2', name: 'Iron Ridge', difficulty: 3, captured: false, reward: { prod: 0.1 } },
            { id: 'fort_1', name: 'Azure Fortress', difficulty: 10, captured: false, reward: { prod: 0.25 } },
            { id: 'fort_2', name: 'Black Keep', difficulty: 25, captured: false, reward: { prod: 0.5 } },
            { id: 'capital', name: 'Imperial Capital', difficulty: 100, captured: false, reward: { prod: 1.0 } }
        ],
        lastUpdate: Date.now()
    };

    // --- Configuration ---
    const config = {
        eras: ["Age of Discovery", "Feudal Age", "Imperial Age", "Industrial Age", "Space Age"],
        buildings: {
            farm: { name: "Farm", res: "food", baseCost: { wood: 10, food: 5 }, prod: 1 },
            quarry: { name: "Quarry", res: "wood", baseCost: { wood: 15, ore: 5 }, prod: 0.8 },
            foundry: { name: "Foundry", res: "ore", baseCost: { wood: 30, ore: 15 }, prod: 0.5 },
            market: { name: "Market", res: "gold", baseCost: { wood: 50, gold: 20 }, prod: 0.2 }
        },
        units: {
            infantry: { name: "Infantry", baseCost: { food: 50, ore: 10 }, power: 10, upkeep: { food: 0.5 } },
            archer: { name: "Archer", baseCost: { food: 30, wood: 40 }, power: 15, upkeep: { food: 0.4 } },
            cavalry: { name: "Cavalry", baseCost: { food: 100, ore: 50, gold: 20 }, power: 45, upkeep: { food: 2, gold: 0.5 } },
            siege: { name: "Siege Engine", baseCost: { wood: 200, ore: 150, gold: 100 }, power: 150, upkeep: { gold: 5 } }
        },
        tech: [
            { id: 'metallurgy', name: 'Advanced Metallurgy', cost: { ore: 200, gold: 100 }, effect: 'Unlock Cavalry & 20% Ore boost' },
            { id: 'logistics', name: 'Supply Logistics', cost: { food: 500, gold: 200 }, effect: '-25% Upkeep costs' },
            { id: 'tactics', name: 'Squad Tactics', cost: { wood: 300, gold: 150 }, effect: '+20% Combat Strength' }
        ]
    };

    // --- Core Methods ---
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

        setInterval(save, 10000);
    };

    const update = (delta) => {
        // Production logic
        for (const [id, count] of Object.entries(state.buildings)) {
            const building = config.buildings[id];
            const amount = building.prod * count * delta * state.modifiers.production;
            state.resources[building.res] += amount;
        }

        // Upkeep logic
        for (const [id, count] of Object.entries(state.units)) {
            const unit = config.units[id];
            for (const [res, amt] of Object.entries(unit.upkeep)) {
                state.resources[res] -= amt * count * delta;
                if (state.resources[res] < 0) state.resources[res] = 0; // Penalize?
            }
        }

        renderResources();
    };

    const render = () => {
        renderResources();
        renderCiv();
        renderMilitary();
        renderCampaign();
        renderTech();
        renderPrestige();
        document.getElementById('current-era').innerText = config.eras[state.era] || "End of Time";
    };

    const renderResources = () => {
        for (const res in state.resources) {
            const pill = document.getElementById(`res-${res}`);
            if (pill) {
                pill.querySelector('.res-value').innerText = Math.floor(state.resources[res]).toLocaleString();
                // Calc Rate
                let rate = 0;
                for (const b in state.buildings) {
                    if (config.buildings[b].res === res) rate += config.buildings[b].prod * state.buildings[b];
                }
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
            card.innerHTML = `
                <div class="card-header">
                    <h3>${b.name}</h3>
                    <span class="card-badge">Lv. ${count}</span>
                </div>
                <div class="card-body">
                    <p>Increases ${b.res} production.</p>
                    <div class="cost-row">${renderCosts(cost)}</div>
                </div>
            `;
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
            card.innerHTML = `
                <div class="card-header">
                    <h3>${u.name}</h3>
                    <span class="card-badge">${count} Armed</span>
                </div>
                <div class="card-body">
                    <p>Strength: ${u.power} | Upkeep: ${Object.entries(u.upkeep).map(([r,v]) => `${v}${r[0]}`).join(', ')}</p>
                    <div class="cost-row">${renderCosts(u.baseCost)}</div>
                </div>
            `;
            card.onclick = () => recruitUnit(id);
            container.appendChild(card);
        }
    };

    const renderCampaign = () => {
        const map = document.getElementById('campaign-map');
        map.innerHTML = '';
        state.regions.forEach(region => {
            const card = document.createElement('div');
            card.className = 'region-card';
            card.innerHTML = `
                <div class="region-status ${region.captured ? 'status-captured' : 'status-hostile'}">
                    ${region.captured ? 'Captured' : 'Hostile'}
                </div>
                <h3>${region.name}</h3>
                <p>Defense Level: ${region.difficulty}</p>
                <button class="primary-btn" ${region.captured ? 'disabled' : ''}>Deploy Force</button>
            `;
            card.querySelector('button').onclick = () => attackRegion(region);
            map.appendChild(card);
        });
    };

    const attackRegion = (region) => {
        let totalPower = 0;
        for (const [id, count] of Object.entries(state.units)) {
            totalPower += count * config.units[id].power;
        }
        totalPower *= state.modifiers.combat;

        const logEntries = document.getElementById('log-entries');
        const log = document.createElement('div');
        log.className = 'log-entry';

        if (totalPower > region.difficulty * 50) {
            region.captured = true;
            state.modifiers.production += region.reward.prod;
            log.innerText = `Success! ${region.name} has fallen. Production increased by ${region.reward.prod * 100}%.`;
            render();
        } else {
            // Lose units?
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.8);
            log.innerText = `Defeat at ${region.name}. Our forces were repelled. 20% casualties sustained.`;
            render();
        }
        logEntries.prepend(log);
    };

    const renderTech = () => {
        const container = document.getElementById('tech-list');
        container.innerHTML = '';
        config.tech.forEach(t => {
            const researched = state.tech.includes(t.id);
            const card = document.createElement('div');
            card.className = 'action-card';
            if (researched) card.style.opacity = '0.5';
            card.innerHTML = `
                <div class="card-header">
                    <h3>${t.name}</h3>
                    ${researched ? '<span class="card-badge">Researched</span>' : ''}
                </div>
                <div class="card-body">
                    <p>${t.effect}</p>
                    <div class="cost-row">${researched ? '' : renderCosts(t.cost)}</div>
                </div>
            `;
            if (!researched) card.onclick = () => research(t.id);
            container.appendChild(card);
        });
    };

    const renderPrestige = () => {
        document.getElementById('legacy-points').innerText = state.legacyPoints;
        document.getElementById('prod-mult').innerText = state.modifiers.production.toFixed(2) + 'x';
        document.getElementById('combat-bonus').innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
    };

    // Helpers
    const calculateCost = (base, count) => {
        const cost = {};
        for (const r in base) cost[r] = Math.floor(base[r] * Math.pow(1.15, count));
        return cost;
    };

    const renderCosts = (costs) => {
        let html = '';
        for (const r in costs) {
            const affordable = state.resources[r] >= costs[r];
            html += `<span class="cost-tag ${affordable ? 'affordable' : ''}">${costs[r]} ${r}</span>`;
        }
        return html;
    };

    const buyBuilding = (id) => {
        const cost = calculateCost(config.buildings[id].baseCost, state.buildings[id]);
        if (canAfford(cost)) {
            pay(cost);
            state.buildings[id]++;
            render();
        }
    };

    const recruitUnit = (id) => {
        const cost = config.units[id].baseCost;
        if (canAfford(cost)) {
            pay(cost);
            state.units[id]++;
            render();
        }
    };

    const research = (id) => {
        const t = config.tech.find(x => x.id === id);
        if (canAfford(t.cost)) {
            pay(t.cost);
            state.tech.push(id);
            if (id === 'tactics') state.modifiers.combat += 0.2;
            render();
        }
    };

    const prestige = () => {
        const gain = Math.floor(state.resources.gold / 1000) + state.era;
        if (gain < 1) return alert("Not enough gold or progress to start a new Dynasty!");
        
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.1);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.05);

        // Reset
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50 };
        state.buildings = { farm: 0, quarry: 0, foundry: 0, market: 0 };
        state.units = { infantry: 0, archer: 0, cavalry: 0, siege: 0 };
        state.tech = [];
        state.regions.forEach(r => r.captured = false);
        render();
        save();
    };

    const canAfford = (costs) => {
        for (const r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };

    const canPay = (costs) => {
         for (const r in costs) if (state.resources[r] < costs[r]) return false;
         return true;
    };

    const pay = (costs) => {
        for (const r in costs) state.resources[r] -= costs[r];
    };

    const save = () => localStorage.setItem('sov_save', JSON.stringify(state));
    const load = () => {
        const saved = localStorage.getItem('sov_save');
        if (saved) state = JSON.parse(saved);
    };

    return { init };
})();

window.onload = Sovereign.init;
