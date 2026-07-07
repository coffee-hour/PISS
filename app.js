/**
 * Chibi Empire - Xavier's Backend Integration Points
 */
const CF_API_TOKEN = "";
const CF_ACCOUNT_ID = "";

/**
 * Game Core
 */
const game = {
    state: {
        resources: {
            food: 100,
            gold: 50,
            materials: 50,
            recruits: 0
        },
        buildings: {
            farm: 0,
            market: 0,
            quarry: 0
        },
        units: {
            knight: 0,
            archer: 0
        },
        era: "Chibi Tribe",
        prestige: 1.0,
        lastTick: Date.now()
    },

    config: {
        buildings: {
            farm: { baseCost: { food: 10 }, production: { food: 1.5 } },
            market: { baseCost: { gold: 15 }, production: { gold: 0.8 } },
            quarry: { baseCost: { materials: 25 }, production: { materials: 0.5 } }
        },
        units: {
            knight: { cost: { gold: 50, recruits: 5 }, power: 10 },
            archer: { cost: { gold: 30, recruits: 8 }, power: 6 }
        }
    },

    init() {
        this.load();
        this.setupEventListeners();
        this.startLoop();
        this.render();
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.addEventListener('click', () => {
                document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
                
                li.classList.add('active');
                const tabId = `tab-${li.getAttribute('data-tab')}`;
                document.getElementById(tabId).classList.add('active');
            });
        });
    },

    build(id) {
        const building = this.config.buildings[id];
        const cost = this.calculateCost(id);
        
        if (this.canAfford(cost)) {
            this.subtractResources(cost);
            this.state.buildings[id]++;
            this.notify(`Built ${id}!`);
            this.render();
        } else {
            this.notify("Not enough resources!", "error");
        }
    },

    calculateCost(id) {
        const b = this.config.buildings[id];
        const count = this.state.buildings[id];
        const multiplier = Math.pow(1.15, count);
        const actualCost = {};
        for (let res in b.baseCost) {
            actualCost[res] = Math.floor(b.baseCost[res] * multiplier);
        }
        return actualCost;
    },

    canAfford(cost) {
        for (let res in cost) {
            if (this.state.resources[res] < cost[res]) return false;
        }
        return true;
    },

    subtractResources(cost) {
        for (let res in cost) {
            this.state.resources[res] -= cost[res];
        }
    },

    startLoop() {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - this.state.lastTick) / 1000;
            this.state.lastTick = now;
            this.update(delta);
        }, 100);
    },

    update(delta) {
        // Production logic
        for (let bId in this.state.buildings) {
            const count = this.state.buildings[bId];
            const prod = this.config.buildings[bId].production;
            for (let res in prod) {
                this.state.resources[res] += prod[res] * count * delta * this.state.prestige;
            }
        }
        this.render();
    },

    render() {
        // Update Resource Display
        for (let res in this.state.resources) {
            const el = document.getElementById(`res-${res}`);
            if (el) el.innerText = Math.floor(this.state.resources[res]).toLocaleString();
            
            // Calc Rates (simplified for display)
            const rateEl = document.getElementById(`rate-${res}`);
            if (rateEl) {
                let totalRate = 0;
                for (let bId in this.state.buildings) {
                    const prod = this.config.buildings[bId].production;
                    if (prod[res]) totalRate += prod[res] * this.state.buildings[bId];
                }
                rateEl.innerText = `+${totalRate.toFixed(1)}/s`;
            }
        }

        // Update Building Cards
        for (let bId in this.state.buildings) {
            const countEl = document.getElementById(`count-${bId}`);
            if (countEl) countEl.innerText = this.state.buildings[bId];
            
            const costEl = document.getElementById(`cost-${bId}`);
            if (costEl) {
                const costs = this.calculateCost(bId);
                let costStr = "";
                for (let r in costs) costStr += `${r}: ${costs[r]} `;
                costEl.innerText = costStr;
            }
        }
    },

    notify(msg, type = "success") {
        const container = document.getElementById('notif-container');
        const n = document.createElement('div');
        n.className = `notif ${type}`;
        n.innerText = msg;
        container.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    },

    save() {
        localStorage.setItem('chibi_empire_save', JSON.stringify(this.state));
    },

    load() {
        const saved = localStorage.getItem('chibi_empire_save');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.state = { ...this.state, ...parsed };
            this.state.lastTick = Date.now();
        }
    }
};

window.onload = () => game.init();
