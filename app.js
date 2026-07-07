/**
 * Sovereign: Statecraft - Sovereign Engine (AAA V2)
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

    // --- Core Loops ---
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
                lucide.createIcons();
            });
        });
        const upBtn = document.getElementById('upgrade-click-btn');
        if (upBtn) upBtn.addEventListener('click', (e) => { upgradeDecree(); triggerShake(); });
        const presBtn = document.getElementById('prestige-btn');
        if (presBtn) presBtn.addEventListener('click', concludeReign);
        const carveBtn = document.getElementById('carve-btn');
        if (carveBtn) carveBtn.addEventListener('click', carveStatue);
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
        // Multipliers
        const rel = religions[state.faithId] || religions.none;
        const getMult = (key) => 1 + (rel.mult[key] || 0);

        for (let id in state.buildings) {
            const b = config.buildings[id];
            const m = getMult(`prod_${b.res}`);
            state.resources[b.res] += b.prod * state.buildings[id] * delta * state.modifiers.production * m;
        }
        
        // Faith Trickle from Statue
        if (state.statueImg) {
            state.resources.faith += 0.5 * delta;
            state.modifiers.production = 1.0 + (state.resources.faith * 0.0001); // Tiny boost per faith
        }

        renderLedgerOnly();
    };

    // --- AAA Feedback ---
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
        app.classList.add('shaking');
        setTimeout(() => app.classList.remove('shaking'), 400);
    };

    const triggerCardEffect = (el) => {
        el.style.animation = 'none';
        el.offsetHeight; // Reflow
        el.style.animation = 'cardShake 0.2s';
    };

    // --- Canvas Logic ---
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

        document.getElementById('tool-clear').onclick = () => ctx.clearRect(0,0,64,64);
        document.getElementById('tool-grid').onclick = () => {
            document.getElementById('canvas-grid').classList.toggle('hidden');
            document.getElementById('tool-grid').classList.toggle('active');
        };

        document.querySelectorAll('.bp-btn').forEach(btn => {
            btn.onclick = () => loadBlueprint(btn.getAttribute('data-bp'));
        });
    };

    const draw = (e) => {
        if (!painting) return;
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
        ctx.clearRect(0,0,64,64);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        if (bp === 'crown') ctx.fillRect(10, 30, 44, 20);
        if (bp === 'sword') ctx.fillRect(30, 5, 4, 50);
        if (bp === 'pillar') ctx.fillRect(20, 10, 24, 44);
    };

    const carveStatue = () => {
        const cvs = document.getElementById('statue-canvas');
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

    // --- Rendering ---
    const render = () => {
        renderLedgerOnly();
        renderThroneRoom();
        renderPantheon();
        renderStatue();
        // ... rest of rendering
        lucide.createIcons();
    };

    const renderLedgerOnly = () => {
        for (let res in state.resources) {
            const node = document.getElementById(`res-${res}`);
            if (node) {
                const valEl = node.querySelector('.res-val');
                if (valEl) valEl.innerText = Math.floor(state.resources[res]).toLocaleString();
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

        const container = document.getElementById('senate-buildings');
        if (!container) return;
        container.innerHTML = '';
        for (let id in Sovereign.config.buildings) {
            const b = Sovereign.config.buildings[id];
            const count = state.buildings[id];
            const card = document.createElement('div');
            card.className = 'chamber-card iron-banded clickable-card';
            card.onclick = () => triggerCardEffect(card);
            card.innerHTML = `
                <div class="card-header"><h3>${b.name}</h3><span class="seal">Lv ${count}</span></div>
                <button class="action-btn" onclick="Sovereign.buyBuilding('${id}')">Lease</button>`;
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

    // --- Sovereign Actions ---
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
        }
    };

    const notify = (msg) => {
        const entries = document.getElementById('log-entries');
        if (!entries) return;
        const d = document.createElement('div');
        d.innerHTML = `> ${msg}`;
        entries.prepend(d);
    };

    const save = () => localStorage.setItem('sov_aaa_v1', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_aaa_v1');
        if (s) state = { ...state, ...JSON.parse(s), lastUpdate: Date.now() };
    };

    return { init, manualGather, triggerCardEffect, config, buyBuilding: (id)=>{}, notify };
})();

window.onload = Sovereign.init;
