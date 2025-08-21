/**
 * Evaluation framework for AQI-aware routing research
 * Features: Performance metrics, baseline comparisons, statistical analysis
 */

class EvaluationService {
    constructor() {
        this.evaluationResults = [];
        this.baselineRoutes = new Map(); // Store baseline routes for comparison
        this.metrics = {
            totalDose: [],
            peakAQI: [],
            travelTime: [],
            distance: [],
            fuelCost: []
        };
    }

    /**
     * Evaluate a set of routes against multiple criteria
     * @param {Array} routes - Routes to evaluate
     * @param {Object} baseline - Baseline routes for comparison
     * @param {Object} metadata - Additional metadata (city, time, etc.)
     */
    async evaluateRoutes(routes, baseline = null, metadata = {}) {
        console.log('Starting route evaluation...');
        
        const evaluation = {
            timestamp: new Date().toISOString(),
            metadata,
            routes: [],
            baseline: baseline ? await this.calculateRouteMetrics(baseline, 'baseline') : null,
            summary: {}
        };

        // Calculate metrics for each route
        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            const metrics = await this.calculateRouteMetrics(route, `route_${i}`);
            evaluation.routes.push({
                routeIndex: i,
                routeType: route.routeType || 'unknown',
                paretoRank: route.paretoRank || null,
                metrics
            });
        }

        // Calculate comparative metrics if baseline exists
        if (evaluation.baseline) {
            evaluation.comparison = this.compareWithBaseline(evaluation.routes, evaluation.baseline);
        }

        // Calculate summary statistics
        evaluation.summary = this.calculateSummaryStats(evaluation.routes);
        
        this.evaluationResults.push(evaluation);
        console.log('Evaluation completed:', evaluation.summary);
        
        return evaluation;
    }

    /**
     * Calculate comprehensive metrics for a single route
     */
    async calculateRouteMetrics(route, routeId) {
        const metrics = {
            routeId,
            totalDose: route.totalExposure || 0,
            peakAQI: 0,
            avgAQI: route.avgAQI || 0,
            travelTime: route.summary?.totalTime || route.estimatedTime || 0,
            distance: route.summary?.totalDistance || route.totalDistance || 0,
            fuelCost: 0,
            co2Emission: 0,
            healthRisk: 'unknown',
            exposureVariance: 0
        };

        // Calculate peak AQI and exposure variance
        if (route.coordinates && route.coordinates.length > 0) {
            const aqiValues = [];
            
            // Sample AQI values along the route
            const samplePoints = Math.min(route.coordinates.length, 20);
            const step = Math.floor(route.coordinates.length / samplePoints);
            
            for (let i = 0; i < route.coordinates.length; i += step) {
                const coord = route.coordinates[i];
                try {
                    const aqi = await this.getAQIForPoint(coord.lat, coord.lng);
                    if (aqi > 0) aqiValues.push(aqi);
                } catch (error) {
                    console.warn('Failed to get AQI for evaluation point:', error);
                }
            }
            
            if (aqiValues.length > 0) {
                metrics.peakAQI = Math.max(...aqiValues);
                metrics.avgAQI = aqiValues.reduce((a, b) => a + b) / aqiValues.length;
                metrics.exposureVariance = this.calculateVariance(aqiValues);
            }
        }

        // Calculate estimated fuel cost (assuming average consumption)
        const distanceKm = metrics.distance / 1000;
        const fuelEfficiencyKmPerLiter = 15; // Average car fuel efficiency
        const fuelPricePerLiter = 1.5; // USD per liter (approximate)
        metrics.fuelCost = (distanceKm / fuelEfficiencyKmPerLiter) * fuelPricePerLiter;

        // Calculate CO2 emission (kg)
        const co2PerLiter = 2.31; // kg CO2 per liter of gasoline
        metrics.co2Emission = (distanceKm / fuelEfficiencyKmPerLiter) * co2PerLiter;

        // Assess health risk level
        metrics.healthRisk = this.assessHealthRisk(metrics.avgAQI, metrics.peakAQI, metrics.travelTime);

        return metrics;
    }

    /**
     * Compare routes with baseline performance
     */
    compareWithBaseline(routes, baseline) {
        return routes.map(route => {
            const routeMetrics = route.metrics;
            return {
                routeIndex: route.routeIndex,
                routeType: route.routeType,
                improvements: {
                    totalDoseReduction: this.calculatePercentageChange(baseline.totalDose, routeMetrics.totalDose),
                    peakAQIReduction: this.calculatePercentageChange(baseline.peakAQI, routeMetrics.peakAQI),
                    travelTimeChange: this.calculatePercentageChange(baseline.travelTime, routeMetrics.travelTime),
                    distanceChange: this.calculatePercentageChange(baseline.distance, routeMetrics.distance),
                    fuelCostChange: this.calculatePercentageChange(baseline.fuelCost, routeMetrics.fuelCost),
                    co2ReductionPercentage: this.calculatePercentageChange(baseline.co2Emission, routeMetrics.co2Emission)
                }
            };
        });
    }

    /**
     * Calculate summary statistics for evaluation results
     */
    calculateSummaryStats(routes) {
        if (routes.length === 0) return {};

        const metrics = routes.map(r => r.metrics);
        
        return {
            routeCount: routes.length,
            avgTotalDose: this.calculateMean(metrics.map(m => m.totalDose)),
            avgPeakAQI: this.calculateMean(metrics.map(m => m.peakAQI)),
            avgTravelTime: this.calculateMean(metrics.map(m => m.travelTime)),
            avgDistance: this.calculateMean(metrics.map(m => m.distance)),
            totalFuelCost: metrics.reduce((sum, m) => sum + m.fuelCost, 0),
            totalCO2Emission: metrics.reduce((sum, m) => sum + m.co2Emission, 0),
            healthRiskDistribution: this.calculateHealthRiskDistribution(metrics),
            diversityScore: this.calculateRouteDiversity(metrics)
        };
    }

    /**
     * Generate comprehensive evaluation report
     */
    generateEvaluationReport(cityName = 'Unknown City', timeRange = 'Unknown') {
        if (this.evaluationResults.length === 0) {
            return { error: 'No evaluation data available' };
        }

        const latestEvaluation = this.evaluationResults[this.evaluationResults.length - 1];
        
        const report = {
            metadata: {
                city: cityName,
                timeRange,
                evaluationDate: new Date().toISOString(),
                totalEvaluations: this.evaluationResults.length
            },
            performance: {
                summary: latestEvaluation.summary,
                bestRoute: this.findBestRoute(latestEvaluation.routes),
                paretoFrontier: this.extractParetoFrontier(latestEvaluation.routes)
            },
            baselines: latestEvaluation.comparison || null,
            recommendations: this.generateRecommendations(latestEvaluation),
            researchMetrics: {
                algorithmEfficiency: this.calculateAlgorithmEfficiency(),
                improvementOverBaseline: this.calculateOverallImprovement(latestEvaluation),
                statisticalSignificance: this.performStatisticalTests(latestEvaluation)
            }
        };

        console.log('Generated evaluation report:', report);
        return report;
    }

    /**
     * Find the best route based on multi-objective scoring
     */
    findBestRoute(routes) {
        if (routes.length === 0) return null;

        let bestRoute = routes[0];
        let bestScore = this.calculateCompositeScore(bestRoute.metrics);

        for (let i = 1; i < routes.length; i++) {
            const score = this.calculateCompositeScore(routes[i].metrics);
            if (score < bestScore) { // Lower score is better (minimization)
                bestScore = score;
                bestRoute = routes[i];
            }
        }

        return {
            ...bestRoute,
            compositeScore: bestScore
        };
    }

    /**
     * Calculate composite score for route ranking
     */
    calculateCompositeScore(metrics, weights = { dose: 0.4, time: 0.3, distance: 0.3 }) {
        // Normalize metrics (assuming typical ranges)
        const normalizedDose = metrics.totalDose / 100; // Assume max dose ~100
        const normalizedTime = metrics.travelTime / 3600; // Normalize to hours
        const normalizedDistance = metrics.distance / 10000; // Normalize to 10km

        return (normalizedDose * weights.dose) + 
               (normalizedTime * weights.time) + 
               (normalizedDistance * weights.distance);
    }

    /**
     * Extract Pareto frontier from routes
     */
    extractParetoFrontier(routes) {
        const paretoRoutes = routes.filter(route => {
            const metrics = route.metrics;
            
            // Check if this route is dominated by any other route
            return !routes.some(other => {
                if (other.routeIndex === route.routeIndex) return false;
                
                const otherMetrics = other.metrics;
                
                // Route is dominated if another route is better or equal in all objectives
                return (otherMetrics.totalDose <= metrics.totalDose &&
                        otherMetrics.travelTime <= metrics.travelTime &&
                        otherMetrics.distance <= metrics.distance) &&
                       (otherMetrics.totalDose < metrics.totalDose ||
                        otherMetrics.travelTime < metrics.travelTime ||
                        otherMetrics.distance < metrics.distance);
            });
        });

        return paretoRoutes.map(route => ({
            routeIndex: route.routeIndex,
            routeType: route.routeType,
            metrics: route.metrics,
            dominanceRank: this.calculateDominanceRank(route, routes)
        }));
    }

    /**
     * Generate actionable recommendations based on evaluation
     */
    generateRecommendations(evaluation) {
        const recommendations = [];
        const summary = evaluation.summary;

        // Health-based recommendations
        if (summary.avgPeakAQI > 4) {
            recommendations.push({
                type: 'health',
                priority: 'high',
                message: 'High AQI detected. Consider postponing non-essential travel.',
                data: { avgPeakAQI: summary.avgPeakAQI }
            });
        }

        // Route efficiency recommendations
        if (evaluation.comparison) {
            const bestImprovement = evaluation.comparison.reduce((best, current) => {
                return (current.improvements.totalDoseReduction > best.improvements.totalDoseReduction) ? 
                       current : best;
            });

            if (bestImprovement.improvements.totalDoseReduction > 10) {
                recommendations.push({
                    type: 'efficiency',
                    priority: 'medium',
                    message: `Route ${bestImprovement.routeIndex} shows ${bestImprovement.improvements.totalDoseReduction.toFixed(1)}% reduction in exposure dose.`,
                    data: bestImprovement.improvements
                });
            }
        }

        // Algorithm performance recommendations
        if (summary.diversityScore < 0.3) {
            recommendations.push({
                type: 'algorithm',
                priority: 'low',
                message: 'Low route diversity detected. Consider adjusting optimization parameters.',
                data: { diversityScore: summary.diversityScore }
            });
        }

        return recommendations;
    }

    // Helper methods
    async getAQIForPoint(lat, lng) {
        // This should integrate with your AQI service
        // For now, return a placeholder
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=cc89ee52f5cdf7cd8a3915cba042774f`
            );
            const data = await response.json();
            return data.list?.[0]?.main?.aqi || 3;
        } catch (error) {
            return 3; // Default moderate AQI
        }
    }

    calculateVariance(values) {
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return this.calculateMean(squaredDiffs);
    }

    calculateMean(values) {
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    calculatePercentageChange(baseline, current) {
        return baseline !== 0 ? ((baseline - current) / baseline) * 100 : 0;
    }

    assessHealthRisk(avgAQI, peakAQI, travelTime) {
        const timeHours = travelTime / 3600;
        
        if (peakAQI >= 5 || (avgAQI >= 4 && timeHours > 1)) return 'very_high';
        if (peakAQI >= 4 || (avgAQI >= 3 && timeHours > 2)) return 'high';
        if (avgAQI >= 3 || peakAQI >= 3) return 'moderate';
        if (avgAQI >= 2) return 'low';
        return 'very_low';
    }

    calculateHealthRiskDistribution(metrics) {
        const distribution = { very_low: 0, low: 0, moderate: 0, high: 0, very_high: 0 };
        metrics.forEach(m => distribution[m.healthRisk]++);
        return distribution;
    }

    calculateRouteDiversity(metrics) {
        // Calculate diversity based on coefficient of variation across multiple metrics
        const doseCV = this.calculateCoefficientOfVariation(metrics.map(m => m.totalDose));
        const timeCV = this.calculateCoefficientOfVariation(metrics.map(m => m.travelTime));
        const distanceCV = this.calculateCoefficientOfVariation(metrics.map(m => m.distance));
        
        return (doseCV + timeCV + distanceCV) / 3;
    }

    calculateCoefficientOfVariation(values) {
        const mean = this.calculateMean(values);
        const std = Math.sqrt(this.calculateVariance(values));
        return mean !== 0 ? std / mean : 0;
    }

    calculateDominanceRank(route, allRoutes) {
        // Count how many routes dominate this route
        return allRoutes.reduce((rank, other) => {
            if (other.routeIndex === route.routeIndex) return rank;
            
            const thisMetrics = route.metrics;
            const otherMetrics = other.metrics;
            
            const isDominated = (otherMetrics.totalDose <= thisMetrics.totalDose &&
                               otherMetrics.travelTime <= thisMetrics.travelTime &&
                               otherMetrics.distance <= thisMetrics.distance) &&
                              (otherMetrics.totalDose < thisMetrics.totalDose ||
                               otherMetrics.travelTime < thisMetrics.travelTime ||
                               otherMetrics.distance < thisMetrics.distance);
            
            return isDominated ? rank + 1 : rank;
        }, 0);
    }

    calculateAlgorithmEfficiency() {
        // Placeholder for algorithm efficiency metrics
        return {
            avgProcessingTime: 0, // Could be calculated from timing data
            memoryUsage: 0,
            cacheHitRate: 0
        };
    }

    calculateOverallImprovement(evaluation) {
        if (!evaluation.comparison) return null;
        
        const improvements = evaluation.comparison.map(c => c.improvements);
        return {
            avgDoseReduction: this.calculateMean(improvements.map(i => i.totalDoseReduction)),
            avgTimeIncrease: this.calculateMean(improvements.map(i => i.travelTimeChange)),
            avgDistanceIncrease: this.calculateMean(improvements.map(i => i.distanceChange)),
            avgCO2Reduction: this.calculateMean(improvements.map(i => i.co2ReductionPercentage))
        };
    }

    performStatisticalTests(evaluation) {
        // Placeholder for statistical significance testing
        // In a real implementation, you'd perform t-tests, Wilcoxon signed-rank tests, etc.
        return {
            doseReductionSignificant: null,
            sampleSize: evaluation.routes.length,
            confidenceLevel: 0.95,
            notes: 'Statistical testing requires multiple evaluation runs'
        };
    }

    // Export evaluation results for research papers
    exportForResearch(format = 'json') {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                totalEvaluations: this.evaluationResults.length,
                format
            },
            evaluations: this.evaluationResults
        };

        if (format === 'csv') {
            return this.convertToCSV(exportData);
        }

        return exportData;
    }

    convertToCSV(data) {
        // Convert evaluation data to CSV format for research analysis
        const headers = ['timestamp', 'routeIndex', 'routeType', 'totalDose', 'peakAQI', 'avgAQI', 
                        'travelTime', 'distance', 'fuelCost', 'co2Emission', 'healthRisk'];
        
        const rows = [];
        data.evaluations.forEach(evaluation => {
            evaluation.routes.forEach(route => {
                const row = [
                    evaluation.timestamp,
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
                ];
                rows.push(row.join(','));
            });
        });

        return [headers.join(','), ...rows].join('\n');
    }
}

export default new EvaluationService();
