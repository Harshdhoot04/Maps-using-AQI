import React, { useEffect } from 'react';

export default function Sidebar() {
  useEffect(() => {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (!sidebarToggle || !sidebar) return;

    function handleToggle() {
      sidebar.classList.toggle('active');
      const icon = sidebarToggle.querySelector('i');
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
    }

    sidebarToggle.addEventListener('click', handleToggle);

    // Close sidebar when clicking outside on mobile
    const outsideClick = (e) => {
      if (window.innerWidth <= 768 &&
          !sidebar.contains(e.target) &&
          !sidebarToggle.contains(e.target) &&
          sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        const icon = sidebarToggle.querySelector('i');
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
      }
    };

    document.addEventListener('click', outsideClick);

    return () => {
      sidebarToggle.removeEventListener('click', handleToggle);
      document.removeEventListener('click', outsideClick);
    };
  }, []);

  return (
    <>
      <button className="sidebar-toggle" id="sidebar-toggle">
        <i className="fas fa-bars"></i>
      </button>
      <div id="sidebar">
        <div className="sidebar-header">
          <h1>AQI Route Finder</h1>
          <p className="subtitle">Find the healthiest route to your destination</p>
        </div>

        <div className="input-section">
          <div className="input-group">
            <label htmlFor="start">
              <i className="fas fa-map-marker-alt"></i>
              Start Location
            </label>
            <input type="text" id="start" placeholder="e.g. Pune Airport" />
          </div>
          <div className="input-group">
            <label htmlFor="end">
              <i className="fas fa-flag-checkered"></i>
              End Location
            </label>
            <input type="text" id="end" placeholder="e.g. Shivaji Nagar" />
          </div>
        </div>

        <div className="preferences-section">
          <h3>Route Preferences</h3>
          <div className="preference-group">
            <label className="toggle">
              <input type="checkbox" id="avoid-high-aqi" />
              <span className="slider"></span>
              <span className="label">Avoid High AQI Areas</span>
            </label>
          </div>
          <div className="preference-group">
            <label>Route Type:</label>
            <select id="route-type">
              <option value="balanced">Balanced (AQI + Distance)</option>
              <option value="aqi">Best AQI Only</option>
              <option value="distance">Shortest Distance</option>
            </select>
          </div>
        </div>

        <button id="find-route" className="primary-button">
          <i className="fas fa-route"></i>
          Find Route
        </button>

        <div id="route-info" className="hidden">
          <h3>Route Information</h3>
          <div className="info-card">
            <div className="info-item">
              <i className="fas fa-wind"></i>
              <span>
                Average AQI: <span id="avg-aqi">-</span>
              </span>
            </div>
            <div className="info-item">
              <i className="fas fa-road"></i>
              <span>
                Distance: <span id="route-distance">-</span>
              </span>
            </div>
            <div className="info-item">
              <i className="fas fa-clock"></i>
              <span>
                Duration: <span id="route-duration">-</span>
              </span>
            </div>
          </div>
        </div>

        <div id="status"></div>
      </div>

      <div id="map-controls">
        <button id="locate-me" className="map-control-button" title="Locate Me">
          <i className="fas fa-location-arrow"></i>
        </button>
      </div>
    </>
  );
}
