/**
 * Enhanced Graph-based routing service implementing multi-objective shortest-exposure routing
 * Features: Dijkstra/A*, Pareto front optimization, real-time multi-source AQI data
 */

import dijkstra from 'dijkstrajs';
import AQIService from './AQIService.js';

class GraphRoutingService {
    constructor() {
        this.roadGraph = new Map(); // Adjacency list representation
        this.nodePositions = new Map(); // lat,lng for each node
        this.edgeWeights = new Map(); // Stores both distance and AQI exposure weights
        this.aqiCache = new Map(); // Cache for AQI values
    }

    /**
     * Build road network graph from route coordinates
     * @param {Array} routes - Array of route objects with coordinates
     */
    buildRoadGraph(routes) {
        console.log('Building road graph from routes...');
        this.roadGraph.clear();
        this.nodePositions.clear();
        this.edgeWeights.clear();
        
        let nodeId = 0;
        const coordinateToNodeId = new Map();
        
        // Create nodes for each route point
        routes.forEach((route, routeIndex) => {
            route.coordinates.forEach((coord, coordIndex) => {
                const coordKey = `${coord.lat.toFixed(5)}_${coord.lng.toFixed(5)}`;
                
                if (!coordinateToNodeId.has(coordKey)) {
                    coordinateToNodeId.set(coordKey, nodeId);
                    this.nodePositions.set(nodeId, coord);
                    this.roadGraph.set(nodeId, new Map());
                    nodeId++;
                }
            });
        });
        
        // Create edges between consecutive points in each route
        routes.forEach((route, routeIndex) => {
            for (let i = 0; i < route.coordinates.length - 1; i++) {
                const coord1 = route.coordinates[i];
                const coord2 = route.coordinates[i + 1];
                
                const key1 = `${coord1.lat.toFixed(5)}_${coord1.lng.toFixed(5)}`;
                const key2 = `${coord2.lat.toFixed(5)}_${coord2.lng.toFixed(5)}`;
                
                const nodeId1 = coordinateToNodeId.get(key1);
                const nodeId2 = coordinateToNodeId.get(key2);
                
                if (nodeId1 !== undefined && nodeId2 !== undefined) {
                    const distance = this.calculateDistance(coord1, coord2);
                    
                    // Add bidirectional edges
                    this.roadGraph.get(nodeId1).set(nodeId2, distance);
                    this.roadGraph.get(nodeId2).set(nodeId1, distance);
                    
                    // Store edge weights for later AQI calculation
                    const edgeKey1 = `${nodeId1}_${nodeId2}`;
                    const edgeKey2 = `${nodeId2}_${nodeId1}`;
                    
                    this.edgeWeights.set(edgeKey1, {
                        distance,
                        midpoint: {
                            lat: (coord1.lat + coord2.lat) / 2,
                            lng: (coord1.lng + coord2.lng) / 2
                        },
                        estimatedTravelTime: distance / 13.89 // ~50 km/h average speed
                    });
                    
                    this.edgeWeights.set(edgeKey2, {
                        distance,
                        midpoint: {
                            lat: (coord1.lat + coord2.lat) / 2,
                            lng: (coord1.lng + coord2.lng) / 2
                        },
                        estimatedTravelTime: distance / 13.89
                    });
                }
            }
        });
        
        console.log(`Graph built with ${nodeId} nodes and ${this.edgeWeights.size / 2} edges`);
        return { nodes: nodeId, edges: this.edgeWeights.size / 2 };
    }
    
    /**
     * Calculate Haversine distance between two points
     */
    calculateDistance(coord1, coord2) {
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = coord1.lat * Math.PI / 180;
        const lat2Rad = coord2.lat * Math.PI / 180;
        const deltaLatRad = (coord2.lat - coord1.lat) * Math.PI / 180;
        const deltaLngRad = (coord2.lng - coord1.lng) * Math.PI / 180;
        
        const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c; // Distance in meters
    }
    
    /**
     * Get enhanced AQI data using the multi-source AQI service
     */
    async getAQIWithCache(lat, lng) {
        const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
        
        if (this.aqiCache.has(key)) {
            const cached = this.aqiCache.get(key);
            // Cache for 30 minutes
            if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
                return cached.aqiData.value;
            }
        }
        
        // Fetch new AQI data using enhanced service
        try {
            const aqiData = await AQIService.getAQI(lat, lng);
            const result = {
                aqiData,
                timestamp: Date.now()
            };
            
            this.aqiCache.set(key, result);
            
            // Log data quality information
            if (aqiData.confidence === 'high' && aqiData.sources && aqiData.sources.length > 1) {
                console.log(`High-quality AQI data from ${aqiData.sources.length} sources:`, aqiData.sources);
            }
            
            return aqiData.value || 3; // Default to moderate if unavailable
        } catch (error) {
            console.warn(`Failed to fetch enhanced AQI for ${lat}, ${lng}:`, error);
            return 3; // Default to moderate AQI
        }
    }
    
    /**
     * Calculate enhanced exposure dose for an edge using multi-source AQI data
     */
    async calculateExposureDose(edgeKey) {
        const edgeData = this.edgeWeights.get(edgeKey);
        if (!edgeData) return 0;
        
        try {
            // Get enhanced AQI data with multiple sources
            const aqiData = await AQIService.getAQI(
                edgeData.midpoint.lat, 
                edgeData.midpoint.lng
            );
            
            const aqi = aqiData.value || 3;
            const travelTimeMinutes = edgeData.estimatedTravelTime / 60;
            
            // Base exposure dose = AQI level × travel time in minutes
            let exposureDose = aqi * travelTimeMinutes;
            
            // Apply confidence weighting - lower confidence gets slightly higher penalty
            if (aqiData.confidence === 'low') {
                exposureDose *= 1.1; // 10% penalty for low confidence data
            } else if (aqiData.confidence === 'high') {
                exposureDose *= 0.95; // 5% bonus for high confidence data
            }
            
            // Consider individual pollutant components if available
            if (aqiData.components && aqiData.components.pm2_5) {
                // PM2.5 is particularly harmful, so apply additional weight
                const pm25Level = this.categorizePollutuantLevel(aqiData.components.pm2_5, 'pm2_5');
                if (pm25Level >= 4) { // High PM2.5
                    exposureDose *= 1.2; // 20% additional penalty for high PM2.5
                }
            }
            
            return Math.max(exposureDose, 0.1); // Minimum exposure dose
            
        } catch (error) {
            console.warn(`Error calculating exposure dose for edge ${edgeKey}:`, error);
            return 3 * (edgeData.estimatedTravelTime / 60); // Fallback calculation
        }
    }
    
    /**
     * Categorize pollutant levels (PM2.5, PM10, etc.) into AQI-like scale
     */
    categorizePollutuantLevel(value, type) {
        if (!value || value < 0) return 1;
        
        switch (type) {
            case 'pm2_5':
                if (value <= 12) return 1;
                if (value <= 35.4) return 2;
                if (value <= 55.4) return 3;
                if (value <= 150.4) return 4;
                return 5;
            case 'pm10':
                if (value <= 54) return 1;
                if (value <= 154) return 2;
                if (value <= 254) return 3;
                if (value <= 354) return 4;
                return 5;
            default:
                return 3; // Default to moderate
        }
    }
    
    /**
     * Multi-objective Dijkstra: finds Pareto front of routes
     * @param {number} startNodeId - Starting node
     * @param {number} endNodeId - Destination node
     * @param {Object} preferences - User preferences for weighting
     */
    async findParetoOptimalRoutes(startNodeId, endNodeId, preferences = {}) {
        console.log(`Finding Pareto optimal routes from ${startNodeId} to ${endNodeId}`);
        
        const { 
            maxAlternatives = 5, 
            aqiWeight = 0.7, 
            distanceWeight = 0.3,
            maxAQIThreshold = 5 
        } = preferences;
        
        // Log high AQI avoidance status
        if (maxAQIThreshold < 5) {
            console.log(`🚫 High AQI avoidance ACTIVE: Avoiding areas with AQI > ${maxAQIThreshold}`);
        } else {
            console.log(`✅ High AQI avoidance INACTIVE: All AQI levels allowed`);
        }
        
        // Pre-calculate exposure doses for all edges
        console.log('Calculating exposure doses for edges...');
        const edgeExposures = new Map();
        
        for (const [edgeKey, edgeData] of this.edgeWeights) {
            const exposure = await this.calculateExposureDose(edgeKey);
            edgeExposures.set(edgeKey, exposure);
        }
        
        const paretoRoutes = [];
        
        // Try different weight combinations to find Pareto front
        const weightCombinations = [
            { aqiW: 1.0, distW: 0.0 },   // Pure AQI optimization
            { aqiW: 0.8, distW: 0.2 },   // AQI-focused
            { aqiW: 0.6, distW: 0.4 },   // Balanced
            { aqiW: 0.4, distW: 0.6 },   // Distance-focused
            { aqiW: 0.0, distW: 1.0 }    // Pure distance optimization
        ];
        
        for (const weights of weightCombinations) {
            try {
                const route = await this.findSingleObjectiveRoute(
                    startNodeId, 
                    endNodeId, 
                    weights, 
                    edgeExposures,
                    maxAQIThreshold
                );
                
                if (route && !this.isDominatedRoute(route, paretoRoutes)) {
                    paretoRoutes.push(route);
                }
            } catch (error) {
                console.warn('Error finding route with weights:', weights, error);
            }
        }
        
        // Sort by composite score and return top alternatives
        paretoRoutes.sort((a, b) => {
            const scoreA = (a.totalExposure * aqiWeight) + (a.totalDistance * distanceWeight / 1000);
            const scoreB = (b.totalExposure * aqiWeight) + (b.totalDistance * distanceWeight / 1000);
            return scoreA - scoreB;
        });
        
        console.log(`Found ${paretoRoutes.length} Pareto optimal routes`);
        return paretoRoutes.slice(0, maxAlternatives);
    }
    
    /**
     * Find single route using weighted objective function
     */
    async findSingleObjectiveRoute(startNodeId, endNodeId, weights, edgeExposures, maxAQIThreshold = 5) {
        // Create weighted graph for Dijkstra
        const weightedGraph = {};
        
        for (const [nodeId, neighbors] of this.roadGraph) {
            weightedGraph[nodeId] = {};
            
            for (const [neighborId, distance] of neighbors) {
                const edgeKey = `${nodeId}_${neighborId}`;
                const exposure = edgeExposures.get(edgeKey) || 0;
                
                // Get edge data to check AQI
                const edgeData = this.edgeWeights.get(edgeKey);
                if (edgeData) {
                    // Calculate AQI for this edge
                    const edgeAQI = await this.getAQIWithCache(
                        edgeData.midpoint.lat, 
                        edgeData.midpoint.lng
                    );
                    
                    // Skip this edge if AQI exceeds threshold and we're avoiding high AQI
                    if (maxAQIThreshold < 5 && edgeAQI > maxAQIThreshold) {
                        // Apply heavy penalty instead of complete avoidance to maintain connectivity
                        const highAQIPenalty = 10.0; // 10x penalty for high AQI edges
                        
                        // Composite weight with penalty
                        const normalizedExposure = (exposure * highAQIPenalty) / 10;
                        const normalizedDistance = distance / 1000;
                        
                        const compositeWeight = (normalizedExposure * weights.aqiW) + 
                                              (normalizedDistance * weights.distW);
                        
                        weightedGraph[nodeId][neighborId] = Math.max(compositeWeight, 0.001);
                        continue;
                    }
                }
                
                // Normal weight calculation for acceptable AQI edges
                const normalizedExposure = exposure / 10; // Normalize AQI×time
                const normalizedDistance = distance / 1000; // Normalize to km
                
                const compositeWeight = (normalizedExposure * weights.aqiW) + 
                                      (normalizedDistance * weights.distW);
                
                weightedGraph[nodeId][neighborId] = Math.max(compositeWeight, 0.001); // Avoid zero weights
            }
        }
        
        // Run Dijkstra algorithm
        const path = dijkstra.find_path(weightedGraph, startNodeId.toString(), endNodeId.toString());
        
        if (!path || path.length < 2) {
            return null;
        }
        
        // Convert path to coordinates and calculate metrics
        const coordinates = path.map(nodeId => this.nodePositions.get(parseInt(nodeId)));
        let totalDistance = 0;
        let totalExposure = 0;
        
        for (let i = 0; i < path.length - 1; i++) {
            const edgeKey = `${path[i]}_${path[i + 1]}`;
            const edgeData = this.edgeWeights.get(edgeKey);
            
            if (edgeData) {
                totalDistance += edgeData.distance;
                totalExposure += edgeExposures.get(edgeKey) || 0;
            }
        }
        
        return {
            coordinates,
            path: path.map(id => parseInt(id)),
            totalDistance,
            totalExposure,
            avgAQI: coordinates.length > 0 ? totalExposure / (totalDistance / 1000 / 50 * 60) : 0, // Approximate
            estimatedTime: totalDistance / 13.89, // seconds
            weights: weights
        };
    }
    
    /**
     * Check if a route is dominated by existing routes (Pareto dominance)
     */
    isDominatedRoute(newRoute, existingRoutes) {
        const threshold = 0.05; // 5% tolerance
        
        return existingRoutes.some(existing => {
            const distanceDiff = Math.abs(existing.totalDistance - newRoute.totalDistance) / Math.max(existing.totalDistance, newRoute.totalDistance);
            const exposureDiff = Math.abs(existing.totalExposure - newRoute.totalExposure) / Math.max(existing.totalExposure, newRoute.totalExposure);
            
            // Routes are considered similar if both distance and exposure are within threshold
            return distanceDiff < threshold && exposureDiff < threshold;
        });
    }
    
    /**
     * Find nearest node to a coordinate
     */
    findNearestNode(targetCoord) {
        let nearestNodeId = null;
        let minDistance = Infinity;
        
        for (const [nodeId, coord] of this.nodePositions) {
            const distance = this.calculateDistance(targetCoord, coord);
            if (distance < minDistance) {
                minDistance = distance;
                nearestNodeId = nodeId;
            }
        }
        
        return nearestNodeId;
    }
    
    /**
     * Main routing function that integrates with existing system
     */
    async findOptimalRoutes(startCoord, endCoord, existingRoutes, preferences = {}) {
        try {
            // Build graph from existing OSRM routes
            const graphStats = this.buildRoadGraph(existingRoutes);
            
            // Find nearest nodes to start/end coordinates
            const startNodeId = this.findNearestNode(startCoord);
            const endNodeId = this.findNearestNode(endCoord);
            
            if (startNodeId === null || endNodeId === null) {
                throw new Error('Could not find nearest nodes to start/end coordinates');
            }
            
            // Find Pareto optimal routes
            const optimalRoutes = await this.findParetoOptimalRoutes(startNodeId, endNodeId, preferences);
            
            // Convert back to format expected by existing system
            return optimalRoutes.map((route, index) => ({
                coordinates: route.coordinates,
                summary: {
                    totalDistance: route.totalDistance,
                    totalTime: route.estimatedTime
                },
                avgAQI: route.totalExposure / (route.estimatedTime / 60), // AQI per minute
                totalExposure: route.totalExposure,
                routeType: this.getRouteTypeFromWeights(route.weights),
                paretoRank: index + 1,
                graphStats: graphStats
            }));
            
        } catch (error) {
            console.error('Graph routing failed:', error);
            throw error;
        }
    }
    
    getRouteTypeFromWeights(weights) {
        if (weights.aqiW >= 0.8) return 'aqi-optimized';
        if (weights.distW >= 0.8) return 'distance-optimized';
        return 'balanced';
    }
}

export default new GraphRoutingService();
