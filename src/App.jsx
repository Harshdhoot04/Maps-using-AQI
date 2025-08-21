import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ResearchDashboard from './components/ResearchDashboard.jsx';
import { initMap } from './mapLogic.js';
import EvaluationService from './services/EvaluationService.js';

export default function App() {
  const mapRef = useRef(null);
  const [showResearchDashboard, setShowResearchDashboard] = useState(false);
  const [evaluationData, setEvaluationData] = useState(null);

  useEffect(() => {
    if (mapRef.current) {
      initMap(mapRef.current);
    }

    // Listen for evaluation results
    window.addEventListener('routeEvaluationComplete', (event) => {
      setEvaluationData(event.detail);
    });

    return () => {
      window.removeEventListener('routeEvaluationComplete', () => {});
    };
  }, []);

  const handleOpenResearchDashboard = () => {
    if (!evaluationData) {
      // Generate dummy evaluation data for demo
      const dummyData = {
        routes: [
          {
            routeIndex: 0,
            routeType: 'aqi-optimized',
            metrics: {
              totalDose: 45.2,
              peakAQI: 3,
              avgAQI: 2.1,
              travelTime: 1800, // 30 minutes in seconds
              distance: 12500, // 12.5 km in meters
              fuelCost: 1.25,
              co2Emission: 2.89,
              healthRisk: 'low'
            }
          },
          {
            routeIndex: 1,
            routeType: 'balanced',
            metrics: {
              totalDose: 52.8,
              peakAQI: 4,
              avgAQI: 2.6,
              travelTime: 1620, // 27 minutes in seconds
              distance: 11200, // 11.2 km in meters
              fuelCost: 1.12,
              co2Emission: 2.59,
              healthRisk: 'moderate'
            }
          },
          {
            routeIndex: 2,
            routeType: 'distance-optimized',
            metrics: {
              totalDose: 68.5,
              peakAQI: 5,
              avgAQI: 3.4,
              travelTime: 1440, // 24 minutes in seconds
              distance: 10800, // 10.8 km in meters
              fuelCost: 1.08,
              co2Emission: 2.50,
              healthRisk: 'high'
            }
          }
        ],
        summary: {
          routeCount: 3,
          avgTotalDose: 55.5,
          avgPeakAQI: 4.0,
          avgTravelTime: 1620,
          avgDistance: 11500,
          totalFuelCost: 3.45,
          totalCO2Emission: 7.98,
          healthRiskDistribution: {
            very_low: 0,
            low: 1,
            moderate: 1,
            high: 1,
            very_high: 0
          },
          diversityScore: 0.67
        },
        comparison: [
          {
            routeIndex: 0,
            routeType: 'aqi-optimized',
            improvements: {
              totalDoseReduction: 34.2,
              peakAQIReduction: 40.0,
              travelTimeChange: 25.0,
              distanceChange: 15.7,
              fuelCostChange: 15.7,
              co2ReductionPercentage: 15.7
            }
          },
          {
            routeIndex: 1,
            routeType: 'balanced',
            improvements: {
              totalDoseReduction: 22.9,
              peakAQIReduction: 20.0,
              travelTimeChange: 12.5,
              distanceChange: 3.7,
              fuelCostChange: 3.7,
              co2ReductionPercentage: 3.7
            }
          },
          {
            routeIndex: 2,
            routeType: 'distance-optimized',
            improvements: {
              totalDoseReduction: 0.0,
              peakAQIReduction: 0.0,
              travelTimeChange: -22.2,
              distanceChange: -7.4,
              fuelCostChange: -7.4,
              co2ReductionPercentage: -7.4
            }
          }
        ]
      };
      setEvaluationData(dummyData);
    }
    setShowResearchDashboard(true);
  };

  return (
    <>
      <div id="app-container">
        <Sidebar />
        {/* Map container */}
        <div id="map" ref={mapRef}></div>
        
        {/* Research Dashboard Button */}
        <button 
          className="research-dashboard-btn"
          onClick={handleOpenResearchDashboard}
          title="Open Research Analysis Dashboard"
        >
          <i className="fas fa-chart-line"></i>
          <span>Research</span>
        </button>
      </div>

      {/* Research Dashboard Modal */}
      <ResearchDashboard 
        evaluationData={evaluationData}
        isVisible={showResearchDashboard}
        onClose={() => setShowResearchDashboard(false)}
      />
    </>
  );
}

