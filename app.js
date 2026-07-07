// Cloudflare Environment Variable Placeholders
const CF_API_TOKEN = ""; // Placeholder for Cloudflare API Token
const CF_ACCOUNT_ID = ""; // Placeholder for Cloudflare Account ID

let hearts = 0;
let pets = 0;
let houses = 0;
let castles = 0;

let petCost = 10;
let houseCost = 100;
let castleCost = 1000;

function updateDisplay() {
    document.getElementById('hearts').innerText = Math.floor(hearts);
    document.getElementById('pets-owned').innerText = pets;
    document.getElementById('houses-owned').innerText = houses;
    document.getElementById('castles-owned').innerText = castles;
    
    document.getElementById('pet-cost').innerText = petCost;
    document.getElementById('house-cost').innerText = houseCost;
    document.getElementById('castle-cost').innerText = castleCost;

    const hps = (pets * 1) + (houses * 5) + (castles * 20);
    document.getElementById('hps').innerText = hps.toFixed(1);
}

function clickChibi() {
    hearts += 1;
    updateDisplay();
}

function buyPet() {
    if (hearts >= petCost) {
        hearts -= petCost;
        pets += 1;
        petCost = Math.ceil(petCost * 1.15);
        updateDisplay();
    }
}

function buyHouse() {
    if (hearts >= houseCost) {
        hearts -= houseCost;
        houses += 1;
        houseCost = Math.ceil(houseCost * 1.2);
        updateDisplay();
    }
}

function buyCastle() {
    if (hearts >= castleCost) {
        hearts -= castleCost;
        castles += 1;
        castleCost = Math.ceil(castleCost * 1.25);
        updateDisplay();
    }
}

// Idle Logic
setInterval(() => {
    hearts += (pets * 1) / 10;
    hearts += (houses * 5) / 10;
    hearts += (castles * 20) / 10;
    updateDisplay();
}, 100);

// Placeholder for week-long progression saving (persistence)
function saveGame() {
    const gameState = { hearts, pets, houses, castles, petCost, houseCost, castleCost };
    localStorage.setItem('chibi_idle_save', JSON.stringify(gameState));
    console.log("Game saved to localStorage (or could use Cloudflare KV via API)");
}

function loadGame() {
    const saved = localStorage.getItem('chibi_idle_save');
    if (saved) {
        const state = JSON.parse(saved);
        hearts = state.hearts;
        pets = state.pets;
        houses = state.houses;
        castles = state.castles;
        petCost = state.petCost;
        houseCost = state.houseCost;
        castleCost = state.castleCost;
        updateDisplay();
    }
}

loadGame();
setInterval(saveGame, 30000); // Save every 30 seconds
