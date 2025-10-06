// Import configuration
import config from './src/config.js';

// Configuration - Load from config module or window object
const OPENWEATHER_KEY = config.OPENWEATHER_KEY || window.OPENWEATHER_KEY || "your_openweather_api_key_here";
const OPENCAGE_KEY = config.OPENCAGE_KEY || window.OPENCAGE_KEY || "your_opencage_api_key_here";

// Initialize map
const map = L.map("map").setView([18.5204, 73.8567], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// DOM elements
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const findRouteBtn = document.getElementById("find-route");
const statusDiv = document.getElementById("status");
const routeInfo = document.getElementById("route-info");
const avgAqiSpan = document.getElementById("avg-aqi");
const routeDistanceSpan = document.getElementById("route-distance");
const routeDurationSpan = document.getElementById("route-duration");
const avoidHighAqiToggle = document.getElementById("avoid-high-aqi");
const routeTypeSelect = document.getElementById("route-type");
const locateMeBtn = document.getElementById("locate-me");
// const toggleLayersBtn = document.getElementById("toggle-layers"); // Removed

// Mobile Sidebar Toggle - handled by React component
// const sidebarToggle = document.getElementById('sidebar-toggle');
// const sidebar = document.getElementById('sidebar');

// State
let currentMarkers = [];
let routePolylines = [];
let routingControl = null;
let aqiBadgeMarkers = [];
let userLocation = null;

// AQI colors
const aqiColors = {
    1: "#00e400", 2: "#ffff00", 3: "#ff7e00",
    4: "#ff0000", 5: "#8f3f97", unavailable: "#cccccc"
};

// Initialize
addAQILegend();
setupMapControls();

// Utility: Loader control
function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}
function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

// Map Controls Setup
function setupMapControls() {
    locateMeBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            showLoader();
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                    map.setView(userLocation, 15);
                    addMarker(userLocation, "Your Location");
                    hideLoader();
                },
                (error) => {
                    showStatus("Could not get your location: " + error.message, true);
                    hideLoader();
                }
            );
        } else {
            showStatus("Geolocation is not supported by your browser", true);
        }
    });

    // Removed toggle layers functionality
}

// AQI Legend
function addAQILegend() {
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
        const div = L.DomUtil.create("div", "aqi-legend");
        div.innerHTML = "<h4>AQI Levels</h4>";
        [1, 2, 3, 4, 5].forEach(i => {
            div.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background:${aqiColors[i]}"></div>
                    <span>${i} - ${["Good", "Fair", "Moderate", "Poor", "Very Poor"][i - 1]}</span>
                </div>`;
        });
        return div;
    };
    legend.addTo(map);
}

function clearMap() {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    routePolylines.forEach(polyline => map.removeLayer(polyline));
    aqiBadgeMarkers.forEach(badge => map.removeLayer(badge));
    if (routingControl) map.removeControl(routingControl);
    currentMarkers = [];
    routePolylines = [];
    aqiBadgeMarkers = [];
    routeInfo.classList.add("hidden");
}

function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = isError ? "error" : "info";
    statusDiv.style.display = "block";
    if (!isError) setTimeout(() => statusDiv.style.display = "none", 5000);
}

async function geocodeAddress(location) {
    try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(location)}&key=${OPENCAGE_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        return L.latLng(data.results[0].geometry.lat, data.results[0].geometry.lng);
    } catch (error) {
        throw new Error("Location not found");
    }
}

// --- AQI Tile Cache Optimisation ---
// Tile size ~2km (≈0.02° lat/lng); cache stored in localStorage with 30-minute TTL
const TILE_SIZE = 0.02;
const TILE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getTileKey(lat, lng) {
    const latKey = Math.floor(lat / TILE_SIZE);
    const lngKey = Math.floor(lng / TILE_SIZE);
    return `${latKey}_${lngKey}`;
}

function readTileFromCache(key) {
    try {
        const raw = localStorage.getItem(`aqi_tile_${key}`);
        if (!raw) return null;
        const { aqi, ts } = JSON.parse(raw);
        if (Date.now() - ts > TILE_TTL_MS) {
            localStorage.removeItem(`aqi_tile_${key}`);
            return null;
        }
        return aqi;
    } catch {
        return null;
    }
}

function writeTileToCache(key, aqi) {
    try {
        localStorage.setItem(`aqi_tile_${key}` , JSON.stringify({ aqi, ts: Date.now() }));
    } catch {
        // ignore quota errors
    }
}

async function getAQI(lat, lng) {
    const tileKey = getTileKey(lat, lng);
    const cached = readTileFromCache(tileKey);
    if (cached !== null) return cached;

    try {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const aqi = data.list?.[0]?.main?.aqi || -1;
        writeTileToCache(tileKey, aqi);
        return aqi;
    } catch {
        return -1;
    }
}

// Health recommendations based on OpenWeather AQI levels (1 to 5)
function getHealthRecommendation(aqi) {
    if (aqi === -1) {
        return "AQI data not available";
    } else if (aqi === 1) {
        return "Safe to travel";  // AQI 1 - Good
    } else if (aqi === 2) {
        return "Safe to travel. You may want to limit outdoor exercise.";  // AQI 2 - Fair
    } else if (aqi === 3) {
        return "Wear a mask if you are sensitive to air quality. Avoid prolonged outdoor exercise.";  // AQI 3 - Moderate
    } else if (aqi === 4) {
        return "Avoid outdoor exercise and stay indoors. Consider wearing a mask.";  // AQI 4 - Poor
    } else if (aqi === 5) {
        return "It is not safe to travel. Avoid outdoor activities. Wear a mask if you must go outside.";  // AQI 5 - Very Poor
    } else {
        return "Hazardous air quality. Stay indoors and take necessary precautions.";  // AQI > 5 - Hazardous (if needed)
    }
}

async function addMarker(point, label) {
    const aqi = await getAQI(point.lat, point.lng);
    const color = aqiColors[aqi] || aqiColors.unavailable;
    const healthRecommendation = getHealthRecommendation(aqi); // Get health recommendation

    const marker = L.marker(point, {
        icon: new L.Icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        }),
        riseOnHover: true
    });

    const aqiBadge = L.divIcon({
        className: 'aqi-badge',
        html: `<div style="background:${color}">${aqi > 0 ? aqi : '?'}</div>`,
        iconSize: [20, 20]
    });

    const aqiBadgeMarker = L.marker(point, {
        icon: aqiBadge,
        zIndexOffset: 1000,
        interactive: false
    }).addTo(map);
    
    aqiBadgeMarkers.push(aqiBadgeMarker);

    marker.bindPopup(`
        <div class="marker-popup">
            <h3>${label}</h3>
            <p><strong>AQI:</strong> ${aqi > 0 ? aqi : 'N/A'}</p>
            <p><strong>Health Recommendation:</strong> ${healthRecommendation}</p>
        </div>
    `).addTo(map);
    currentMarkers.push(marker);
    return marker;
}

async function processRoutes(routes) {
    routePolylines = [];
    let bestRouteIndex = -1;
    let bestAQI = Infinity;
    let shortestDistance = Infinity;

    // First pass: Calculate AQI for all routes
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        let totalAQI = 0, count = 0;

        for (let j = 0; j < route.coordinates.length; j += Math.max(5, Math.floor(route.coordinates.length / 20))) {
            const { lat, lng } = route.coordinates[j];
            const aqi = await getAQI(lat, lng);
            if (aqi !== -1) { totalAQI += aqi; count++; }
        }

        const avgAQI = count > 0 ? (totalAQI / count) : -1;
        route.avgAQI = avgAQI; // Store AQI for later use
    }

    // Second pass: Find best route based on user preference
    const routeType = routeTypeSelect.value;
    const shouldAvoidHighAQI = avoidHighAqiToggle.checked;

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const avgAQI = route.avgAQI;
        const distance = route.summary?.totalDistance || Infinity;

        // Skip routes with high AQI if the user wants to avoid them
        if (shouldAvoidHighAQI && avgAQI >= 4) continue;

        if (routeType === 'aqi' && avgAQI !== -1 && avgAQI < bestAQI) {
            bestAQI = avgAQI;
            bestRouteIndex = i;
        } else if (routeType === 'distance' && distance < shortestDistance) {
            shortestDistance = distance;
            bestRouteIndex = i;
        } else if (routeType === 'balanced') {
            // For balanced mode, we'll use a weighted score
            const aqiScore = avgAQI !== -1 ? avgAQI : 5; // Use worst AQI if unknown
            const distanceScore = distance / 1000; // Convert to km
            const totalScore = (aqiScore * 0.7) + (distanceScore * 0.3); // 70% AQI, 30% distance

            if (totalScore < (routes[bestRouteIndex]?.totalScore || Infinity)) {
                bestRouteIndex = i;
                route.totalScore = totalScore;
            }
        }
    }

    // Third pass: Draw routes with appropriate styling
    // For AQI and Distance modes, show only the best route
    // For Balanced mode, show all routes with best highlighted
    const showAllRoutes = routeType === 'balanced';
    const routesToShow = showAllRoutes ? routes : (bestRouteIndex !== -1 ? [routes[bestRouteIndex]] : routes);
    
    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const avgAQI = route.avgAQI;
        const routeColor = aqiColors[avgAQI !== -1 ? Math.round(avgAQI) : 'unavailable'];
        
        // Skip non-best routes for AQI and Distance modes
        if (!showAllRoutes && i !== bestRouteIndex) {
            continue;
        }

        const polyline = L.polyline(route.coordinates, {
            color: routeColor,
            weight: i === bestRouteIndex ? 8 : 6,
            opacity: i === bestRouteIndex ? 1 : 0.9,
            dashArray: i === bestRouteIndex ? '8, 6' : null,
            className: 'route-line'
        }).on('click', (e) => {
            const routeLabel = showAllRoutes ? 
                `Route ${i + 1} ${i === bestRouteIndex ? "(Best Route)" : ""}` :
                getRouteTypeLabel(routeType);
            
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`
                    <div class="route-popup">
                        <h3>${routeLabel}</h3>
                        <p><strong>Average AQI:</strong> ${avgAQI === -1 ? 'N/A' : avgAQI.toFixed(1)}</p>
                        <p><strong>Distance:</strong> ${(route.summary.totalDistance / 1000).toFixed(1)} km</p>
                        <p><strong>Duration:</strong> ${Math.round(route.summary.totalTime / 60)} minutes</p>
                        ${routeType === 'balanced' ? `<p><strong>Route Score:</strong> ${route.totalScore?.toFixed(2) || 'N/A'}</p>` : ''}
                        ${routeType === 'aqi' ? '<p><em>Optimized for best air quality</em></p>' : ''}
                        ${routeType === 'distance' ? '<p><em>Optimized for shortest distance</em></p>' : ''}
                    </div>
                `)
                .openOn(map);
        }).addTo(map);

        routePolylines.push(polyline);
    }

    // Update route info panel if we found a best route
    if (bestRouteIndex !== -1) {
        const bestRoute = routes[bestRouteIndex];
        avgAqiSpan.textContent = bestRoute.avgAQI ? bestRoute.avgAQI.toFixed(1) : 'N/A';
        routeDistanceSpan.textContent = `${(bestRoute.summary.totalDistance / 1000).toFixed(1)} km`;
        routeDurationSpan.textContent = `${Math.round(bestRoute.summary.totalTime / 60)} minutes`;
        routeInfo.classList.remove("hidden");
    }

    if (routes.length > 0) {
        map.fitBounds(L.latLngBounds(routes.flatMap(r => r.coordinates)).pad(0.2));
    }
}

// Helper function to get route type label
function getRouteTypeLabel(routeType) {
    switch(routeType) {
        case 'aqi': return 'Best AQI Route';
        case 'distance': return 'Shortest Distance Route';
        case 'balanced': return 'Balanced Route';
        default: return 'Optimal Route';
    }
}

// Event listeners
findRouteBtn.addEventListener("click", async () => {
    const start = startInput.value.trim();
    const end = endInput.value.trim();

    if (!start || !end) {
        showStatus("Please enter both locations", true);
        return;
    }

    try {
        showLoader();
        showStatus("Finding route...");
        clearMap();

        const startPoint = await geocodeAddress(start);
        const endPoint = await geocodeAddress(end);

        await Promise.all([
            addMarker(startPoint, "Start"),
            addMarker(endPoint, "End")
        ]);

        if (routingControl) {
            map.removeControl(routingControl);
        }

        routingControl = L.Routing.control({
            waypoints: [startPoint, endPoint],
            routeWhileDragging: false,
            showAlternatives: true,
            addWaypoints: false,
            fitSelectedRoutes: false,
            createMarker: () => null,
            lineOptions: { styles: [] },
            altLineOptions: { styles: [] },
            router: L.Routing.osrmv1({
                serviceUrl: "https://router.project-osrm.org/route/v1"
            })
        }).addTo(map);

        routingControl.on('routesfound', function (e) {
            processRoutes(e.routes).then(hideLoader);
        });

        routingControl.on('routingerror', function (e) {
            showStatus("Error finding route: " + e.error.message, true);
            hideLoader();
        });

    } catch (error) {
        showStatus(error.message, true);
        hideLoader();
    }
});

// Mobile sidebar toggle is handled by React component

// Adjust map controls for mobile
function adjustMapControls() {
    const mapControls = document.getElementById('map-controls');
    if (window.innerWidth <= 768) {
        mapControls.style.flexDirection = 'row';
        mapControls.style.bottom = '20px';
        mapControls.style.top = 'auto';
    } else {
        mapControls.style.flexDirection = 'column';
        mapControls.style.top = '20px';
        mapControls.style.bottom = 'auto';
    }
}

// Call on load and resize
window.addEventListener('load', adjustMapControls);
window.addEventListener('resize', adjustMapControls);