
const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

const $ = (id) => document.getElementById(id);

const cityInput = $("cityInput");
const searchBtn = $("searchBtn");
const locationBtn = $("locationBtn");
const suggestions = $("suggestions");

let searchTimer;
let temperatureChart = null;

// Weather code descriptions based on WMO weather codes
function getWeatherInfo(code) {
    if (code === 0) return {
        text: "Clear Sky", icon: "☀️", theme: "clear"
    };

    if (code === 1 || code === 2) return {
        text: "Partly Cloudy", icon: "🌤️", theme: "clear"
    };

    if (code === 3) return {
        text: "Overcast", icon: "☁️", theme: "cloudy"
    };

    if ([45, 48].includes(code)) return {
        text: "Foggy", icon: "🌫️", theme: "cloudy"
    };

    if ([51, 53, 55, 56, 57].includes(code)) return {
        text: "Drizzle", icon: "🌦️", theme: "rainy"
    };

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return {
            text: "Rainy", icon: "🌧️", theme: "rainy"
        };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return {
            text: "Snowy", icon: "❄️", theme: "snowy"
        };
    }

    if ([95, 96, 99].includes(code)) {
        return {
            text: "Thunderstorm", icon: "⛈️", theme: "stormy"
        };
    }

    return {
        text: "Unknown", icon: "🌡️", theme: "cloudy"
    };
}


function renderTemperatureChart(data) {
    const hourly = data.hourly;
    const currentTime = data.current.time;

    const forecast = hourly.time
        .map((time, index) => ({
            time,
            temperature: hourly.temperature_2m[index]
        }))
        .filter(item => item.time >= currentTime)
        .slice(0, 12);

    const labels = forecast.map(item =>
        formatTime(item.time)
    );

    const temperatures = forecast.map(item =>
        Math.round(item.temperature)
    );

    const canvas = document.getElementById("temperatureChart");

    if (!canvas) {
        console.error("Temperature chart canvas not found!");
        return;
    }

    const ctx = canvas.getContext("2d");

    if (temperatureChart) {
        temperatureChart.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);

    gradient.addColorStop(0, "rgba(167, 139, 250, 0.4)");
    gradient.addColorStop(1, "rgba(167, 139, 250, 0)");

    temperatureChart = new Chart(ctx, {
        type: "line",

        data: {
            labels,

            datasets: [{
                label: "Temperature",
                data: temperatures,

                borderColor: "#c4b5fd",
                backgroundColor: gradient,

                borderWidth: 3,
                fill: true,
                tension: 0.4,

                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#a78bfa",
                pointBorderWidth: 2
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    backgroundColor: "#172033",
                    titleColor: "#ffffff",
                    bodyColor: "#c4b5fd",
                    padding: 12,

                    callbacks: {
                        label: context =>
                            ` ${context.parsed.y}°C`
                    }
                }
            },

            scales: {
                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#cbd5e1",
                        maxRotation: 0
                    },

                    border: {
                        display: false
                    }
                },

                y: {
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    },

                    ticks: {
                        color: "#cbd5e1",
                        callback: value => `${value}°`
                    },

                    border: {
                        display: false
                    }
                }
            }
        }
    });
}





// Loading and error handling
function showLoading(show) {
    $("loading").classList.toggle("hidden", !show);
}

function showError(message) {
    $("error").textContent = message;
    $("error").classList.remove("hidden");
    $("weatherContent").classList.add("hidden");
}

function clearError() {
    $("error").classList.add("hidden");
}

// Format a date string safely
function formatDay(dateString) {
    return new Date(dateString + "T12:00:00")
        .toLocaleDateString("en-US", { weekday: "short" });
}

function formatTime(dateString) {
    return dateString.slice(11, 16);
}

// Search for cities using the Geocoding API
async function searchCity(query) {
    const url = `${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to search for this city.");
    }

    const data = await response.json();

    return data.results || [];
}

// Display autocomplete suggestions
async function showSuggestions(query) {
    try {
        const cities = await searchCity(query);

        suggestions.innerHTML = "";

        cities.forEach(city => {
            const item = document.createElement("div");
            item.className = "suggestion";

            const label = [
                city.name,
                city.admin1,
                city.country
            ].filter(Boolean).filter((value, index, array) =>
                array.indexOf(value) === index
            ).join(", ");

            item.textContent = label;

            item.addEventListener("click", () => {
                suggestions.innerHTML = "";
                cityInput.value = label;

                getWeather(
                    city.latitude,
                    city.longitude,
                    label
                );
            });

            suggestions.appendChild(item);
        });

    } catch (error) {
        suggestions.innerHTML = "";
    }
}

// Get weather using coordinates
async function getWeather(latitude, longitude, cityName) {
    showLoading(true);
    clearError();
    suggestions.innerHTML = "";

    const params = new URLSearchParams({
        latitude,
        longitude,
        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "precipitation",
            "weather_code",
            "surface_pressure",
            "wind_speed_10m"
        ].join(","),
        hourly: [
            "temperature_2m",
            "weather_code",
            "precipitation_probability"
        ].join(","),
        daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "sunrise",
            "sunset",
            "uv_index_max"
        ].join(","),
        timezone: "auto",
        forecast_days: 5
    });

    try {
        const response = await fetch(`${BASE_URL}?${params}`);

        if (!response.ok) {
            throw new Error("Weather service is currently unavailable.");
        }

        const data = await response.json();

        if (!data.current || !data.daily || !data.hourly) {
            throw new Error("Incomplete weather data received.");
        }

        renderWeather(data, cityName);

        $("weatherContent").classList.remove("hidden");

    } catch (error) {
        showError(error.message || "Something went wrong. Please try again.");
    } finally {
        showLoading(false);
    }
}

// Update current weather
function renderWeather(data, cityName) {
    const current = data.current;
    const daily = data.daily;

    const info = getWeatherInfo(current.weather_code);

    // Dynamic background
    document.body.className = info.theme;

    // City and date
    $("cityName").textContent = cityName;

    $("dateTime").textContent =
        new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: data.timezone
        }).format(new Date(current.time));

    // Current temperature
    $("temperature").textContent =
        `${Math.round(current.temperature_2m)}°`;

    $("feelsLike").textContent =
        `${Math.round(current.apparent_temperature)}°C`;

    $("condition").textContent = info.text;
    $("weatherIcon").textContent = info.icon;

    // Today's high and low
    $("highTemp").textContent =
        `${Math.round(daily.temperature_2m_max[0])}°`;

    $("lowTemp").textContent =
        `${Math.round(daily.temperature_2m_min[0])}°`;

    // Weather details
    $("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    $("windSpeed").textContent =
        `${current.wind_speed_10m} km/h`;

    $("pressure").textContent =
        `${Math.round(current.surface_pressure)} hPa`;

    $("uvIndex").textContent =
        daily.uv_index_max[0].toFixed(1);

    renderHourly(data);
    renderDaily(data);
    renderTemperatureChart(data);
    renderSunTimes(data);
}


// Sunrise and Sunset Dashboard
function renderSunTimes(data) {

    const sunrise = data.daily.sunrise[0];
    const sunset = data.daily.sunset[0];
    const currentTime = data.current.time;

    // Extract local clock times from API
    function getMinutes(dateString) {
        const time = dateString.slice(11, 16);
        const [hours, minutes] = time.split(":").map(Number);

        return hours * 60 + minutes;
    }

    const sunriseMinutes = getMinutes(sunrise);
    const sunsetMinutes = getMinutes(sunset);
    const currentMinutes = getMinutes(currentTime);

    // Format sunrise and sunset
    function formatClock(dateString) {
    const [hour, minute] = dateString
        .slice(11, 16)
        .split(":")
        .map(Number);

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

    const sunriseElement = document.getElementById("sunriseTime");
const sunsetElement = document.getElementById("sunsetTime");
const daylightElement = document.getElementById("daylightDuration");

if (!sunriseElement || !sunsetElement || !daylightElement) {
    console.error("Missing sunrise dashboard element");
    return;
}

sunriseElement.textContent = formatClock(sunrise);
sunsetElement.textContent = formatClock(sunset);

    // Calculate daylight duration
    const daylight = sunsetMinutes - sunriseMinutes;

    const hours = Math.floor(daylight / 60);
    const minutes = daylight % 60;

    daylightElement.textContent = `${hours}h ${minutes}m`;

    // Calculate sun progress
    let progress =
        (currentMinutes - sunriseMinutes) / daylight;

    progress = Math.max(0, Math.min(1, progress));

    // Position the sun along the arc
    const angle = Math.PI * (1 - progress);

    const x = 50 + 45 * Math.cos(angle);
    const y = 125 - 105 * Math.sin(angle);

    const sun = document.querySelector(".sun-ball");
    if (!sun) {
    console.error("Sun animation element not found");
    return;
    }
    sun.style.left = `${x}%`;
    sun.style.top = `${y}px`;

    // Update sun appearance
    if (currentMinutes < sunriseMinutes ||
        currentMinutes > sunsetMinutes) {

        sun.textContent = "🌙";
        sun.style.background = "#64748b";
        sun.style.boxShadow = "0 0 15px rgba(148,163,184,.5)";

    } else {

        sun.textContent = "☀";
        sun.style.background = "#fbbf24";
        sun.style.boxShadow =
            "0 0 15px #fbbf24, 0 0 35px rgba(251,191,36,.5)";
    }
}



// Display hourly forecast
function renderHourly(data) {
    const container = $("hourlyForecast");
    container.innerHTML = "";

    const times = data.hourly.time;
    const now = data.current.time;

    let indexes = times
        .map((time, index) => ({ time, index }))
        .filter(item => item.time >= now)
        .slice(0, 12);

    indexes.forEach(({ time, index }) => {
        const temperature = data.hourly.temperature_2m[index];
        const code = data.hourly.weather_code[index];
        const rain = data.hourly.precipitation_probability[index];

        const info = getWeatherInfo(code);

        const item = document.createElement("div");
        item.className = "hourly-item";

        const timeLabel = formatTime(time);

        item.innerHTML = `
            <p>${timeLabel}</p>
            <div class="icon">${info.icon}</div>
            <h3>${Math.round(temperature)}°</h3>
            <p>${rain ?? 0}% rain</p>
        `;

        container.appendChild(item);
    });
}

// Display 5-day forecast
function renderDaily(data) {
    const container = $("dailyForecast");
    container.innerHTML = "";

    const daily = data.daily;

    daily.time.forEach((date, index) => {
        const info = getWeatherInfo(daily.weather_code[index]);

        const max = Math.round(daily.temperature_2m_max[index]);
        const min = Math.round(daily.temperature_2m_min[index]);

        const item = document.createElement("div");
        item.className = "daily-item";

        item.innerHTML = `
            <p>${index === 0 ? "Today" : formatDay(date)}</p>
            <div class="icon">${info.icon}</div>
            <p class="condition">${info.text}</p>
            <p class="temps">${max}° <span>${min}°</span></p>
        `;

        container.appendChild(item);
    });
}

// Search button
async function handleSearch() {
    const query = cityInput.value.trim();

    if (!query) {
        showError("Please enter a city name.");
        return;
    }

    suggestions.innerHTML = "";
    showLoading(true);
    clearError();

    try {
        const cities = await searchCity(query);

        if (!cities.length) {
            throw new Error("City not found. Please try another city.");
        }

        const city = cities[0];

        const label = [
            city.name,
            city.admin1,
            city.country
        ].filter(Boolean).filter((value, index, array) =>
            array.indexOf(value) === index
        ).join(", ");

        cityInput.value = label;

        await getWeather(
            city.latitude,
            city.longitude,
            label
        );

    } catch (error) {
        showError(error.message || "Unable to find the city.");
        showLoading(false);
    }
}

// Detect user's current location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    showLoading(true);
    clearError();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            cityInput.value = "My Current Location";

            await getWeather(
                latitude,
                longitude,
                "Your Location"
            );
        },
        (error) => {
            showLoading(false);

            const messages = {
                1: "Location permission denied. Please allow location access.",
                2: "Unable to determine your location.",
                3: "Location request timed out. Try again."
            };

            showError(messages[error.code] || "Unable to access your location.");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Event listeners
searchBtn.addEventListener("click", handleSearch);

cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        handleSearch();
    }
});

cityInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    const query = cityInput.value.trim();

    if (query.length < 2) {
        suggestions.innerHTML = "";
        return;
    }

    searchTimer = setTimeout(() => {
        showSuggestions(query);
    }, 350);
});

locationBtn.addEventListener("click", getCurrentLocation);

// Load default city when website opens
getWeather(22.5726, 88.3639, "Kolkata, India");
