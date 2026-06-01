const API_KEY = "PASTE_YOUR_FINNHUB_API_KEY_HERE";

let currentUser = null;
let stocks = {};

function createAccount() {
  const username = document.getElementById("usernameInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  if (!username || !password) {
    alert("Please enter a username and password.");
    return;
  }

  let users = JSON.parse(localStorage.getItem("users")) || {};

  if (users[username]) {
    if (users[username].password !== password) {
      alert("Wrong password.");
      return;
    }
  } else {
    users[username] = {
      password: password,
      cash: 10000,
      portfolio: {},
      watchlist: [],
      badges: ["Welcome Investor"],
      history: []
    };
  }

  currentUser = username;
  localStorage.setItem("users", JSON.stringify(users));

  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  document.getElementById("welcomeText").innerText = `Welcome, ${username}!`;

  updateAll();
  showPage("stockBuying");
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
  if (pageId === "history") updateHistory();
}

async function searchStock() {
  const searchText = document.getElementById("stockSearch").value.trim();

  if (!searchText) {
    alert("Type a company name or stock symbol.");
    return;
  }

  document.getElementById("stockResult").innerHTML = "<h2>Searching...</h2>";

  try {
    const searchUrl =
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(searchText)}&token=${API_KEY}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.result || searchData.result.length === 0) {
      document.getElementById("stockResult").innerHTML =
        "<h2>Stock not found. Try AAPL, Apple, TSLA, Tesla, MSFT, or Microsoft.</h2>";
      return;
    }

    let match = searchData.result.find(item =>
      item.type === "Common Stock" &&
      !item.symbol.includes(".") &&
      !item.symbol.includes(":")
    );

    if (!match) {
      match = searchData.result[0];
    }

    const symbol = match.symbol;
    const name = match.description || symbol;

    const quoteUrl =
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;

    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    const price = quoteData.c;

    if (!price || price === 0) {
      document.getElementById("stockResult").innerHTML =
        `<h2>${name} (${symbol}) was found, but Finnhub did not return a price.</h2>`;
      return;
    }

    stocks[symbol] = {
      name: name,
      price: price
    };

    document.getElementById("stockResult").innerHTML = `
      <div class="stock-card">
        <h2>${name} (${symbol})</h2>
        <h3>Current Price: $${price.toFixed(2)}</h3>

        <input id="sharesInput" type="number" placeholder="Number of shares">

        <br>

        <button onclick="buyStock('${symbol}')">Buy</button>
        <button onclick="sellStock('${symbol}')">Sell</button>
        <button onclick="addToWatchlist('${symbol}')">Add to Watchlist</button>

        <canvas id="stockChart" width="560" height="260"></canvas>
      </div>
    `;

    await drawHistoricalChart(symbol);

  } catch (error) {
    document.getElementById("stockResult").innerHTML =
      "<h2>Error finding stock. Check your Finnhub API key.</h2>";
  }
}

async function drawHistoricalChart(symbol) {
  const canvas = document.getElementById("stockChart");
  const ctx = canvas.getContext("2d");

  const today = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = today - 30 * 24 * 60 * 60;

  const candleUrl =
    `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${thirtyDaysAgo}&to=${today}&token=${API_KEY}`;

  try {
    const response = await fetch(candleUrl);
    const data = await response.json();

    if (data.s !== "ok" || !data.c || data.c.length === 0) {
      drawFallbackChart(symbol);
      return;
    }

    const prices = data.c;
    drawLineChart(symbol, prices);

  } catch (error) {
    drawFallbackChart(symbol);
  }
}

function drawLineChart(symbol, prices) {
  const canvas = document.getElementById("stockChart");
  const ctx = canvas.getContext("2d");

  const width = canvas.width;
  const height = canvas.height;

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "green";
  ctx.lineWidth = 4;
  ctx.beginPath();

  prices.forEach((price, index) => {
    const x = 30 + index * ((width - 60) / (prices.length - 1));
    const y = height - 40 - ((price - min) / (max - min)) * (height - 80);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = "black";
  ctx.font = "18px Arial";
  ctx.fillText(`${symbol} 30-Day Price History`, 20, 30);
}

function drawFallbackChart(symbol) {
  const basePrice = stocks[symbol].price;
  let prices = [];

  for (let i = 0; i < 12; i++) {
    prices.push(basePrice + Math.floor(Math.random() * 40 - 20));
  }

  drawLineChart(symbol, prices);
}

function buyStock(symbol) {
  const shares = Number(document.getElementById("sharesInput").value);
  const data = getUserData();

  if (!shares || shares <= 0) {
    alert("Enter a valid number of shares.");
    return;
  }

  const cost = shares * stocks[symbol].price;

  if (cost > data.cash) {
    alert("Not enough cash.");
    return;
  }

  data.cash -= cost;
  data.portfolio[symbol] = (data.portfolio[symbol] || 0) + shares;

  addHistory(data, `Bought ${shares} shares of ${symbol} for $${cost.toFixed(2)}`);

  if (!data.badges.includes("First Stock Bought")) {
    data.badges.push("First Stock Bought");
  }

  saveUserData(data);
  updateAll();

  alert(`Bought ${shares} shares of ${symbol}.`);
}

function sellStock(symbol) {
  const shares = Number(document.getElementById("sharesInput").value);
  const data = getUserData();

  if (!shares || shares <= 0) {
    alert("Enter a valid number of shares.");
    return;
  }

  if (!data.portfolio[symbol] || data.portfolio[symbol] < shares) {
    alert("You do not own enough shares.");
    return;
  }

  const value = shares * stocks[symbol].price;

  data.portfolio[symbol] -= shares;
  data.cash += value;

  if (data.portfolio[symbol] === 0) {
    delete data.portfolio[symbol];
  }

  addHistory(data, `Sold ${shares} shares of ${symbol} for $${value.toFixed(2)}`);

  saveUserData(data);
  updateAll();

  alert(`Sold ${shares} shares of ${symbol}.`);
}

function addToWatchlist(symbol) {
  const data = getUserData();

  if (!data.watchlist.includes(symbol)) {
    data.watchlist.push(symbol);
    addHistory(data, `Added ${symbol} to watchlist`);
  }

  if (!data.badges.includes("Watchlist Starter")) {
    data.badges.push("Watchlist Starter");
  }

  saveUserData(data);
  updateAll();

  alert(`${symbol} added to watchlist.`);
}

function addHistory(data, text) {
  if (!data.history) {
    data.history = [];
  }

  data.history.unshift({
    text: text,
    time: new Date().toLocaleString()
  });
}

function updateHistory() {
  const data = getUserData();

  if (!data.history || data.history.length === 0) {
    document.getElementById("historyList").innerHTML =
      "<p>No history yet.</p>";
    return;
  }

  document.getElementById("historyList").innerHTML = data.history.map(item =>
    `<div class="card">
      <p>${item.text}</p>
      <small>${item.time}</small>
    </div>`
  ).join("");
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

function updateAll() {
  const data = getUserData();

  document.getElementById("cashDisplay").innerText = data.cash.toFixed(2);

  updatePortfolio();
  updateWatchlist();
  updateLeaderboard();
  updateBadges();
  updateHistory();
}

function updatePortfolio() {
  const data = getUserData();
  let html = "";

  for (let symbol in data.portfolio) {
    const shares = data.portfolio[symbol];
    const stock = stocks[symbol];
    const price = stock ? stock.price : 0;
    const name = stock ? stock.name : symbol;
    const value = shares * price;

    html += `
      <div class="card">
        <h2>${name} (${symbol})</h2>
        <p>Shares: ${shares}</p>
        <p>Price: ${price ? "$" + price.toFixed(2) : "Search again to update price"}</p>
        <p>Value: $${value.toFixed(2)}</p>
      </div>
    `;
  }

  document.getElementById("portfolioList").innerHTML =
    html || "<p>No stocks owned yet.</p>";
}

function updateWatchlist() {
  const data = getUserData();
  let html = "";

  data.watchlist.forEach(symbol => {
    const stock = stocks[symbol];

    html += `
      <div class="card">
        <h2>${stock ? stock.name : symbol} (${symbol})</h2>
        <p>Price: ${stock ? "$" + stock.price.toFixed(2) : "Search again to update price"}</p>
      </div>
    `;
  });

  document.getElementById("watchlistList").innerHTML =
    html || "<p>No stocks in watchlist yet.</p>";
}

function updateLeaderboard() {
  const users = JSON.parse(localStorage.getItem("users")) || {};
  let list = [];

  for (let username in users) {
    let netWorth = users[username].cash;

    for (let symbol in users[username].portfolio) {
      const shares = users[username].portfolio[symbol];
      const price = stocks[symbol] ? stocks[symbol].price : 0;
      netWorth += shares * price;
    }

    list.push({
      username: username,
      netWorth: netWorth
    });
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

function logout() {
  currentUser = null;

  document.getElementById("appPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");

  document.getElementById("usernameInput").value = "";
  document.getElementById("passwordInput").value = "";
}
