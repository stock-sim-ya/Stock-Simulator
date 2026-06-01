const API_KEY = "YOUR_FINNHUB_API_KEY_HERE";

let currentUser = null;
let selectedStock = null;
let selectedPrice = 0;

function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || {};
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function loginUser() {
  const username = document.getElementById("usernameInput").value.trim();

  if (!username) {
    alert("Enter a username.");
    return;
  }

  const users = getUsers();

  if (!users[username]) {
    users[username] = {
      cash: 10000,
      portfolio: {},
      watchlist: [],
      badges: [],
      trades: 0
    };
  }

  currentUser = username;
  saveUsers(users);
  updateDashboard();
}

async function searchStock() {
  const searchInput = document.getElementById("stockSearch").value.trim();

  if (!searchInput) {
    alert("Type a company name or stock symbol.");
    return;
  }

  const company = await findCompany(searchInput);

  if (!company) {
    alert("Stock not found.");
    return;
  }

  selectedStock = company;
  selectedPrice = await getStockPrice(company.symbol);

  document.getElementById("stockName").textContent = company.description;
  document.getElementById("stockSymbol").textContent = company.symbol;
  document.getElementById("stockPrice").textContent = "$" + selectedPrice.toFixed(2);

  drawChart(company.symbol, selectedPrice);
  loadNews(company.symbol);
}

async function findCompany(searchInput) {
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(searchInput)}&token=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.result || data.result.length === 0) return null;

  return data.result.find(stock => stock.type === "Common Stock") || data.result[0];
}

function isMarketOpen() {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  const day = easternTime.getDay();
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();
  const totalMinutes = hour * 60 + minute;

  return day >= 1 && day <= 5 && totalMinutes >= 570 && totalMinutes < 960;
}

async function getStockPrice(symbol) {
  if (isMarketOpen()) {
    document.getElementById("marketStatus").textContent =
      "Market open — real stock price.";

    const realPrice = await fetchRealStockPrice(symbol);

    localStorage.setItem(`${symbol}_savedPrice`, realPrice);
    localStorage.setItem(`${symbol}_lastChangeDate`, getToday());

    return realPrice;
  }

  document.getElementById("marketStatus").textContent =
    "Market closed — game open, price changes only 1 cent per day.";

  return getClosedMarketPrice(symbol);
}

async function fetchRealStockPrice(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.c || data.c === 0) throw new Error("Price unavailable.");

  return data.c;
}

function getClosedMarketPrice(symbol) {
  const today = getToday();

  let price = Number(localStorage.getItem(`${symbol}_savedPrice`)) || 100;
  const lastChangeDate = localStorage.getItem(`${symbol}_lastChangeDate`);

  if (lastChangeDate !== today) {
    const direction = Math.random() < 0.5 ? -0.01 : 0.01;
    price = Number((price + direction).toFixed(2));

    localStorage.setItem(`${symbol}_savedPrice`, price);
    localStorage.setItem(`${symbol}_lastChangeDate`, today);
  }

  return price;
}

function buyShares() {
  if (!currentUser) return alert("Login first.");
  if (!selectedStock) return alert("Search a stock first.");

  const shares = Number(document.getElementById("sharesInput").value);
  if (shares <= 0) return alert("Enter shares.");

  const cost = shares * selectedPrice;
  const users = getUsers();
  const user = users[currentUser];

  if (user.cash < cost) return alert("Not enough cash.");

  user.cash -= cost;

  if (!user.portfolio[selectedStock.symbol]) {
    user.portfolio[selectedStock.symbol] = {
      name: selectedStock.description,
      shares: 0,
      avgPrice: selectedPrice
    };
  }

  user.portfolio[selectedStock.symbol].shares += shares;
  user.trades++;

  awardBadges(user);
  saveUsers(users);
  updateDashboard();
}

function sellShares() {
  if (!currentUser) return alert("Login first.");
  if (!selectedStock) return alert("Search a stock first.");

  const shares = Number(document.getElementById("sharesInput").value);
  const users = getUsers();
  const user = users[currentUser];

  if (!user.portfolio[selectedStock.symbol]) return alert("You do not own this stock.");
  if (user.portfolio[selectedStock.symbol].shares < shares) return alert("Not enough shares.");

  user.portfolio[selectedStock.symbol].shares -= shares;
  user.cash += shares * selectedPrice;
  user.trades++;

  if (user.portfolio[selectedStock.symbol].shares === 0) {
    delete user.portfolio[selectedStock.symbol];
  }

  awardBadges(user);
  saveUsers(users);
  updateDashboard();
}

function addToWatchlist() {
  if (!currentUser) return alert("Login first.");
  if (!selectedStock) return alert("Search a stock first.");

  const users = getUsers();
  const user = users[currentUser];

  if (!user.watchlist.includes(selectedStock.symbol)) {
    user.watchlist.push(selectedStock.symbol);
  }

  saveUsers(users);
  updateDashboard();
}

function updateDashboard() {
  const users = getUsers();
  const user = users[currentUser];

  document.getElementById("currentUser").textContent = "User: " + currentUser;
  document.getElementById("cashDisplay").textContent = "Cash: $" + user.cash.toFixed(2);

  let portfolioHTML = "";
  let netWorth = user.cash;

  for (const symbol in user.portfolio) {
    const stock = user.portfolio[symbol];
    const savedPrice = Number(localStorage.getItem(`${symbol}_savedPrice`)) || stock.avgPrice;
    const value = stock.shares * savedPrice;
    netWorth += value;

    portfolioHTML += `
      <div class="item">
        <strong>${symbol}</strong> - ${stock.shares} shares<br>
        Value: $${value.toFixed(2)}
      </div>
    `;
  }

  document.getElementById("portfolioList").innerHTML =
    portfolioHTML || "No stocks owned yet.";

  document.getElementById("netWorthDisplay").textContent =
    "Net Worth: $" + netWorth.toFixed(2);

  document.getElementById("watchlist").innerHTML =
    user.watchlist.map(symbol => `<div class="item">${symbol}</div>`).join("") ||
    "No watchlist stocks yet.";

  document.getElementById("badges").innerHTML =
    user.badges.map(badge => `<span class="badge">${badge}</span>`).join("") ||
    "No badges yet.";

  updateLeaderboard();
}

function awardBadges(user) {
  if (user.trades >= 1 && !user.badges.includes("First Trade")) {
    user.badges.push("First Trade");
  }

  if (user.trades >= 5 && !user.badges.includes("Active Trader")) {
    user.badges.push("Active Trader");
  }

  if (Object.keys(user.portfolio).length >= 3 && !user.badges.includes("Diversified")) {
    user.badges.push("Diversified");
  }

  if (user.cash >= 12000 && !user.badges.includes("Profit Master")) {
    user.badges.push("Profit Master");
  }
}

function updateLeaderboard() {
  const users = getUsers();

  const leaderboard = Object.keys(users).map(username => {
    const user = users[username];
    let netWorth = user.cash;

    for (const symbol in user.portfolio) {
      const stock = user.portfolio[symbol];
      const savedPrice = Number(localStorage.getItem(`${symbol}_savedPrice`)) || stock.avgPrice;
      netWorth += stock.shares * savedPrice;
    }

    return { username, netWorth };
  });

  leaderboard.sort((a, b) => b.netWorth - a.netWorth);

  document.getElementById("leaderboard").innerHTML =
    leaderboard.map((u, index) =>
      `<div class="item">#${index + 1} ${u.username}: $${u.netWorth.toFixed(2)}</div>`
    ).join("");
}

function drawChart(symbol, price) {
  const canvas = document.getElementById("stockChart");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let points = [];
  let start = price;

  for (let i = 0; i < 20; i++) {
    start += (Math.random() - 0.5) * 4;
    points.push(start);
  }

  const max = Math.max(...points);
  const min = Math.min(...points);

  ctx.beginPath();

  points.forEach((point, index) => {
    const x = (index / (points.length - 1)) * canvas.width;
    const y = canvas.height - ((point - min) / (max - min)) * canvas.height;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.fillText(symbol + " chart", 10, 20);
}

async function loadNews(symbol) {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);

  const from = weekAgo.toISOString().split("T")[0];
  const to = today.toISOString().split("T")[0];

  try {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${API_KEY}`;
    const response = await fetch(url);
    const news = await response.json();

    if (!news || news.length === 0) {
      document.getElementById("newsFeed").innerHTML = "No recent news found.";
      return;
    }

    document.getElementById("newsFeed").innerHTML =
      news.slice(0, 5).map(article => `
        <div class="item">
          <strong>${article.headline}</strong><br>
          <a href="${article.url}" target="_blank">Read more</a>
        </div>
      `).join("");

  } catch {
    document.getElementById("newsFeed").innerHTML = "News could not load.";
  }
}

function getToday() {
  const now = new Date();

  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}
