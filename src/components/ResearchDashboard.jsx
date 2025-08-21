import React, { useState, useEffect } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const ResearchDashboard = ({ evaluationData, isVisible, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [exportFormat, setExportFormat] = useState('json');

    if (!isVisible || !evaluationData) return null;

    const handleExport = () => {
        const dataStr = exportFormat === 'json' 
            ? JSON.stringify(evaluationData, null, 2)
            : convertToCSV(evaluationData);
        
        const blob = new Blob([dataStr], { type: exportFormat === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `aqi-routing-evaluation-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const convertToCSV = (data) => {
        if (!data.routes || data.routes.length === 0) return '';
        
        const headers = ['routeIndex', 'routeType', 'totalDose', 'peakAQI', 'avgAQI', 'travelTime', 'distance', 'fuelCost', 'co2Emission', 'healthRisk'];
        const rows = data.routes.map(route => [
            route.routeIndex,
            route.routeType,
            route.metrics.totalDose,
            route.metrics.peakAQI,
            route.metrics.avgAQI,
            route.metrics.travelTime,
            route.metrics.distance,
            route.metrics.fuelCost,
            route.metrics.co2Emission,
            route.metrics.healthRisk
        ].join(','));
        
        return [headers.join(','), ...rows].join('\n');
    };

    const renderOverview = () => (
        <div className="research-overview">
            <div className="metrics-grid">
                <div className="metric-card">
                    <h3>Routes Analyzed</h3>
                    <div className="metric-value">{evaluationData.summary?.routeCount || 0}</div>
                </div>
                <div className="metric-card">
                    <h3>Avg Total Dose</h3>
                    <div className="metric-value">{evaluationData.summary?.avgTotalDose?.toFixed(2) || 'N/A'}</div>
                    <div className="metric-unit">AQI × minutes</div>
                </div>
                <div className="metric-card">
                    <h3>Avg Peak AQI</h3>
                    <div className="metric-value">{evaluationData.summary?.avgPeakAQI?.toFixed(1) || 'N/A'}</div>
                </div>
                <div className="metric-card">
                    <h3>Total CO₂ Reduction</h3>
                    <div className="metric-value">{evaluationData.summary?.totalCO2Emission?.toFixed(2) || 'N/A'}</div>
                    <div className="metric-unit">kg</div>
                </div>
            </div>

            {evaluationData.summary?.healthRiskDistribution && (
                <div className="health-risk-chart">
                    <h3>Health Risk Distribution</h3>
                    <Bar 
                        data={{
                            labels: ['Very Low', 'Low', 'Moderate', 'High', 'Very High'],
                            datasets: [{
                                label: 'Number of Routes',
                                data: [
                                    evaluationData.summary.healthRiskDistribution.very_low,
                                    evaluationData.summary.healthRiskDistribution.low,
                                    evaluationData.summary.healthRiskDistribution.moderate,
                                    evaluationData.summary.healthRiskDistribution.high,
                                    evaluationData.summary.healthRiskDistribution.very_high
                                ],
                                backgroundColor: [
                                    '#00e400', '#ffff00', '#ff7e00', '#ff0000', '#8f3f97'
                                ]
                            }]
                        }}
                        options={{
                            responsive: true,
                            plugins: { legend: { display: false } }
                        }}
                    />
                </div>
            )}
        </div>
    );

    const renderParetoFrontier = () => {
        if (!evaluationData.routes) return <div>No route data available</div>;

        const scatterData = {
            datasets: [{
                label: 'Routes',
                data: evaluationData.routes.map(route => ({
                    x: route.metrics.travelTime / 60, // Convert to minutes
                    y: route.metrics.totalDose,
                    routeType: route.routeType
                })),
                backgroundColor: evaluationData.routes.map(route => {
                    switch(route.routeType) {
                        case 'aqi-optimized': return '#00e400';
                        case 'distance-optimized': return '#ff7e00';
                        case 'balanced': return '#3498db';
                        default: return '#cccccc';
                    }
                })
            }]
        };

        return (
            <div className="pareto-analysis">
                <h3>Pareto Frontier Analysis</h3>
                <div className="chart-container">
                    <Scatter 
                        data={scatterData}
                        options={{
                            responsive: true,
                            plugins: {
                                title: { display: true, text: 'Travel Time vs Exposure Dose' },
                                tooltip: {
                                    callbacks: {
                                        label: (context) => {
                                            const point = context.parsed;
                                            return `Time: ${point.x.toFixed(1)}min, Dose: ${point.y.toFixed(2)}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { title: { display: true, text: 'Travel Time (minutes)' }},
                                y: { title: { display: true, text: 'Total Exposure Dose (AQI × min)' }}
                            }
                        }}
                    />
                </div>
                
                {evaluationData.comparison && (
                    <div className="improvement-metrics">
                        <h4>Improvements over Baseline</h4>
                        <div className="improvements-grid">
                            {evaluationData.comparison.map((route, index) => (
                                <div key={index} className="improvement-card">
                                    <h5>Route {route.routeIndex} ({route.routeType})</h5>
                                    <div className="improvement-item">
                                        <span>Dose Reduction:</span>
                                        <span className={route.improvements.totalDoseReduction > 0 ? 'positive' : 'negative'}>
                                            {route.improvements.totalDoseReduction.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="improvement-item">
                                        <span>Time Change:</span>
                                        <span className={route.improvements.travelTimeChange < 0 ? 'positive' : 'negative'}>
                                            {route.improvements.travelTimeChange.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="improvement-item">
                                        <span>CO₂ Reduction:</span>
                                        <span className={route.improvements.co2ReductionPercentage > 0 ? 'positive' : 'negative'}>
                                            {route.improvements.co2ReductionPercentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderStatistics = () => (
        <div className="statistics-panel">
            <h3>Statistical Analysis</h3>
            
            <div className="stats-section">
                <h4>Route Diversity</h4>
                <div className="stat-item">
                    <span>Diversity Score:</span>
                    <span>{evaluationData.summary?.diversityScore?.toFixed(3) || 'N/A'}</span>
                </div>
                <div className="stat-description">
                    Higher values indicate more diverse route options.
                    Score &gt; 0.5 is considered good diversity.
                </div>
            </div>

            <div className="stats-section">
                <h4>Performance Metrics</h4>
                <table className="stats-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Mean</th>
                            <th>Std Dev</th>
                            <th>Min</th>
                            <th>Max</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Dose</td>
                            <td>{calculateStats(evaluationData.routes, 'totalDose').mean}</td>
                            <td>{calculateStats(evaluationData.routes, 'totalDose').std}</td>
                            <td>{calculateStats(evaluationData.routes, 'totalDose').min}</td>
                            <td>{calculateStats(evaluationData.routes, 'totalDose').max}</td>
                        </tr>
                        <tr>
                            <td>Travel Time (min)</td>
                            <td>{calculateStats(evaluationData.routes, 'travelTime', (x) => x/60).mean}</td>
                            <td>{calculateStats(evaluationData.routes, 'travelTime', (x) => x/60).std}</td>
                            <td>{calculateStats(evaluationData.routes, 'travelTime', (x) => x/60).min}</td>
                            <td>{calculateStats(evaluationData.routes, 'travelTime', (x) => x/60).max}</td>
                        </tr>
                        <tr>
                            <td>Distance (km)</td>
                            <td>{calculateStats(evaluationData.routes, 'distance', (x) => x/1000).mean}</td>
                            <td>{calculateStats(evaluationData.routes, 'distance', (x) => x/1000).std}</td>
                            <td>{calculateStats(evaluationData.routes, 'distance', (x) => x/1000).min}</td>
                            <td>{calculateStats(evaluationData.routes, 'distance', (x) => x/1000).max}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    const calculateStats = (routes, metric, transform = (x) => x) => {
        if (!routes || routes.length === 0) return { mean: 'N/A', std: 'N/A', min: 'N/A', max: 'N/A' };
        
        const values = routes.map(route => transform(route.metrics[metric])).filter(x => !isNaN(x));
        if (values.length === 0) return { mean: 'N/A', std: 'N/A', min: 'N/A', max: 'N/A' };
        
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        
        return {
            mean: mean.toFixed(2),
            std: std.toFixed(2),
            min: Math.min(...values).toFixed(2),
            max: Math.max(...values).toFixed(2)
        };
    };

    return (
        <div className="research-dashboard-overlay">
            <div className="research-dashboard">
                <div className="dashboard-header">
                    <h2>Research Analysis Dashboard</h2>
                    <div className="header-controls">
                        <div className="export-controls">
                            <select 
                                value={exportFormat} 
                                onChange={(e) => setExportFormat(e.target.value)}
                                className="export-format-select"
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                            </select>
                            <button onClick={handleExport} className="export-button">
                                <i className="fas fa-download"></i> Export Data
                            </button>
                        </div>
                        <button onClick={onClose} className="close-button">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div className="dashboard-tabs">
                    <button 
                        className={activeTab === 'overview' ? 'active' : ''}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button 
                        className={activeTab === 'pareto' ? 'active' : ''}
                        onClick={() => setActiveTab('pareto')}
                    >
                        Pareto Analysis
                    </button>
                    <button 
                        className={activeTab === 'statistics' ? 'active' : ''}
                        onClick={() => setActiveTab('statistics')}
                    >
                        Statistics
                    </button>
                </div>

                <div className="dashboard-content">
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'pareto' && renderParetoFrontier()}
                    {activeTab === 'statistics' && renderStatistics()}
                </div>
            </div>
        </div>
    );
};

export default ResearchDashboard;
