const $ = (id) => document.getElementById(id);

const CONDITIONS = [
  [[0], "Clear", "☀️"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "🌨️"],
  [[95, 96, 99], "Thunderstorm", "⛈️"],
];

const describe = (code) =>
  CONDITIONS.find(([codes]) => codes.includes(code)) || [[], "Unknown", "❓"];

let useFahrenheit = read("weather.units") === "F";
let lastResult = null;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Saving preferences is optional.
  }
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function findCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(name)}`;
  const data = await getJson(url);
  return data.results?.[0] || null;
}

function getForecast({ latitude, longitude }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5,
  });
  return getJson(url);
}

const degrees = (celsius) =>
  `${Math.round(useFahrenheit ? (celsius * 9) / 5 + 32 : celsius)}°`;

function dayName(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}

function render() {
  $("units").textContent = useFahrenheit ? "°F" : "°C";
  if (!lastResult) return;

  const { place, weather } = lastResult;
  const { current, daily } = weather;
  const [, label] = describe(current.weather_code);

  $("place").textContent = [place.name, place.country].filter(Boolean).join(", ");
  $("condition").textContent = label;
  $("temp").textContent = degrees(current.temperature_2m);
  $("feels").textContent = degrees(current.apparent_temperature);
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;

  const days = daily.time.map((date, i) => {
    const [, dayLabel, icon] = describe(daily.weather_code[i]);
    const card = document.createElement("div");
    card.className = "day";

    const name = document.createElement("p");
    name.textContent = dayName(date);

    const symbol = document.createElement("p");
    symbol.className = "icon";
    symbol.textContent = icon;
    symbol.title = dayLabel;

    const high = document.createElement("p");
    high.textContent = degrees(daily.temperature_2m_max[i]);

    const low = document.createElement("p");
    low.className = "low";
    low.textContent = degrees(daily.temperature_2m_min[i]);

    card.append(name, symbol, high, low);
    return card;
  });

  $("forecast").replaceChildren(...days);
  $("current").hidden = false;
  $("forecast").hidden = false;
}

async function search(name) {
  $("status").textContent = "Loading…";
  try {
    const place = await findCity(name);
    if (!place) {
      $("status").textContent = `No city found for "${name}".`;
      return;
    }
    lastResult = { place, weather: await getForecast(place) };
    $("status").textContent = "";
    write("weather.city", place.name);
    render();
  } catch {
    $("status").textContent = "Couldn't load the weather. Please try again.";
  }
}

$("search").addEventListener("submit", (event) => {
  event.preventDefault();
  search($("city").value.trim());
});

$("units").addEventListener("click", () => {
  useFahrenheit = !useFahrenheit;
  write("weather.units", useFahrenheit ? "F" : "C");
  render();
});

render();
search(read("weather.city") || "Casablanca");
