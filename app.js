/**
 * Sovereign: Statecraft - Idle Military Engine (v1.0.0)
 */

const Sovereign = (() => {
    // --- State ---
    let state = {
        resources: { food: 500, wood: 500, ore: 200, gold: 200 },
        units: { guard: 0, ranger: 0, knight: 0 },
        arsenal: { tier: 0 }, // 0: Iron, 1: Siege, 2: Blackpowder, 3: Ancient Automata
        capturedSectors: 0,
        modifiers: { production: 1.0, combat: 1.0 },
        regions: [],
        lastUpdate: Date.now()
    };

    const config = {
        units: {
            guard: { name: "Steel Guard", baseCost: { food: 50, ore: 10 }, power: 10, icon: 'shield', clr: 'icon-combat' },
            ranger: { name: "Crossbowman", baseCost: { food: 30, wood: 40 }, power: 15, icon: 'target', clr: 'icon-combat' },
            knight: { name: "Imperial Knight", baseCost: { food: 150, ore: 80, gold: 40 }, power: 75, icon: 'swords', clr: 'icon-combat' }
        },
        arsenal: [
            { id: 0, name: "Iron Weaponry", cost: { gold: 0 }, bonus: 1.0, req: 0, desc: "Standard issue blades and shields." },
            { id: 1, name: "Siege Engines", cost: { wood: 2000, ore: 1000, gold: 500 }, bonus: 2.5, req: 5, desc: "Massive ballistae and catapults." },
            { id: 2, name: "Blackpowder", cost: { ore: 5000, gold: 2000 }, bonus: 6.0, req: 15, desc: "Chemical propulsion and explosive shells." },
            { id: 3, name: "Ancient Automata", cost: { ore: 20000, gold: 10000 }, bonus: 15.0, req: 30, desc: "Self-governing relics of a lost age." }
        ],
        baseProd: { food: 5, wood: 5, ore: 2, gold: 2 }
    };

    const init = () => {
        load();
        generateRegions();
        setupNav();
        render();
        startLoop();
    };

    const generateRegions = () => {
        if (state.regions.length > 0) return;
        for (let i = 0; i < 100; i++) {
            state.regions.push({
                id: i,
                name: `Sector ${i+1}`,
                difficulty: Math.floor(20 * Math.pow(1.15, i)),
                captured: false
            });
        }
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
        // Passive Resource Generation
        for (let res in state.resources) {
            const sectorBonus = 1 + (state.capturedSectors * 0.1);
            state.resources[res] += config.baseProd[res] * sectorBonus * state.modifiers.production * delta;
        }

        // Automated Conquest
        const nextSector = state.regions.find(r => !r.captured);
        if (nextSector) {
            const currentPower = getTotalPower();
            const powerNeeded = nextSector.difficulty;
            if (currentPower >= powerNeeded) {
                nextSector.captured = true;
                state.capturedSectors++;
                Sovereign.notify(`ANNEXED: ${nextSector.name}. Global production increased.`);
                render();
            }
        }

        renderLedger();
        renderWarProgress();
    };

    const renderLedger = () => {
        for (let res in state.resources) {
            const valEl = document.querySelector(`#res-${res} .res-val`);
            const rateEl = document.querySelector(`#rate-${res}`);
            if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
            if (rateEl) {
                const sectorBonus = 1 + (state.capturedSectors * 0.1);
                rateEl.innerText = `+${(config.baseProd[res] * sectorBonus * state.modifiers.production).toFixed(1)}/s`;
            }
        }
    };

    const render = () => {
        renderGarrison();
        renderArsenal();
        renderWarTable();
        lucide.createIcons();
    };

    const renderGarrison = () => {
        const container = document.getElementById('garrison-units');
        if (!container) return;
        container.innerHTML = '';
        for (let id in config.units) {
            const u = config.units[id];
            const div = document.createElement('div');
            div.className = 'chamber-card iron-banded';
            div.innerHTML = `
                <div class="card-header"><h3><i data-lucide="${u.icon}" class="${u.clr}"></i> ${u.name}</h3><span class="seal">${state.units[id]} Ready</span></div>
                <div class="card-body">
                    <p>Base Power: ${u.power}</p>
                    <div class="price-display">${renderCosts(u.baseCost)}</div>
                    <button class="action-btn" onclick="Sovereign.recruitUnit('${id}')" ${!canAfford(u.baseCost)?'disabled':''}>Mobilize</button>
                </div>`;
            container.appendChild(div);
        }
    };

    const renderArsenal = () => {
        const container = document.getElementById('arsenal-upgrades');
        if (!container) return;
        container.innerHTML = '';
        config.arsenal.forEach(tier => {
            const owned = state.arsenal.tier >= tier.id;
            const unlockable = state.capturedSectors >= tier.req && !owned;
            const div = document.createElement('div');
            div.className = `chamber-card iron-banded ${owned?'owned':unlockable?'unlockable':'locked'}`;
            div.innerHTML = `
                <div class="card-header"><h3><i data-lucide="zap" class="icon-gold"></i> ${tier.name}</h3></div>
                <div class="card-body">
                    <p>${tier.desc}</p>
                    <p class="bonus-text">Global Combat Bonus: ${tier.bonus}x</p>
                    ${owned ? '<span class="seal">ACTIVE</span>' : `
                        <p class="req-text">Requirement: ${tier.req} Sectors</p>
                        <div class="price-display">${renderCosts(tier.cost)}</div>
                        <button class="action-btn" onclick="Sovereign.upgradeArsenal(${tier.id})" ${!unlockable || !canAfford(tier.cost)?'disabled':''}>Forge Tier</button>
                    `}
                </div>`;
            container.appendChild(div);
        });
    };

    const renderWarTable = () => {
        const map = document.getElementById('expansion-map');
        if (!map) return;
        map.innerHTML = '';
        const currentPower = getTotalPower();
        state.regions.slice(0, state.capturedSectors + 1).forEach(r => {
            const div = document.createElement('div');
            div.className = `sector-card iron-banded ${r.captured?'annexed':'contested'}`;
            const readiness = r.captured ? 100 : Math.min(100, (currentPower / r.difficulty) * 100);
            div.innerHTML = `
                <div class="sector-status"><span>${r.name}</span><span>${r.captured?'Annexed':`${r.difficulty} DEF`}</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${readiness}%"></div></div>
                <p class="readiness-text">${r.captured?'Secured':`Readiness: ${readiness.toFixed(1)}%`}</p>`;
            map.appendChild(div);
        });
    };

    const renderWarProgress = () => {
        // Lightweight update for bars without full re-render
        const nextSector = state.regions.find(r => !r.captured);
        if (nextSector) {
            const currentPower = getTotalPower();
            const readiness = Math.min(100, (currentPower / nextSector.difficulty) * 100);
            const activeBar = document.querySelector('.sector-card.contested .progress-fill');
            const activeText = document.querySelector('.sector-card.contested .readiness-text');
            if (activeBar) activeBar.style.width = `${readiness}%`;
            if (activeText) activeText.innerText = `Readiness: ${readiness.toFixed(1)}%`;
        }
    };

    const getTotalPower = () => {
        let p = 0;
        for (let id in state.units) {
            p += state.units[id] * config.units[id].power;
        }
        const arsenalBonus = config.arsenal[state.arsenal.tier].bonus;
        return p * arsenalBonus * state.modifiers.combat;
    };

    const recruitUnit = (id) => {
        const u = config.units[id];
        if (canAfford(u.baseCost)) {
            pay(u.baseCost);
            state.units[id]++;
            renderGarrison();
        }
    };

    const upgradeArsenal = (tierId) => {
        const tier = config.arsenal[tierId];
        if (canAfford(tier.cost) && state.capturedSectors >= tier.req) {
            pay(tier.cost);
            state.arsenal.tier = tierId;
            Sovereign.notify(`ARSENAL UPGRADED: ${tier.name}. Combat power surged.`);
            render();
        }
    };

    const canAfford = (costs) => {
        for (let r in costs) if (state.resources[r] < costs[r]) return false;
        return true;
    };

    const pay = (costs) => {
        for (let r in costs) state.resources[r] -= costs[r];
    };

    const renderCosts = (costs) => {
        let h = '';
        for (const r in costs) {
            const aff = state.resources[r] >= costs[r];
            h += `<span class="price-tag ${aff ? 'can-afford' : 'cannot-afford'}">${costs[r]} ${r.toUpperCase()}</span>`;
        }
        return h;
    };

    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (entries) {
            const d = document.createElement('div');
            d.innerHTML = `<span style="opacity:0.5">[${new Date().toLocaleTimeString()}]</span> > ${msg}`;
            entries.prepend(d);
        }
    };

    const save = () => localStorage.setItem('sov_idle_war_v1', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_idle_war_v1');
        if (s) {
            try {
                const p = JSON.parse(s);
                state = { ...state, ...p, lastUpdate: Date.now() };
            } catch(e) {}
        }
    };

    return { init, recruitUnit, upgradeArsenal, notify };
})();

window.onload = Sovereign.init;
