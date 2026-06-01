const API_KEY = "YOUR_FINNHUB_API_KEY_HERE";

async function searchStock() {
  const searchInput = document.getElementById("stockSearch").value.trim();

  if (searchInput === "") {
    alert("Type a company name or stock symbol.");
    return;
  }

  try {
    const company = await findCompany(searchInput);

    if (!company) {
      alert("Company not found.");
      return;
    }

    const price = await getStockPrice(company.symbol);

    document.getElementById("stockName").textContent = company.description;
    document.getElementById("stockSymbol").textContent = company.symbol;
    document.getElementById("stockPrice").textContent = "$" + price.toFixed(2);

  } catch (error) {
    console.error(error);
    alert("Something went wrong loading the stock.");
  }
}

async function findCompany(searchInput) {
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(searchInput)}&token=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.result || data.result.length === 0) {
    return null;
  }

  return data.result.find(stock => stock.type === "Common Stock") || data.result[0];
}

function isMarketOpen() {
  const now = new Date();

  const easternTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  const day = easternTime.getDay();
  const hour = easternTime.getHours();
  const minute = easternTime.getMinutes();

  const totalMinutes = hour * 60 + minute;

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;

  return (
    day >= 1 &&
    day <= 5 &&
    totalMinutes >= marketOpen &&
    totalMinutes < marketClose
  );
}

async function getStockPrice(symbol) {
  if (isMarketOpen()) {
    document.getElementById("marketStatus").textContent =
      "Market open — using real stock price.";

    const realPrice = await fetchRealStockPrice(symbol);

    localStorage.setItem(`${symbol}_savedPrice`, realPrice);
    localStorage.setItem(`${symbol}_lastChangeDate`, getToday());

    return realPrice;
  }

  document.getElementById("marketStatus").textContent =
    "Market closed — game is open, price changes only 1 cent per day.";

  return getClosedMarketPrice(symbol);
}

async function fetchRealStockPrice(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.c || data.c === 0) {
    throw new Error("Price unavailable.");
  }

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
