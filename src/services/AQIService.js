/**
 * Service for fetching and processing Air Quality Index (AQI) data
 * Features: Caching, health recommendations, and integration with OpenWeather API
 */
// Simple in-memory cache implementation for browser compatibility
class SimpleCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.max || 500;
        this.ttl = options.ttl || 30 * 60 * 1000;
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return undefined;
        
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        
        return item.value;
    }
    
    set(key, value) {
        // Simple LRU: if cache is full, delete oldest entries
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value: value,
            timestamp: Date.now()
        });
    }
}

const OPENWEATHER_KEY = "cc89ee52f5cdf7cd8a3915cba042774f";
const TILE_TTL_MS = 30 * 60 * 1000; // 30 minutes

class AQIService {
    constructor() {
        this.aqiCache = new SimpleCache({
            max: 500, // Maximum number of tiles to cache
            ttl: TILE_TTL_MS,
        });
    }

    /**
     * Get AQI for a specific latitude and longitude
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<number>} - AQI value (-1 if unavailable)
     */
    async getAQI(lat, lng) {
        const cacheKey = this.getTileKey(lat, lng);
        const cached = this.aqiCache.get(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch AQI data: ${response.statusText}`);
            }

            const data = await response.json();
            const aqi = data.list?.[0]?.main?.aqi ?? -1;
            
            this.aqiCache.set(cacheKey, aqi);
            return aqi;
        } catch (error) {
            console.error("AQI fetch error:", error);
            return -1;
        }
    }

    /**
     * Get health recommendations based on AQI level
     * @param {number} aqi - AQI value
     * @returns {string} - Health recommendation text
     */
    getHealthRecommendation(aqi) {
        if (aqi === -1) return "AQI data not available";
        if (aqi === 1) return "Safe to travel";
        if (aqi === 2) return "Safe to travel. You may want to limit outdoor exercise.";
        if (aqi === 3) return "Wear a mask if you are sensitive. Avoid prolonged outdoor exercise.";
        if (aqi === 4) return "Avoid outdoor exercise and stay indoors. Consider wearing a mask.";
        if (aqi === 5) return "It is not safe to travel. Avoid outdoor activities. Wear a mask if you must go outside.";
        return "Hazardous air quality. Stay indoors and take necessary precautions.";
    }

    /**
     * Create a key for tile-based caching
     */
    getTileKey(lat, lng, tileSize = 0.02) {
        const latKey = Math.floor(lat / tileSize);
        const lngKey = Math.floor(lng / tileSize);
        return `${latKey}_${lngKey}`;
    }
}

export default new AQIService();
