let currentUser = null;

const stocks = {
  AAPL: { name: "Apple", price: 195 },
  TSLA: { name: "Tesla", price: 178 },
  NVDA: { name: "Nvidia", price: 1120 },
  AMZN: { name: "Amazon", price: 185 },
  GOOGL: { name: "Alphabet", price: 172 },
  MSFT: { name: "Microsoft", price: 430 },
  META: { name: "Meta", price: 485 },
  NFLX: { name: "Netflix", price: 640 },
  UBER: { name: "Uber", price: 68 },
  DIS: { name: "Disney", price: 101 }
};

function createAccount() {
  const username = document.getElementById("usernameInput").value.trim();

  if (!username) {
    alert("Please enter a username.");
    return;
  }

  currentUser = username;

  let users = JSON.parse(localStorage.getItem("users")) || {};

  if (!users[username]) {
    users[username] = {
      cash: 10000,
      portfolio: {},
      watchlist: [],
      badges: ["Welcome Investor"]
    };
  }

  localStorage.setItem("users", JSON.stringify(users));

  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");

  document.getElementById("welcomeText").innerText = `Welcome, ${username}! Start searching stocks below.`;

  updateAll();
  showPage("search");
}

function getUserData() {
  const users = JSON.parse(localStorage.getItem("users")) || {};
  return users[currentUser];
}

function saveUserData(data) {
  const users = JSON.parse(localStorage.getItem("users")) || {};
  users[currentUser] = data;
  localStorage.setItem("users", JSON.stringify(users));
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "portfolio") updatePortfolio();
  if (pageId === "watchlist") updateWatchlist();
  if (pageId === "leaderboard") updateLeaderboard();
  if (pageId === "badges") updateBadges();
}

function searchStock() {
  const symbol = document.getElementById("stockSearch").value.toUpperCase().trim();

  if (!stocks[symbol]) {
    document.getElementById("stockResult").innerHTML =
      `<h2>Stock not found</h2><p>Try AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, META, NFLX, UBER, or DIS.</p>`;
    return;
  }

  const stock = stocks[symbol];

  document.getElementById("stockResult").innerHTML = `
    <div class="stock-card">
      <h2>${stock.name} (${symbol})</h2>
      <h3>Price: $${stock.price}</h3>

      <input id="sharesInput" type="number" placeholder="Number of shares">

      <br>

      <button onclick="buyStock('${symbol}')">Buy</button>
      <button onclick="sellStock('${symbol}')">Sell</button>
      <button onclick="addToWatchlist('${symbol}')">Add to Watchlist</button>

      <canvas id="stockChart" width="560" height="260"></canvas>
    </div>
  `;

  drawChart(symbol);
}

function buyStock(symbol) {
  const shares = Number(document.getElementById("sharesInput").value);
  const data = getUserData();
  const cost = shares * stocks[symbol].price;

  if (shares <= 0) {
    alert("Enter a valid number of shares.");
    return;
  }

  if (cost > data.cash) {
    alert("Not enough cash.");
    return;
  }

  data.cash -= cost;
  data.portfolio[symbol] = (data.portfolio[symbol] || 0) + shares;

  if (!data.badges.includes("First Stock Bought")) {
    data.badges.push("First Stock Bought");
  }

  if (Object.keys(data.portfolio).length >= 3 && !data.badges.includes("Diversified Investor")) {
    data.badges.push("Diversified Investor");
  }

  saveUserData(data);
  updateAll();
  alert(`Bought ${shares} shares of ${symbol}.`);
}

function sellStock(symbol) {
  const shares = Number(document.getElementById("sharesInput").value);
  const data = getUserData();

  if (!data.portfolio[symbol] || data.portfolio[symbol] < shares) {
    alert("You do not own enough shares.");
    return;
  }

  data.portfolio[symbol] -= shares;
  data.cash += shares * stocks[symbol].price;

  if (data.portfolio[symbol] === 0) {
    delete data.portfolio[symbol];
  }

  saveUserData(data);
  updateAll();
  alert(`Sold ${shares} shares of ${symbol}.`);
}

function addToWatchlist(symbol) {
  const data = getUserData();

  if (!data.watchlist.includes(symbol)) {
    data.watchlist.push(symbol);
  }

  if (!data.badges.includes("Watchlist Starter")) {
    data.badges.push("Watchlist Starter");
  }

  saveUserData(data);
  updateAll();
  alert(`${symbol} added to watchlist.`);
}

function updateAll() {
  const data = getUserData();
  document.getElementById("cashDisplay").innerText = data.cash.toFixed(2);
  updatePortfolio();
  updateWatchlist();
  updateLeaderboard();
  updateBadges();
}

function updatePortfolio() {
  const data = getUserData();
  let html = "";

  for (let symbol in data.portfolio) {
    const shares = data.portfolio[symbol];
    const value = shares * stocks[symbol].price;

    html += `
      <div class="card">
        <h2>${symbol}</h2>
        <p>Shares: ${shares}</p>
        <p>Value: $${value.toFixed(2)}</p>
      </div>
    `;
  }

  if (!html) html = "<p>No stocks owned yet.</p>";

  document.getElementById("portfolioList").innerHTML = html;
}

function updateWatchlist() {
  const data = getUserData();
  let html = "";

  data.watchlist.forEach(symbol => {
    html += `
      <div class="card">
        <h2>${symbol}</h2>
        <p>${stocks[symbol].name}</p>
        <p>Price: $${stocks[symbol].price}</p>
      </div>
    `;
  });

  if (!html) html = "<p>No stocks in watchlist yet.</p>";

  document.getElementById("watchlistList").innerHTML = html;
}

function updateLeaderboard() {
  const users = JSON.parse(localStorage.getItem("users")) || {};
  const list = [];

  for (let username in users) {
    let netWorth = users[username].cash;

    for (let symbol in users[username].portfolio) {
      netWorth += users[username].portfolio[symbol] * stocks[symbol].price;
    }

    list.push({ username, netWorth });
  }

  list.sort((a, b) => b.netWorth - a.netWorth);

  document.getElementById("leaderboardList").innerHTML = list.map(user =>
    `<li>${user.username}: $${user.netWorth.toFixed(2)}</li>`
  ).join("");
}

function updateBadges() {
  const data = getUserData();

  document.getElementById("badgesList").innerHTML = data.badges.map(badge =>
    `<div class="card">🏆 ${badge}</div>`
  ).join("");
}

function drawChart(symbol) {
  const canvas = document.getElementById("stockChart");
  const ctx = canvas.getContext("2d");

  const basePrice = stocks[symbol].price;
  const prices = [];

  for (let i = 0; i < 12; i++) {
    prices.push(basePrice + Math.floor(Math.random() * 40 - 20));
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 4;
  ctx.beginPath();

  prices.forEach((price, index) => {
    const x = index * 45 + 25;
    const y = 230 - (price / basePrice) * 100;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = "black";
  ctx.font = "18px Arial";
  ctx.fillText(`${symbol} simulated stock chart`, 20, 30);
}

function logout() {
  currentUser = null;
  document.getElementById("appPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
}
