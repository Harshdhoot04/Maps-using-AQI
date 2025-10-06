import React, { useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import { initMap } from './mapLogic.js';

export default function App() {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) {
      initMap(mapRef.current);
    }
  }, []);

  return (
    <>
      <div id="app-container">
        <Sidebar />
        {/* Map container */}
        <div id="map" ref={mapRef}></div>
      </div>
    </>
  );
}

