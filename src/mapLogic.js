// Enhanced mapLogic.js with graph-based routing integration
/* eslint-disable */
import "leaflet-routing-machine";
import graphRoutingService from './services/GraphRoutingService.js';

// Import the original script and enhance it
let originalMap;
let originalRoutingControl;
const graphRoutingEnabled = true; // Always enabled

export function initMap(container) {
  // Initialize the original script logic first
  initOriginalScript();
  
  // Set up graph routing toggle listener
  setupGraphRoutingListener();
}

function setupGraphRoutingListener() {
  // Graph routing is now always enabled
  console.log('Enhanced Graph Routing is always active');
}

function initOriginalScript() {
  // Load the original script logic
  try {
    // First make sure Leaflet is available
    if (typeof window.L === 'undefined') {
      console.error('Leaflet not loaded');
      return;
    }
    
    import("../script.js").then(() => {
      console.log('Original script loaded successfully');
      setupRouteProcessing();
    }).catch(error => {
      console.error('Failed to load original script:', error);
      // Initialize basic map functionality directly
      initBasicMap();
    });
  } catch (error) {
    console.error('Error in initOriginalScript:', error);
    initBasicMap();
  }
}

function initBasicMap() {
  // Basic map initialization if script loading fails
  console.log('Initializing basic map fallback...');
  const mapElement = document.getElementById('map');
  if (mapElement && window.L) {
    window.map = L.map('map').setView([18.5204, 73.8567], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(window.map);
    console.log('Basic map initialized');
  }
}

/**
 * Find optimal routes using graph-based routing
 */
async function findOptimalRoutes(startCoord, endCoord, originalRoutes, preferences) {
  try {
    console.log('Starting graph-based route optimization...');
    
    // Step 1: Build graph from original routes
    const graphStats = graphRoutingService.buildRoadGraph(originalRoutes);
    console.log('Graph construction complete:', graphStats);
    
    // Step 2: Find start and end nodes in the graph
    const startNodeId = findNearestNode(startCoord);
    const endNodeId = findNearestNode(endCoord);
    
    if (startNodeId === null || endNodeId === null) {
      console.warn('Could not find start/end nodes in graph, using original routes');
      return originalRoutes;
    }
    
    // Step 3: Find Pareto-optimal routes using the existing method
    const optimalRoutes = await graphRoutingService.findOptimalRoutes(
      startCoord, 
      endCoord, 
      originalRoutes,
      preferences
    );
    
    if (!optimalRoutes || optimalRoutes.length === 0) {
      console.warn('No optimal routes found, using original routes');
      return originalRoutes;
    }
    
    // Step 4: Convert graph routes back to coordinate format
    const enhancedRoutes = optimalRoutes.map((route, index) => ({
      ...route,
      routeIndex: index,
      routeType: getRouteTypeName(route.weightCombination),
      paretoRank: route.paretoRank || (index + 1)
    }));
    
    console.log(`Graph routing found ${enhancedRoutes.length} optimal routes`);
    
    return {
      routes: enhancedRoutes,
      graphStats
    };
    
  } catch (error) {
    console.error('Error in findOptimalRoutes:', error);
    return originalRoutes;
  }
}



/**
 * Find the nearest node in the graph to given coordinates
 */
function findNearestNode(targetCoord) {
  let nearestNodeId = null;
  let minDistance = Infinity;
  
  for (const [nodeId, nodeCoord] of graphRoutingService.nodePositions) {
    const distance = calculateDistance(
      targetCoord.lat, targetCoord.lng,
      nodeCoord.lat, nodeCoord.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestNodeId = nodeId;
    }
  }
  
  return nearestNodeId;
}

/**
 * Calculate distance between two coordinate points
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const deltaLatRad = (lat2 - lat1) * Math.PI / 180;
  const deltaLngRad = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

/**
 * Get human-readable route type name from weight combination
 */
function getRouteTypeName(weightCombination) {
  if (!weightCombination) return 'balanced';
  
  const { aqiW, distW } = weightCombination;
  
  if (aqiW >= 0.9) return 'aqi-optimized';
  if (aqiW >= 0.7) return 'aqi-focused';
  if (distW >= 0.9) return 'distance-optimized';
  if (distW >= 0.7) return 'distance-focused';
  return 'balanced';
}

function setupRouteProcessing() {
  // Override the processRoutes function to integrate graph routing
  if (window.processRoutes) {
    const originalProcessRoutes = window.processRoutes;
    
    window.processRoutes = async function(routes) {
      try {
        if (graphRoutingEnabled && routes.length > 0) {
          console.log('Using enhanced graph-based routing...');
          
          // Get start and end coordinates from the first route
          const firstRoute = routes[0];
          const startCoord = firstRoute.coordinates[0];
          const endCoord = firstRoute.coordinates[firstRoute.coordinates.length - 1];
          
          // Get user preferences
          const routeTypeSelect = document.getElementById('route-type');
          const avoidHighAqiToggle = document.getElementById('avoid-high-aqi');
          
          const preferences = {
            maxAlternatives: 5,
            aqiWeight: routeTypeSelect?.value === 'aqi' ? 0.9 : 0.7,
            distanceWeight: routeTypeSelect?.value === 'distance' ? 0.9 : 0.3,
            maxAQIThreshold: avoidHighAqiToggle?.checked ? 4 : 5
          };
          
          // Use graph routing service to find optimal routes
          const enhancedRoutes = await findOptimalRoutes(
            startCoord,
            endCoord,
            routes,
            preferences
          );
          
          if (enhancedRoutes && enhancedRoutes.routes.length > 0) {
            console.log(`Graph routing found ${enhancedRoutes.routes.length} optimal routes`);
            
            // Add enhanced routing status
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
              statusDiv.innerHTML = `
                <strong>Enhanced Routing:</strong> 
                Using advanced multi-objective optimization. 
                Found ${enhancedRoutes.routes.length} optimized routes.
                Graph stats: ${enhancedRoutes.graphStats?.nodes || 0} nodes, ${enhancedRoutes.graphStats?.edges || 0} edges.

              `;
              statusDiv.className = 'info';
              statusDiv.style.display = 'block';
            }
            
            return originalProcessRoutes.call(this, enhancedRoutes.routes);
          }
        }
        
        // Fallback to original processing
        return originalProcessRoutes.call(this, routes);
        
      } catch (error) {
        console.error('Graph routing error:', error);
        console.log('Falling back to original routing...');
        return originalProcessRoutes.call(this, routes);
      }
    };
  }
}

