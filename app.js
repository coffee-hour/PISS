/**
 * Sovereign: Imperium Simulator - Sovereign Engine (UX Overhaul & Functional Audit)
 */

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
            { id: 'r1', name: 'Grain Sector', difficulty: 1, captured: false, tribute: { food: 0.8 } },
            { id: 'r2', name: 'Carbon Ridge', difficulty: 5, captured: false, tribute: { wood: 0.8 } },
            { id: 'r3', name: 'Mineral Veins', difficulty: 25, captured: false, tribute: { ore: 1.2 } },
            { id: 'r4', name: 'Merchant Hub', difficulty: 150, captured: false, tribute: { gold: 1.5 } }
        ],
        lastUpdate: Date.now()
    };

    const config = {
        eras: ["Age of Discovery", "Feudal Age", "Imperial Age", "Industrial Age", "Space Age"],
        buildings: {
            farm: { id: 'farm', name: "Bio-Reactor", res: "food", baseCost: { wood: 10, food: 5 }, prod: 1.5, icon: 'factory', desc: 'Synthesizes biomass for civilian consumption.' },
            woodcutter: { id: 'woodcutter', name: "Carbon Extractor", res: "wood", baseCost: { food: 10, wood: 5 }, prod: 1.2, icon: 'drill', desc: 'Harvests structural carbon from local flora.' },
            quarry: { id: 'quarry', name: "Mineral Sifter", res: "ore", baseCost: { wood: 30, ore: 5 }, prod: 1.0, icon: 'pickaxe', desc: 'Filters rare earth minerals from topsoil.' },
            foundry: { id: 'foundry', name: "High Smelter", res: "ore", baseCost: { wood: 100, ore: 50 }, prod: 4.0, icon: 'flame', desc: 'Refines base minerals into high-grade alloys.' },
            market: { id: 'market', name: "Global Exchange", res: "gold", baseCost: { wood: 150, gold: 60, food: 100, ore: 80 }, prod: 0.8, icon: 'landmark', desc: 'Standardizes currency across the empire.' }
        },
        units: {
            infantry: { name: "Steel Guard", baseCost: { food: 60, ore: 15 }, power: 15, upkeep: { food: 0.6 }, icon: 'user', desc: 'Standard tactical response unit.' },
            archer: { name: "Stalker Unit", baseCost: { food: 45, wood: 65 }, power: 22, upkeep: { food: 0.5 }, icon: 'crosshair', desc: 'Long-range suppression specialists.' },
            cavalry: { name: "Viper Division", baseCost: { food: 120, ore: 60, gold: 30 }, power: 85, upkeep: { food: 2.5, gold: 0.8 }, icon: 'zap', desc: 'High-speed armored interceptors.' },
            siege: { name: "Breach Titan", baseCost: { wood: 500, ore: 400, gold: 200 }, power: 450, upkeep: { gold: 10 }, icon: 'bomb', desc: 'Heavy structural demolition platform.' }
        },
        commanders: {
            legatus: { id: 'legatus', name: "Legatus Vane", cost: { gold: 500 }, effect: "+20% Power", combat: 0.2, icon: 'shield', desc: 'Veteran of the Core Wars. Specializes in frontline offensive.' },
            tactician: { id: 'tactician', name: "High Strategist", cost: { gold: 750 }, effect: "+15% Prod", production: 0.15, icon: 'brain', desc: 'Grandmaster of logistics and resource efficiency.' },
            spymaster: { id: 'spymaster', name: "Shadow Hand", cost: { gold: 1200 }, effect: "+50% Tribute", tribute: 0.5, icon: 'eye', desc: 'Oversees the shadow network to maximize sector yields.' }
        },
        techTree: [
            { tier: 1, id: 't1', name: 'Advanced Metallurgy', cost: { ore: 100 }, effect: 'Unlock High-Temp Forging', parents: [], icon: 'database', desc: 'Improves atomic bonding in refined ores.' },
            { tier: 1, id: 't2', name: 'Agrarian Reform', cost: { food: 200 }, effect: '+15% Production', parents: [], icon: 'leaf', desc: 'Implements efficient soil cycling protocols.' },
            { tier: 2, id: 't3', name: 'High-Temp Forging', cost: { ore: 300, gold: 100 }, effect: 'Unlock Viper Units', parents: ['t1'], icon: 'flame', desc: 'Required for advanced hull synthesis.' },
            { tier: 2, id: 't4', name: 'Logistics Protocol', cost: { wood: 500, gold: 200 }, effect: '-20% Upkeep', parents: ['t2'], icon: 'package', desc: 'Optimizes supply chains for field units.' },
            { tier: 3, id: 't5', name: 'Imperial Hegemony', cost: { gold: 1000, ore: 500 }, effect: '+30% Global Power', parents: ['t3', 't4'], icon: 'globe', desc: 'Establishes absolute tactical dominance.' }
        ],
        trades: [
            { id: 'f_to_g', name: 'Biomass Liquidation', from: 'food', rate: 0.15, icon: 'apple', desc: 'Sell excess biomass for credits.' },
            { id: 'w_to_g', name: 'Carbon Exchange', from: 'wood', rate: 0.25, icon: 'trees', desc: 'Sell raw carbon for credits.' },
            { id: 'o_to_g', name: 'Mineral Arbitrage', from: 'ore', rate: 0.50, icon: 'mountain', desc: 'Sell base minerals for credits.' }
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
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = document.getElementById(`tab-${tab}`);
                if (targetTab) targetTab.classList.add('active');
                render();
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
        const tributeMult = state.commanders.includes('spymaster') ? 1.5 : 1.0;
        state.regions.filter(r => r.captured).forEach(r => {
            for (let res in r.tribute) state.resources[res] += r.tribute[res] * delta * state.modifiers.production * tributeMult;
        });
        const upkeepMult = state.tech.includes('t4') ? 0.8 : 1.0;
        for (let id in state.units) {
            const u = config.units[id];
            for (let res in u.upkeep) state.resources[res] = Math.max(0, state.resources[res] - (u.upkeep[res] * state.units[id] * delta * upkeepMult));
        }
        renderResourcesOnly();
        renderAffordability();
    };

    const render = () => {
        renderResourcesOnly();
        renderCiv();
        renderBarracks();
        renderMarket();
        renderCommanders();
        renderCampaign();
        renderTechTree();
        renderPrestige();
        const eraEl = document.getElementById('current-era');
        if (eraEl) eraEl.innerText = config.eras[state.era] || "Divine Sovereignty";
        lucide.createIcons();
    };

    const renderResourcesOnly = () => {
        for (let res in state.resources) {
            const pill = document.getElementById(`res-${res}`);
            if (pill) {
                const valEl = pill.querySelector('.res-value');
                const rateEl = pill.querySelector('.res-rate');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
            }
        }
    };

    const renderAffordability = () => {
        // Decree Affordability
        const upBtn = document.getElementById('upgrade-click-btn');
        const upgradeCost = Math.floor(100 * Math.pow(1.5, state.clickLvl - 1));
        if (upBtn) upBtn.disabled = state.resources.gold < upgradeCost;

        // Building Affordability
        for (let id in config.buildings) {
            const btn = document.querySelector(`[onclick="Sovereign.buyBuilding('${id}')"]`);
            if (btn) {
                const cost = calcCost(config.buildings[id].baseCost, state.buildings[id]);
                btn.disabled = !canAfford(cost);
            }
        }

        // Unit Affordability
        for (let id in config.units) {
            const btn = document.querySelector(`[onclick="Sovereign.recruitUnit('${id}')"]`);
            if (btn) btn.disabled = !canAfford(config.units[id].baseCost);
        }

        // Commander Affordability
        for (let id in config.commanders) {
            const btn = document.querySelector(`[onclick="Sovereign.hireCommander('${id}')"]`);
            if (btn) btn.disabled = state.commanders.includes(id) || !canAfford(config.commanders[id].cost);
        }

        // Prestige Affordability
        const presBtn = document.getElementById('prestige-btn');
        if (presBtn) {
            const gain = Math.floor(state.resources.gold / 2000);
            presBtn.disabled = gain < 1;
        }
    };

    const renderCiv = () => {
        const lvlEl = document.getElementById('click-lvl');
        const powEl = document.getElementById('click-power');
        const upBtn = document.getElementById('upgrade-click-btn');
        if (lvlEl) lvlEl.innerText = `Lvl ${state.clickLvl}`;
        if (powEl) powEl.innerText = state.clickLvl;
        const upgradeCost = Math.floor(100 * Math.pow(1.5, state.clickLvl - 1));
        if (upBtn) upBtn.innerText = `Upgrade Hub (${upgradeCost} Credits)`;

        const container = document.getElementById('civ-buildings');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.buildings) {
            const b = config.buildings[id];
            const count = state.buildings[id];
            const cost = calcCost(b.baseCost, count);
            const card = document.createElement('div');
            card.className = 'hub-card';
            card.innerHTML = `
                <div class="hub-header"><h3><i data-lucide="${b.icon}" size="16"></i> ${b.name}</h3><span class="card-badge">Lv ${count}</span></div>
                <div class="card-body">
                    <p class="desc-text">${b.desc}</p>
                    <p class="yield-text">Yield: +${b.prod} ${b.res}/s</p>
                    <div class="cost-row">${renderCosts(cost)}</div>
                    <button class="terminal-btn" onclick="Sovereign.buyBuilding('${id}')">Authorize</button>
                </div>`;
            container.appendChild(card);
        }
    };

    const renderBarracks = () => {
        const container = document.getElementById('military-units');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.units) {
            const u = config.units[id];
            const count = state.units[id];
            const card = document.createElement('div');
            card.className = 'personnel-file';
            card.innerHTML = `
                <div class="file-header"><span><i data-lucide="${u.icon}" size="16"></i> ${u.name}</span><span>[${count}]</span></div>
                <div class="file-body">
                    <p class="desc-text">${u.desc}</p>
                    <div class="stat-meter"><div class="meter-label">Unit Power <span>${u.power}</span></div><div class="meter-bar"><div class="meter-fill" style="width: ${Math.min(100, u.power/4.5)}%"></div></div></div>
                    <div class="cost-row">${renderCosts(u.baseCost)}</div>
                    <button class="terminal-btn" onclick="Sovereign.recruitUnit('${id}')">Draft</button>
                </div>`;
            container.appendChild(card);
        }
    };

    const renderMarket = () => {
        const container = document.getElementById('market-grid');
        if (!container) return;
        container.innerHTML = '';
        config.trades.forEach(t => {
            const card = document.createElement('div');
            card.className = 'trade-strip';
            card.innerHTML = `
                <div class="trade-label"><i data-lucide="${t.icon}" size="14"></i> ${t.name}</div>
                <div class="trade-rate-view">1 ${t.from} @ ${t.rate} Credits</div>
                <div class="trade-actions">
                    <button class="terminal-btn" onclick="Sovereign.trade('${t.id}', 10)">x10</button>
                    <button class="terminal-btn" onclick="Sovereign.trade('${t.id}', 100)">x100</button>
                </div>`;
            container.appendChild(card);
        });
    };

    const renderCommanders = () => {
        const container = document.getElementById('commander-list');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.commanders) {
            const c = config.commanders[id];
            const owned = state.commanders.includes(id);
            const card = document.createElement('div');
            card.className = 'hub-card';
            card.innerHTML = `
                <div class="hub-header"><h3><i data-lucide="${c.icon}" size="16"></i> ${c.name}</h3>${owned?'<span class="card-badge">Assigned</span>':''}</div>
                <div class="card-body">
                    <p class="desc-text">${c.desc}</p>
                    <p class="effect-text">Effect: ${c.effect}</p>
                    <div class="cost-row">${renderCosts(c.cost)}</div>
                    <button class="terminal-btn" onclick="Sovereign.hireCommander('${id}')">${owned?'Active Duty':'Assign Seat'}</button>
                </div>`;
            container.appendChild(card);
        }
    };

    const renderCampaign = () => {
        const map = document.getElementById('campaign-map');
        if (!map) return;
        map.innerHTML = '';
        state.regions.forEach(r => {
            const card = document.createElement('div');
            card.className = 'sector-card';
            const progress = r.captured ? 100 : 0;
            const currentPower = getTotalPower();
            const powerRatio = Math.min(100, (currentPower / (r.difficulty * 45)) * 100);
            card.innerHTML = `
                <div class="sector-status"><span>Sector: ${r.name}</span><span>[${r.difficulty * 45} DEF]</span></div>
                <div class="meter-label">Force Readiness <span>${powerRatio.toFixed(0)}%</span></div>
                <div class="sector-progress"><div class="sector-fill" style="width: ${progress === 100 ? 100 : powerRatio}%"></div></div>
                <button class="terminal-btn" ${r.captured?'disabled':''} onclick="Sovereign.attack('${r.id}')">${r.captured?'Secured':'Deploy Force'}</button>`;
            map.appendChild(card);
        });
    };

    const renderTechTree = () => {
        const container = document.getElementById('tech-tree-view');
        if (!container) return;
        container.innerHTML = '';
        [1, 2, 3].forEach(tier => {
            const tierEl = document.createElement('div');
            tierEl.className = 'tech-tier';
            config.techTree.filter(t => t.tier === tier).forEach(tech => {
                const owned = state.tech.includes(tech.id);
                const unlockable = tech.parents.every(p => state.tech.includes(p));
                const node = document.createElement('div');
                node.className = `tech-node ${owned?'unlocked':unlockable?'unlockable':'locked'}`;
                node.innerHTML = `
                    <div class="node-title"><i data-lucide="${tech.icon}" size="14"></i> ${tech.name}</div>
                    <div class="node-effect">${tech.effect}</div>
                    <div class="node-cost">${owned?'<i data-lucide="check-circle" size="12"></i> COMPLETED':renderCosts(tech.cost)}</div>
                `;
                if (unlockable && !owned) node.onclick = () => Sovereign.research(tech.id);
                tierEl.appendChild(node);
            });
            container.appendChild(tierEl);
        });
    };

    const renderPrestige = () => {
        const legEl = document.getElementById('legacy-points');
        const prodEl = document.getElementById('prod-mult');
        const combEl = document.getElementById('combat-bonus');
        const gainEl = document.getElementById('prestige-btn');

        if (legEl) legEl.innerText = state.legacyPoints;
        if (prodEl) prodEl.innerText = state.modifiers.production.toFixed(2) + 'x';
        if (combEl) combEl.innerText = ((state.modifiers.combat - 1) * 100).toFixed(0) + '%';
        
        const gain = Math.floor(state.resources.gold / 2000);
        if (gainEl) gainEl.innerText = `Authorize Succession (+${gain} Legacy)`;
    };

    const manualGather = (res) => {
        state.resources[res] += state.clickLvl;
        const dial = document.getElementById('crank-dial');
        if (dial) dial.style.transform = `rotate(${Math.random() * 360}deg)`;
        renderResourcesOnly();
    };

    const upgradeClick = () => {
        const cost = Math.floor(100 * Math.pow(1.5, state.clickLvl - 1));
        if (state.resources.gold >= cost) {
            state.resources.gold -= cost;
            state.clickLvl++;
            Sovereign.notify(`DECREE SIGNED: MANUAL LABOR EFFICIENCY INCREASED TO LVL ${state.clickLvl}.`);
            render();
        }
    };

    const buyBuilding = (id) => {
        const b = config.buildings[id];
        const cost = calcCost(b.baseCost, state.buildings[id]);
        if (canAfford(cost)) { 
            pay(cost); 
            state.buildings[id]++; 
            Sovereign.notify(`CONSTRUCTION: ${b.name} ONLINE. NET OUTPUT INCREASED.`);
            render(); 
        }
    };
    const recruitUnit = (id) => {
        const u = config.units[id];
        if (canAfford(u.baseCost)) { 
            pay(u.baseCost); 
            state.units[id]++; 
            Sovereign.notify(`DEPLOYMENT: ${u.name} MOBILIZED TO GARRISON ALPHA.`);
            render(); 
        }
    };
    const trade = (id, amt) => {
        const t = config.trades.find(x => x.id === id);
        if (state.resources[t.from] >= amt) {
            state.resources[t.from] -= amt;
            state.resources.gold += amt * t.rate;
            Sovereign.notify(`TRADE: EXCHANGED ${amt} ${t.from.toUpperCase()} FOR ${(amt * t.rate).toFixed(1)} CREDITS.`);
            render();
        }
    };
    const hireCommander = (id) => {
        const c = config.commanders[id];
        if (canAfford(c.cost) && !state.commanders.includes(id)) {
            pay(c.cost);
            state.commanders.push(id);
            if (c.combat) state.modifiers.combat += c.combat;
            if (c.production) state.modifiers.production += c.production;
            Sovereign.notify(`ASSIGNMENT: ${c.name} HAS TAKEN A SEAT AT THE HIGH COMMAND.`);
            render();
        }
    };
    const research = (id) => {
        const tech = config.techTree.find(t => t.id === id);
        if (canAfford(tech.cost) && !state.tech.includes(id)) { 
            pay(tech.cost); 
            state.tech.push(id); 
            Sovereign.notify(`RESEARCH: ${tech.name} COMPLETED. LOGISTICAL BUFF APPLIED.`);
            render(); 
        }
    };
    const attack = (rid) => {
        const r = state.regions.find(x => x.id === rid);
        const powerNeeded = r.difficulty * 45;
        if (getTotalPower() >= powerNeeded) {
            r.captured = true;
            Sovereign.notify(`BATTLE LOG: SECTOR ${r.name} CAPTURED. TRIBUTE STREAM ESTABLISHED.`);
        } else {
            for (let id in state.units) state.units[id] = Math.floor(state.units[id] * 0.7);
            Sovereign.notify(`BATTLE LOG: DEFEAT AT ${r.name}. 30% CASUALTIES RECORDED.`);
        }
        render();
    };
    const prestige = () => {
        const gain = Math.floor(state.resources.gold / 2000);
        if (gain < 1) return;
        state.legacyPoints += gain;
        state.modifiers.production = 1.0 + (state.legacyPoints * 0.12);
        state.modifiers.combat = 1.0 + (state.legacyPoints * 0.08);
        state.resources = { food: 100, wood: 100, ore: 50, gold: 50 };
        state.buildings = { farm: 0, woodcutter: 0, quarry: 0, foundry: 0, market: 0 };
        state.units = { infantry: 0, archer: 0, cavalry: 0, siege: 0 };
        state.tech = []; state.commanders = []; state.clickLvl = 1;
        state.regions.forEach(r => r.captured = false);
        Sovereign.notify(`SUCCESSION: DYNASTY REBORN. LEGACY BONUS SET TO ${((state.modifiers.production - 1) * 100).toFixed(0)}%.`);
        save(); render();
    };

    const calcCost = (base, count) => {
        const cost = {};
        for (let r in base) cost[r] = Math.floor(base[r] * Math.pow(1.3, count));
        return cost;
    };
    const canAfford = (costs) => {
        if (typeof costs === 'number') return state.resources.gold >= costs;
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };
    const pay = (costs) => { 
        if (typeof costs === 'number') { state.resources.gold -= costs; return; }
        for (let r in costs) state.resources[r] -= costs[r]; 
    };
    const renderCosts = (costs) => {
        let h = '';
        if (typeof costs === 'number') costs = { gold: costs };
        for (const r in costs) {
            const aff = state.resources[r] >= costs[r];
            h += `<span class="cost-tag ${aff ? 'affordable' : 'cannot-afford'}">${costs[r]} ${r.toUpperCase()}</span>`;
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
        d.innerHTML = `<span style="opacity: 0.5">[${new Date().toLocaleTimeString()}]</span> > ${msg}`;
        entries.prepend(d);
    };
    const save = () => localStorage.setItem('sov_piss_save_v5', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_piss_save_v5');
        if (s) {
            const p = JSON.parse(s);
            state = { ...state, ...p };
            state.lastUpdate = Date.now();
        }
    };

    return { init, manualGather, buyBuilding, recruitUnit, trade, hireCommander, research, attack, notify, upgradeClick, prestige };
})();

window.onload = Sovereign.init;
