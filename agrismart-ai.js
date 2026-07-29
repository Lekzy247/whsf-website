(() => {
  'use strict';

  const KEY = 'agrismart-ai-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults = () => ({ models: [], predictions: [], recommendations: [], scenarios: [] });

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...defaults(), ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:aichange', { detail: summary(data) }));
    return data;
  }

  function numeric(value, label, fallback = 0) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
    return parsed;
  }

  function clamp(value, minimum = 0, maximum = 100) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function registerModel(input) {
    const data = read();
    const model = {
      id: uid('model'),
      name: String(input.name || '').trim(),
      type: String(input.type || 'Yield Prediction'),
      version: String(input.version || '1.0'),
      description: String(input.description || '').trim(),
      accuracy: clamp(numeric(input.accuracy, 'Accuracy')),
      status: String(input.status || 'Active'),
      createdAt: new Date().toISOString()
    };
    if (!model.name) throw new Error('Model name is required.');
    data.models.push(model);
    save(data);
    return model;
  }

  function predictYield(input) {
    const data = read();
    const area = Math.max(0, numeric(input.area, 'Area'));
    const historicalYield = Math.max(0, numeric(input.historicalYield, 'Historical yield'));
    const rainfallIndex = clamp(numeric(input.rainfallIndex, 'Rainfall index', 70));
    const soilScore = clamp(numeric(input.soilScore, 'Soil score', 70));
    const cropHealth = clamp(numeric(input.cropHealth, 'Crop health', 70));
    const managementScore = clamp(numeric(input.managementScore, 'Management score', 70));
    const factor = (rainfallIndex * 0.25 + soilScore * 0.25 + cropHealth * 0.3 + managementScore * 0.2) / 100;
    const yieldPerArea = historicalYield * (0.65 + factor * 0.7);
    const prediction = {
      id: uid('prediction'),
      type: 'Yield',
      fieldId: String(input.fieldId || ''),
      crop: String(input.crop || '').trim(),
      area,
      yieldPerArea,
      predictedTotalYield: yieldPerArea * area,
      confidence: clamp(55 + factor * 40),
      assumptions: { rainfallIndex, soilScore, cropHealth, managementScore },
      generatedAt: new Date().toISOString()
    };
    data.predictions.unshift(prediction);
    save(data);
    return prediction;
  }

  function scorePestRisk(input) {
    const data = read();
    const temperature = numeric(input.temperature, 'Temperature');
    const humidity = clamp(numeric(input.humidity, 'Humidity'));
    const rainfall = Math.max(0, numeric(input.rainfall, 'Rainfall'));
    const cropStress = clamp(numeric(input.cropStress, 'Crop stress'));
    const recentIncidents = Math.max(0, numeric(input.recentIncidents, 'Recent incidents'));
    const weatherPressure = clamp((humidity * 0.45) + (Math.min(rainfall, 100) * 0.25) + (temperature >= 20 && temperature <= 35 ? 20 : 8));
    const score = clamp(weatherPressure * 0.5 + cropStress * 0.3 + Math.min(recentIncidents * 10, 30));
    const level = score >= 75 ? 'Critical' : score >= 55 ? 'High' : score >= 30 ? 'Moderate' : 'Low';
    const prediction = {
      id: uid('prediction'),
      type: 'Pest and Disease Risk',
      fieldId: String(input.fieldId || ''),
      crop: String(input.crop || '').trim(),
      score,
      level,
      drivers: { temperature, humidity, rainfall, cropStress, recentIncidents },
      generatedAt: new Date().toISOString()
    };
    data.predictions.unshift(prediction);
    save(data);
    return prediction;
  }

  function recommendFertilizer(input) {
    const data = read();
    const targetYield = Math.max(0, numeric(input.targetYield, 'Target yield'));
    const nitrogen = Math.max(0, numeric(input.nitrogen, 'Nitrogen'));
    const phosphorus = Math.max(0, numeric(input.phosphorus, 'Phosphorus'));
    const potassium = Math.max(0, numeric(input.potassium, 'Potassium'));
    const organicMatter = Math.max(0, numeric(input.organicMatter, 'Organic matter'));
    const nutrientDemand = targetYield * 10;
    const recommendation = {
      id: uid('recommendation'),
      type: 'Fertilizer',
      fieldId: String(input.fieldId || ''),
      crop: String(input.crop || '').trim(),
      nitrogenRate: Math.max(0, nutrientDemand * 0.45 - nitrogen * 0.5 - organicMatter * 2),
      phosphorusRate: Math.max(0, nutrientDemand * 0.25 - phosphorus * 0.4),
      potassiumRate: Math.max(0, nutrientDemand * 0.3 - potassium * 0.4),
      unit: String(input.unit || 'kg/ha'),
      rationale: 'Rates are estimated from target yield and available soil nutrients. Confirm with local agronomic guidance before application.',
      status: 'Draft',
      generatedAt: new Date().toISOString()
    };
    data.recommendations.unshift(recommendation);
    save(data);
    return recommendation;
  }

  function optimizeIrrigation(input) {
    const data = read();
    const soilMoisture = clamp(numeric(input.soilMoisture, 'Soil moisture'));
    const fieldCapacity = clamp(numeric(input.fieldCapacity, 'Field capacity', 70));
    const forecastRain = Math.max(0, numeric(input.forecastRain, 'Forecast rain'));
    const evapotranspiration = Math.max(0, numeric(input.evapotranspiration, 'Evapotranspiration'));
    const area = Math.max(0, numeric(input.area, 'Area'));
    const deficit = Math.max(0, fieldCapacity - soilMoisture);
    const netNeedMm = Math.max(0, deficit * 0.35 + evapotranspiration - forecastRain);
    const recommendation = {
      id: uid('recommendation'),
      type: 'Irrigation',
      fieldId: String(input.fieldId || ''),
      recommendedDepthMm: netNeedMm,
      estimatedVolumeLiters: netNeedMm * area * 10000,
      priority: netNeedMm > 25 ? 'High' : netNeedMm > 10 ? 'Medium' : 'Low',
      status: 'Draft',
      generatedAt: new Date().toISOString()
    };
    data.recommendations.unshift(recommendation);
    save(data);
    return recommendation;
  }

  function createScenario(input) {
    const data = read();
    const scenario = {
      id: uid('scenario'),
      name: String(input.name || '').trim(),
      crop: String(input.crop || '').trim(),
      area: Math.max(0, numeric(input.area, 'Area')),
      expectedYield: Math.max(0, numeric(input.expectedYield, 'Expected yield')),
      expectedPrice: Math.max(0, numeric(input.expectedPrice, 'Expected price')),
      variableCost: Math.max(0, numeric(input.variableCost, 'Variable cost')),
      fixedCost: Math.max(0, numeric(input.fixedCost, 'Fixed cost')),
      currency: String(input.currency || 'USD').toUpperCase(),
      createdAt: new Date().toISOString()
    };
    if (!scenario.name) throw new Error('Scenario name is required.');
    scenario.revenue = scenario.area * scenario.expectedYield * scenario.expectedPrice;
    scenario.totalCost = scenario.variableCost + scenario.fixedCost;
    scenario.projectedProfit = scenario.revenue - scenario.totalCost;
    scenario.marginPercent = scenario.revenue ? (scenario.projectedProfit / scenario.revenue) * 100 : 0;
    data.scenarios.unshift(scenario);
    save(data);
    return scenario;
  }

  function resolveRecommendation(id, status = 'Accepted') {
    const data = read();
    const recommendation = data.recommendations.find(item => item.id === id);
    if (!recommendation) throw new Error('Recommendation not found.');
    recommendation.status = status;
    recommendation.updatedAt = new Date().toISOString();
    save(data);
    return recommendation;
  }

  function summary(source = read()) {
    return {
      models: source.models.length,
      activeModels: source.models.filter(item => item.status === 'Active').length,
      predictions: source.predictions.length,
      recommendations: source.recommendations.length,
      pendingRecommendations: source.recommendations.filter(item => item.status === 'Draft').length,
      scenarios: source.scenarios.length,
      projectedScenarioProfit: source.scenarios.reduce((sum, item) => sum + item.projectedProfit, 0)
    };
  }

  window.AgriSmartAI = Object.freeze({
    read,
    registerModel,
    predictYield,
    scorePestRisk,
    recommendFertilizer,
    optimizeIrrigation,
    createScenario,
    resolveRecommendation,
    summary
  });
})();