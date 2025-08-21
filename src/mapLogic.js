// Enhanced mapLogic.js with graph-based routing integration
/* eslint-disable */
import "leaflet-routing-machine";
import GraphRoutingService from './services/GraphRoutingService.js';

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
          
          // Use graph routing service
          const enhancedRoutes = await GraphRoutingService.findOptimalRoutes(
            startCoord,
            endCoord,
            routes,
            preferences
          );
          
          if (enhancedRoutes && enhancedRoutes.length > 0) {
            console.log(`Graph routing found ${enhancedRoutes.length} optimal routes`);
            
            // Add enhanced routing status
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
              statusDiv.innerHTML = `
                <strong>Enhanced Routing:</strong> 
                Using advanced multi-objective optimization. 
                Found ${enhancedRoutes.length} optimized routes.
                Graph stats: ${enhancedRoutes[0]?.graphStats?.nodes || 0} nodes, ${enhancedRoutes[0]?.graphStats?.edges || 0} edges.
              `;
              statusDiv.className = 'info';
              statusDiv.style.display = 'block';
            }
            
            return originalProcessRoutes.call(this, enhancedRoutes);
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

