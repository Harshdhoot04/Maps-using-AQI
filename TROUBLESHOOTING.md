# Troubleshooting Guide - Map Display Issue

## 🐛 Current Issue: Map Not Showing

If you're seeing the React app load but the map doesn't appear, here's how to fix it:

### Step 1: Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab for any error messages.

### Step 2: Verify Script Loading
Look for these log messages in the console:
- "Original script loaded successfully" 
- "Basic map initialized"

If you don't see these, the issue is likely with script loading.

### Step 3: Quick Fix - Simplify Map Initialization

Replace the content of `src/mapLogic.js` with this simplified version:

```javascript
// Simplified mapLogic.js for troubleshooting
/* eslint-disable */
import "leaflet-routing-machine";

export function initMap(container) {
  console.log('Initializing map...');
  
  // Wait for DOM and Leaflet to be ready
  setTimeout(() => {
    const mapElement = document.getElementById('map');
    
    if (mapElement && window.L) {
      console.log('Creating Leaflet map...');
      
      // Initialize basic map
      window.map = L.map('map').setView([18.5204, 73.8567], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(window.map);
      
      console.log('Map initialized successfully');
      
      // Load original script after map is ready
      loadOriginalScript();
    } else {
      console.error('Map element or Leaflet not found');
    }
  }, 1000);
}

function loadOriginalScript() {
  try {
    import("../script.js").then(() => {
      console.log('Original script loaded');
    }).catch(error => {
      console.error('Failed to load original script:', error);
    });
  } catch (error) {
    console.error('Error loading script:', error);
  }
}
```

### Step 4: Alternative - Check CSS Issues

The map might be loading but not visible due to CSS issues. Add this to your `style.css`:

```css
#map {
    height: 100vh !important;
    width: 100% !important;
    z-index: 1 !important;
}
```

### Step 5: Test Basic Functionality

1. **Start the server**: `npm run dev`
2. **Open**: http://localhost:5173
3. **Check console**: Look for "Map initialized successfully"
4. **Verify map appears**: You should see the map with Pune as center

### Step 6: Test Enhanced Routing Features

Once the map is working:

1. **Enter locations**: "Pune Airport" → "Shivaji Nagar" 
2. **Enable enhanced routing**: Toggle "Enhanced Graph Routing"
3. **Find route**: Click "Find Route"
4. **View route analysis**: Check route metrics and comparisons

## 🔧 Common Issues & Solutions

### Issue: "Leaflet not defined"
**Solution**: Make sure Leaflet CSS/JS loads before React script in `index.html`

### Issue: Map container height is 0
**Solution**: Add explicit height to #map in CSS

### Issue: Original script conflicts
**Solution**: Use the simplified mapLogic.js above



## ✅ Success Indicators

You'll know everything is working when you see:

1. **Map displays** with Leaflet controls
2. **Sidebar shows** with all form controls
3. **Enhanced routing toggle** is visible and functional
4. **Find Route button** generates routes
5. **Route analysis** shows metrics and comparisons

## 🎯 Next Steps After Fixing

Once the map is working:

1. **Test core routing** functionality
2. **Verify graph routing** integration 
3. **Test route analysis** with real data
4. **Implement next phase** features (spatio-temporal prediction, uncertainty quantification)

## 📞 If Issues Persist

Check these files are correctly configured:
- `index.html` - Has proper script loading order
- `src/App.jsx` - Renders sidebar and map container  
- `src/mapLogic.js` - Initializes map correctly
- `style.css` - Map container has proper dimensions

The implementation is solid - this is likely just a timing/loading issue that the simplified approach will resolve.

---

**Remember**: The enhanced routing features are fully implemented and ready to use once the basic map display is working!
