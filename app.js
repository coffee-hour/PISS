/**
 * Sovereign: Imperial Clicker (v2.1.0 - Impact Update)
 * Special Tactile Mechanics & Procedural Audio
 */

const Sovereign = (() => {
    // --- Imperial State ---
    let state = {
        treasury: 0,
        upgrades: {
            militia: 0, spearmen: 0, scouts: 0, knights: 0,
            trebuchet: 0, commander: 0, arsenal: 0, automata: 0
        },
        totalGoldEarned: 0,
        lastUpdate: Date.now()
    };

    const config = {
        upgrades: [
            { id: 'militia', name: "Conscripted Militia", desc: "Basic levies. +0.1 Passive/s", baseCost: 15, passive: 0.1, click: 0, icon: 'users' },
            { id: 'scouts', name: "Border Scouts", desc: "Raiding scouts. +1 per Click", baseCost: 50, passive: 0, click: 1, icon: 'eye' },
            { id: 'spearmen', name: "Iron Spearmen", desc: "Line infantry. +1 Passive/s", baseCost: 100, passive: 1, click: 0, icon: 'shield' },
            { id: 'trebuchet', name: "Imperial Trebuchet", desc: "Siege engineering. +5 per Click", baseCost: 500, passive: 0, click: 5, icon: 'target' },
            { id: 'knights', name: "Gilded Knights", desc: "Heavy cavalry. +8 Passive/s", baseCost: 1100, passive: 8, click: 0, icon: 'swords' },
            { id: 'arsenal', name: "Royal Arsenal", desc: "Weaponry tech. +15 per Click", baseCost: 5000, passive: 0, click: 15, icon: 'zap' },
            { id: 'commander', name: "Lord Marshal", desc: "Tactical leadership. +40 Passive/s", baseCost: 12000, passive: 40, click: 0, icon: 'crown' },
            { id: 'automata', name: "Ancient Automata", desc: "Mechanical relics. +200 Passive/s", baseCost: 50000, passive: 200, click: 0, icon: 'cpu' }
        ],
        milestones: [
            { threshold: 0, icon: 'sword' },
            { threshold: 500, icon: 'shield' },
            { threshold: 5000, icon: 'crown' },
            { threshold: 25000, icon: 'castle' }
        ]
    };

    // --- Audio Synthesis (Web Audio API) ---
    let audioCtx = null;
    const playImpactSound = () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };

    // --- Particle System (Canvas) ---
    let canvas, ctx, particles = [];
    const initParticles = () => {
        canvas = document.getElementById('particle-canvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        requestAnimationFrame(updateParticles);
    };

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    const spawnSparks = (x, y) => {
        for (let i = 0; i < 8; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15 - 5,
                life: 1.0,
                color: Math.random() > 0.5 ? '#f59e0b' : '#fbbf24',
                size: Math.random() * 3 + 1
            });
        }
    };

    const updateParticles = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.4; // Gravity
            p.life -= 0.02;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1.0;
        requestAnimationFrame(updateParticles);
    };

    // --- Core Logic ---
    const init = () => {
        load();
        initParticles();
        render();
        startLoop();
        updateMilestoneIcon();
        notify("Throne Secured. Fund the machine.");
    };

    const startLoop = () => {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - state.lastUpdate) / 1000;
            state.lastUpdate = now;
            updateState(delta);
        }, 100);
        setInterval(save, 5000);
    };

    const updateState = (delta) => {
        const passiveRate = calculatePassiveRate();
        state.treasury += passiveRate * delta;
        state.totalGoldEarned += passiveRate * delta;
        renderUI();
    };

    const calculatePassiveRate = () => {
        return config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.passive), 0);
    };

    const calculateClickPower = () => {
        return 1 + config.upgrades.reduce((acc, u) => acc + (state.upgrades[u.id] * u.click), 0);
    };

    const handleInteraction = (e) => {
        const power = calculateClickPower();
        state.treasury += power;
        state.totalGoldEarned += power;
        
        // Impact Visuals
        triggerRecoil();
        spawnSparks(e.clientX, e.clientY);
        spawnTextParticle(`+${power}`, e.clientX, e.clientY);
        playImpactSound();
        updateMilestoneIcon();
        renderUI();
    };

    const triggerRecoil = () => {
        const app = document.getElementById('app');
        app.classList.remove('recoil');
        void app.offsetWidth; // Force reflow
        app.classList.add('recoil');
    };

    const spawnTextParticle = (text, x, y) => {
        const container = document.getElementById('text-particle-container');
        const p = document.createElement('div');
        p.className = 'text-particle';
        p.innerText = text;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 800);
    };

    const updateMilestoneIcon = () => {
        const container = document.getElementById('banner-icon-container');
        if (!container) return;

        let activeIcon = config.milestones[0].icon;
        for (const m of config.milestones) {
            if (state.totalGoldEarned >= m.threshold) activeIcon = m.icon;
        }

        const currentIcon = container.querySelector('i');
        if (currentIcon && currentIcon.getAttribute('data-lucide') !== activeIcon) {
            container.innerHTML = `<i data-lucide="${activeIcon}" class="banner-icon"></i>`;
            lucide.createIcons();
        }
    };

    const buyUpgrade = (id) => {
        const u = config.upgrades.find(x => x.id === id);
        const cost = calculateCost(u);
        
        if (state.treasury >= cost) {
            state.treasury -= cost;
            state.upgrades[id]++;
            notify(`Reinforcement: ${u.name} deployed.`);
            playImpactSound();
            render();
        }
    };

    const calculateCost = (u) => {
        return Math.floor(u.baseCost * Math.pow(1.15, state.upgrades[u.id]));
    };

    const render = () => {
        const container = document.getElementById('upgrade-container');
        if (!container) return;
        
        container.innerHTML = '';
        config.upgrades.forEach(u => {
            const cost = calculateCost(u);
            const count = state.upgrades[u.id];
            
            const card = document.createElement('div');
            card.className = `upgrade-card ${state.treasury < cost ? 'disabled' : ''}`;
            card.id = `upgrade-${u.id}`;
            card.onclick = () => buyUpgrade(u.id);
            
            card.innerHTML = `
                <div class="upgrade-icon"><i data-lucide="${u.icon}"></i></div>
                <div class="upgrade-info">
                    <div class="upgrade-name">${u.name}</div>
                    <div class="upgrade-desc">${u.desc}</div>
                    <div class="upgrade-cost">${Math.floor(cost).toLocaleString()} Gold</div>
                </div>
                <div class="upgrade-count">${count}</div>
            `;
            container.appendChild(card);
        });
        lucide.createIcons();
    };

    const renderUI = () => {
        const countEl = document.getElementById('treasury-count');
        const rateEl = document.getElementById('passive-rate');
        
        if (countEl) countEl.innerText = Math.floor(state.treasury).toLocaleString();
        if (rateEl) rateEl.innerText = `+${calculatePassiveRate().toFixed(1)}/s`;
        
        config.upgrades.forEach(u => {
            const card = document.getElementById(`upgrade-${u.id}`);
            if (card) {
                const cost = calculateCost(u);
                if (state.treasury < cost) card.classList.add('disabled');
                else card.classList.remove('disabled');
            }
        });
    };

    const notify = (msg) => {
        const container = document.getElementById('log-entries');
        if (!container) return;
        const div = document.createElement('div');
        div.innerText = `> ${msg}`;
        container.prepend(div);
        if (container.children.length > 5) container.lastChild.remove();
    };

    const save = () => localStorage.setItem('sov_impact_v21', JSON.stringify(state));
    const load = () => {
        const s = localStorage.getItem('sov_impact_v21');
        if (s) {
            try {
                const p = JSON.parse(s);
                state = { ...state, ...p, lastUpdate: Date.now() };
            } catch(e) {}
        }
    };

    return { init, handleInteraction };
})();

window.onload = Sovereign.init;
