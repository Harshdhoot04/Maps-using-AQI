/**
 * Enhanced Service for fetching and processing Air Quality Index (AQI) data
 * Features: Multi-source data integration, caching, health recommendations,
 * and averaging algorithms for improved accuracy
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

// API Keys for various AQI data providers
const OPENWEATHER_KEY = "cc89ee52f5cdf7cd8a3915cba042774f";
const IQAIR_KEY = "70c7d0a9-5a32-404b-9c78-c9bb12ea75bc";
const WAQI_TOKEN = "cb0b1f9af2c3e8a97a36dbd1e6e97c48db52abe7";

// Configuration constants
const TILE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const USE_MULTIPLE_SOURCES = true; // Enable multi-source fetching

class AQIService {
    constructor() {
        // Main cache for aggregated AQI values
        this.aqiCache = new SimpleCache({
            max: 500, // Maximum number of tiles to cache
            ttl: TILE_TTL_MS,
        });
        
        // Individual caches for each data source
        this.sourceSpecificCache = {
            openweather: new SimpleCache({ max: 300, ttl: TILE_TTL_MS }),
            iqair: new SimpleCache({ max: 300, ttl: TILE_TTL_MS }),
            waqi: new SimpleCache({ max: 300, ttl: TILE_TTL_MS })
        };
        
        // Statistics for reliability tracking
        this.sourcesStats = {
            openweather: { requests: 0, successes: 0, failures: 0 },
            iqair: { requests: 0, successes: 0, failures: 0 },
            waqi: { requests: 0, successes: 0, failures: 0 }
        };
    }

    /**
     * Get AQI for a specific latitude and longitude using multiple data sources
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {boolean} forceRefresh - Force refresh from APIs
     * @returns {Promise<Object>} - AQI value and metadata
     */
    async getAQI(lat, lng, forceRefresh = false) {
        const cacheKey = this.getTileKey(lat, lng);
        const cached = !forceRefresh ? this.aqiCache.get(cacheKey) : null;

        if (cached) {
            return cached.value !== undefined ? cached : { value: cached, source: 'cache' };
        }

        try {
            let aqiData;
            
            if (USE_MULTIPLE_SOURCES) {
                // Fetch from multiple sources and aggregate
                aqiData = await this.getAggregatedAQI(lat, lng);
            } else {
                // Fallback to single source (OpenWeather)
                aqiData = await this.getOpenWeatherAQI(lat, lng);
            }
            
            // Cache the aggregated result
            this.aqiCache.set(cacheKey, aqiData);
            return aqiData;
        } catch (error) {
            console.error("AQI fetch error:", error);
            return { value: 3, source: 'fallback', confidence: 'low' }; // Default to moderate AQI
        }
    }
    
    /**
     * Fetch AQI data from OpenWeather API
     */
    async getOpenWeatherAQI(lat, lng) {
        this.sourcesStats.openweather.requests++;
        const cacheKey = this.getTileKey(lat, lng);
        const cached = this.sourceSpecificCache.openweather.get(cacheKey);
        
        if (cached) return cached;
        
        try {
            const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch OpenWeather AQI: ${response.statusText}`);
            }

            const data = await response.json();
            const aqi = data.list?.[0]?.main?.aqi ?? -1;
            const components = data.list?.[0]?.components || {};
            
            const result = {
                value: aqi,
                source: 'openweather',
                timestamp: Date.now(),
                confidence: 'medium',
                components: {
                    pm2_5: components.pm2_5,
                    pm10: components.pm10,
                    o3: components.o3,
                    no2: components.no2
                }
            };
            
            this.sourceSpecificCache.openweather.set(cacheKey, result);
            this.sourcesStats.openweather.successes++;
            return result;
        } catch (error) {
            console.error("OpenWeather AQI fetch error:", error);
            this.sourcesStats.openweather.failures++;
            return { value: -1, source: 'openweather', error: true };
        }
    }
    
    /**
     * Fetch AQI data from IQAir API
     */
    async getIQAirAQI(lat, lng) {
        this.sourcesStats.iqair.requests++;
        const cacheKey = this.getTileKey(lat, lng);
        const cached = this.sourceSpecificCache.iqair.get(cacheKey);
        
        if (cached) return cached;
        
        try {
            const url = `https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lng}&key=${IQAIR_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch IQAir AQI: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.status !== 'success') {
                throw new Error(`IQAir API error: ${data.data?.message || 'Unknown error'}`);
            }
            
            // Convert US AQI to the 1-5 scale used by OpenWeather
            const usAqi = data.data?.current?.pollution?.aqius;
            const aqi = this.convertUSAQItoScale(usAqi);
            
            const result = {
                value: aqi,
                source: 'iqair',
                timestamp: Date.now(),
                confidence: 'high',
                rawValue: usAqi,
                components: {
                    pm2_5: data.data?.current?.pollution?.pm25 || null
                }
            };
            
            this.sourceSpecificCache.iqair.set(cacheKey, result);
            this.sourcesStats.iqair.successes++;
            return result;
        } catch (error) {
            console.error("IQAir AQI fetch error:", error);
            this.sourcesStats.iqair.failures++;
            return { value: -1, source: 'iqair', error: true };
        }
    }
    
    /**
     * Fetch AQI data from World Air Quality Index (WAQI) API
     */
    async getWAQIData(lat, lng) {
        this.sourcesStats.waqi.requests++;
        const cacheKey = this.getTileKey(lat, lng);
        const cached = this.sourceSpecificCache.waqi.get(cacheKey);
        
        if (cached) return cached;
        
        try {
            const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${WAQI_TOKEN}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch WAQI data: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.status !== 'ok') {
                throw new Error(`WAQI API error: ${data.data || 'Unknown error'}`);
            }
            
            // Convert AQI to the 1-5 scale
            const waqiValue = data.data?.aqi;
            const aqi = this.convertUSAQItoScale(waqiValue);
            
            const result = {
                value: aqi,
                source: 'waqi',
                timestamp: Date.now(),
                confidence: 'high',
                rawValue: waqiValue,
                components: {
                    pm2_5: data.data?.iaqi?.pm25?.v || null,
                    pm10: data.data?.iaqi?.pm10?.v || null,
                    o3: data.data?.iaqi?.o3?.v || null,
                    no2: data.data?.iaqi?.no2?.v || null
                },
                station: data.data?.city?.name || null
            };
            
            this.sourceSpecificCache.waqi.set(cacheKey, result);
            this.sourcesStats.waqi.successes++;
            return result;
        } catch (error) {
            console.error("WAQI data fetch error:", error);
            this.sourcesStats.waqi.failures++;
            return { value: -1, source: 'waqi', error: true };
        }
    }
    
    /**
     * Get aggregated AQI from multiple sources with intelligent weighing
     */
    async getAggregatedAQI(lat, lng) {
        // Fetch from all sources in parallel
        const [openweatherData, iqairData, waqiData] = await Promise.all([
            this.getOpenWeatherAQI(lat, lng),
            this.getIQAirAQI(lat, lng),
            this.getWAQIData(lat, lng)
        ]);
        
        // Collect valid results
        const validResults = [
            openweatherData?.value > 0 ? openweatherData : null,
            iqairData?.value > 0 ? iqairData : null,
            waqiData?.value > 0 ? waqiData : null
        ].filter(result => result !== null);
        
        // If no valid results, use OpenWeather as fallback
        if (validResults.length === 0) {
            return { value: 3, source: 'fallback', confidence: 'low' };
        }
        
        // If only one valid result, use it
        if (validResults.length === 1) {
            return validResults[0];
        }
        
        // Assign weights based on confidence and recency
        const weights = validResults.map(result => {
            let weight = 1.0;
            
            // Adjust weight based on confidence
            if (result.confidence === 'high') weight *= 1.5;
            if (result.confidence === 'low') weight *= 0.7;
            
            // Prefer WAQI and IQAir over OpenWeather as they're usually more accurate
            if (result.source === 'waqi') weight *= 1.3;
            if (result.source === 'iqair') weight *= 1.2;
            
            return weight;
        });
        
        // Calculate weighted average
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        const weightedSum = validResults.reduce(
            (sum, result, i) => sum + (result.value * weights[i]), 
            0
        );
        
        // Round to nearest integer (AQI levels are 1-5)
        const aggregatedValue = Math.round(weightedSum / totalWeight);
        
        return {
            value: aggregatedValue,
            source: 'aggregated',
            timestamp: Date.now(),
            confidence: 'high',
            sources: validResults.map(r => r.source),
            individualValues: {
                openweather: openweatherData?.value || null,
                iqair: iqairData?.value || null,
                waqi: waqiData?.value || null
            },
            components: this.aggregateComponents(validResults)
        };
    }
    
    /**
     * Aggregate pollutant components from multiple sources
     */
    aggregateComponents(results) {
        const components = {};
        const componentCount = {};
        
        results.forEach(result => {
            if (!result.components) return;
            
            Object.entries(result.components).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                
                if (!components[key]) {
                    components[key] = value;
                    componentCount[key] = 1;
                } else {
                    components[key] += value;
                    componentCount[key]++;
                }
            });
        });
        
        // Calculate averages
        Object.keys(components).forEach(key => {
            components[key] = components[key] / componentCount[key];
        });
        
        return components;
    }
    
    /**
     * Convert US AQI (0-500 scale) to OpenWeather scale (1-5)
     */
    convertUSAQItoScale(usAqi) {
        if (!usAqi || usAqi < 0) return -1;
        
        if (usAqi <= 50) return 1;       // Good
        if (usAqi <= 100) return 2;      // Moderate
        if (usAqi <= 150) return 3;      // Unhealthy for Sensitive Groups
        if (usAqi <= 200) return 4;      // Unhealthy
        return 5;                        // Very Unhealthy or Hazardous
    }

    /**
     * Get health recommendations based on AQI level and duration
     * @param {number} aqi - AQI value
     * @param {number} durationMinutes - Exposure duration in minutes
     * @returns {Object} - Health recommendation with text and risk level
     */
    getHealthRecommendation(aqi, durationMinutes = 30) {
        if (aqi === -1) {
            return { text: "AQI data not available", risk: "unknown" };
        }
        
        // Base recommendations
        let recommendation = "";
        let risk = "low";
        
        if (aqi === 1) {
            recommendation = "Safe to travel";
            risk = "very_low";
        } else if (aqi === 2) {
            recommendation = "Safe to travel. You may want to limit prolonged outdoor exercise.";
            risk = "low";
        } else if (aqi === 3) {
            recommendation = "Wear a mask if you are sensitive. Avoid prolonged outdoor exercise.";
            risk = "moderate";
        } else if (aqi === 4) {
            recommendation = "Avoid outdoor exercise and stay indoors. Consider wearing a mask.";
            risk = "high";
        } else if (aqi === 5) {
            recommendation = "It is not safe to travel. Avoid outdoor activities. Wear a mask if you must go outside.";
            risk = "very_high";
        } else {
            recommendation = "Hazardous air quality. Stay indoors and take necessary precautions.";
            risk = "very_high";
        }
        
        // Adjust based on duration
        if (durationMinutes > 60 && aqi >= 3) {
            recommendation += " Extended exposure over 60 minutes significantly increases health risks.";
            // Increase risk by one level for long exposure
            if (risk === "moderate") risk = "high";
            else if (risk === "low") risk = "moderate";
        } else if (durationMinutes < 10 && aqi <= 4) {
            recommendation += " Brief exposure under 10 minutes reduces some health risks.";
            // Potentially decrease risk for very short exposure
            if (risk === "high") risk = "moderate";
        }
        
        return { text: recommendation, risk };
    }
    
    /**
     * Get detailed AQI report with health risks and components
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {Promise<Object>} - Detailed AQI report
     */
    async getDetailedAQIReport(lat, lng) {
        const aqiData = await this.getAQI(lat, lng, true);
        const healthRec = this.getHealthRecommendation(aqiData.value);
        
        return {
            aqi: aqiData.value,
            level: this.getAQILevelName(aqiData.value),
            health: healthRec,
            components: aqiData.components || {},
            sources: aqiData.sources || [aqiData.source],
            confidence: aqiData.confidence || 'medium',
            timestamp: aqiData.timestamp || Date.now(),
            location: { lat, lng }
        };
    }
    
    /**
     * Get human-readable AQI level name
     */
    getAQILevelName(aqi) {
        if (aqi === -1) return "Unknown";
        if (aqi === 1) return "Good";
        if (aqi === 2) return "Fair";
        if (aqi === 3) return "Moderate";
        if (aqi === 4) return "Poor";
        if (aqi === 5) return "Very Poor";
        return "Unknown";
    }

    /**
     * Create a key for tile-based caching
     */
    getTileKey(lat, lng, tileSize = 0.02) {
        const latKey = Math.floor(lat / tileSize);
        const lngKey = Math.floor(lng / tileSize);
        return `${latKey}_${lngKey}`;
    }
    
    /**
     * Get reliability statistics for data sources
     */
    getSourcesStats() {
        const stats = {};
        
        for (const [source, data] of Object.entries(this.sourcesStats)) {
            stats[source] = {
                ...data,
                successRate: data.requests > 0 ? 
                    (data.successes / data.requests * 100).toFixed(1) + '%' : '0%'
            };
        }
        
        return stats;
    }
    
    /**
     * Get AQI forecast for a location
     * Currently uses OpenWeather forecast API
     */
    async getAQIForecast(lat, lng) {
        try {
            const url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch AQI forecast: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.list || !data.list.length) {
                throw new Error('No forecast data available');
            }
            
            // Process forecast data into daily segments
            const forecastByDay = {};
            const now = new Date();
            
            data.list.forEach(item => {
                const date = new Date(item.dt * 1000);
                const dayKey = date.toISOString().split('T')[0];
                
                if (!forecastByDay[dayKey]) {
                    forecastByDay[dayKey] = {
                        date: dayKey,
                        aqiValues: [],
                        components: {
                            pm2_5: [],
                            pm10: [],
                            o3: [],
                            no2: []
                        }
                    };
                }
                
                forecastByDay[dayKey].aqiValues.push(item.main.aqi);
                forecastByDay[dayKey].components.pm2_5.push(item.components.pm2_5);
                forecastByDay[dayKey].components.pm10.push(item.components.pm10);
                forecastByDay[dayKey].components.o3.push(item.components.o3);
                forecastByDay[dayKey].components.no2.push(item.components.no2);
            });
            
            // Calculate daily averages and max values
            const forecast = Object.values(forecastByDay).map(day => {
                const avgAqi = Math.round(day.aqiValues.reduce((sum, val) => sum + val, 0) / day.aqiValues.length);
                const maxAqi = Math.max(...day.aqiValues);
                
                // Average components
                const avgComponents = {};
                Object.keys(day.components).forEach(component => {
                    avgComponents[component] = day.components[component].reduce((sum, val) => sum + val, 0) / 
                                              day.components[component].length;
                });
                
                return {
                    date: day.date,
                    avgAqi,
                    maxAqi,
                    components: avgComponents,
                    healthRisk: this.getHealthRecommendation(avgAqi).risk
                };
            });
            
            return forecast;
        } catch (error) {
            console.error("AQI forecast error:", error);
            return [];
        }
    }
}

export default new AQIService();
