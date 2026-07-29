(() => {
  'use strict';

  const KEY = 'agrismart-gis-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults = () => ({ fields: [], zones: [], soilSamples: [], sensors: [], observations: [], irrigationPlans: [] });

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
    window.dispatchEvent(new CustomEvent('agrismart:gischange', { detail: summary(data) }));
    return data;
  }

  function number(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
    return parsed;
  }

  function addField(input) {
    const data = read();
    const boundary = Array.isArray(input.boundary) ? input.boundary.map(point => ({
      latitude: number(point.latitude, 'Latitude'),
      longitude: number(point.longitude, 'Longitude')
    })) : [];
    const field = {
      id: uid('field'),
      name: String(input.name || '').trim(),
      farmId: String(input.farmId || ''),
      area: Math.max(0, number(input.area || 0, 'Area')),
      areaUnit: String(input.areaUnit || 'hectares'),
      crop: String(input.crop || '').trim(),
      variety: String(input.variety || '').trim(),
      plantingDate: String(input.plantingDate || ''),
      boundary,
      center: input.center ? {
        latitude: number(input.center.latitude, 'Latitude'),
        longitude: number(input.center.longitude, 'Longitude')
      } : null,
      status: String(input.status || 'Active'),
      createdAt: new Date().toISOString()
    };
    if (!field.name) throw new Error('Field name is required.');
    data.fields.push(field);
    save(data);
    return field;
  }

  function addManagementZone(input) {
    const data = read();
    if (!data.fields.some(item => item.id === input.fieldId)) throw new Error('Field not found.');
    const zone = {
      id: uid('zone'),
      fieldId: input.fieldId,
      name: String(input.name || '').trim(),
      purpose: String(input.purpose || 'General'),
      area: Math.max(0, number(input.area || 0, 'Area')),
      soilType: String(input.soilType || '').trim(),
      irrigationType: String(input.irrigationType || '').trim(),
      targetYield: Math.max(0, number(input.targetYield || 0, 'Target yield')),
      createdAt: new Date().toISOString()
    };
    if (!zone.name) throw new Error('Zone name is required.');
    data.zones.push(zone);
    save(data);
    return zone;
  }

  function recordSoilSample(input) {
    const data = read();
    if (!data.fields.some(item => item.id === input.fieldId)) throw new Error('Field not found.');
    const sample = {
      id: uid('soil'),
      fieldId: input.fieldId,
      zoneId: String(input.zoneId || ''),
      sampleDate: String(input.sampleDate || new Date().toISOString().slice(0, 10)),
      latitude: number(input.latitude, 'Latitude'),
      longitude: number(input.longitude, 'Longitude'),
      ph: number(input.ph, 'pH'),
      nitrogen: number(input.nitrogen || 0, 'Nitrogen'),
      phosphorus: number(input.phosphorus || 0, 'Phosphorus'),
      potassium: number(input.potassium || 0, 'Potassium'),
      organicMatter: number(input.organicMatter || 0, 'Organic matter'),
      moisture: number(input.moisture || 0, 'Moisture'),
      notes: String(input.notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    data.soilSamples.unshift(sample);
    save(data);
    return sample;
  }

  function registerSensor(input) {
    const data = read();
    if (!data.fields.some(item => item.id === input.fieldId)) throw new Error('Field not found.');
    const sensor = {
      id: uid('sensor'),
      fieldId: input.fieldId,
      zoneId: String(input.zoneId || ''),
      name: String(input.name || '').trim(),
      type: String(input.type || 'Soil Moisture'),
      latitude: number(input.latitude, 'Latitude'),
      longitude: number(input.longitude, 'Longitude'),
      unit: String(input.unit || '%'),
      lastValue: input.lastValue == null ? null : number(input.lastValue, 'Sensor value'),
      lastReadingAt: String(input.lastReadingAt || ''),
      status: String(input.status || 'Online'),
      createdAt: new Date().toISOString()
    };
    if (!sensor.name) throw new Error('Sensor name is required.');
    data.sensors.push(sensor);
    save(data);
    return sensor;
  }

  function updateSensorReading(sensorId, value, recordedAt = new Date().toISOString()) {
    const data = read();
    const sensor = data.sensors.find(item => item.id === sensorId);
    if (!sensor) throw new Error('Sensor not found.');
    sensor.lastValue = number(value, 'Sensor value');
    sensor.lastReadingAt = recordedAt;
    sensor.status = 'Online';
    save(data);
    return sensor;
  }

  function addCropObservation(input) {
    const data = read();
    if (!data.fields.some(item => item.id === input.fieldId)) throw new Error('Field not found.');
    const observation = {
      id: uid('observation'),
      fieldId: input.fieldId,
      zoneId: String(input.zoneId || ''),
      date: String(input.date || new Date().toISOString().slice(0, 10)),
      latitude: number(input.latitude, 'Latitude'),
      longitude: number(input.longitude, 'Longitude'),
      category: String(input.category || 'Crop Health'),
      severity: String(input.severity || 'Low'),
      ndvi: input.ndvi == null ? null : number(input.ndvi, 'NDVI'),
      notes: String(input.notes || '').trim(),
      imageUrl: String(input.imageUrl || '').trim(),
      status: String(input.status || 'Open'),
      createdAt: new Date().toISOString()
    };
    data.observations.unshift(observation);
    save(data);
    return observation;
  }

  function createIrrigationPlan(input) {
    const data = read();
    if (!data.fields.some(item => item.id === input.fieldId)) throw new Error('Field not found.');
    const plan = {
      id: uid('irrigation'),
      fieldId: input.fieldId,
      zoneId: String(input.zoneId || ''),
      startDate: String(input.startDate || new Date().toISOString().slice(0, 10)),
      frequency: String(input.frequency || 'Weekly'),
      durationMinutes: Math.max(0, number(input.durationMinutes || 0, 'Duration')),
      volume: Math.max(0, number(input.volume || 0, 'Volume')),
      volumeUnit: String(input.volumeUnit || 'liters'),
      triggerMoistureBelow: Math.max(0, number(input.triggerMoistureBelow || 0, 'Moisture threshold')),
      status: String(input.status || 'Scheduled'),
      createdAt: new Date().toISOString()
    };
    data.irrigationPlans.unshift(plan);
    save(data);
    return plan;
  }

  function fieldHealth(fieldId) {
    const data = read();
    const observations = data.observations.filter(item => item.fieldId === fieldId);
    const ndviValues = observations.map(item => item.ndvi).filter(Number.isFinite);
    const averageNdvi = ndviValues.length ? ndviValues.reduce((sum, value) => sum + value, 0) / ndviValues.length : null;
    const openIssues = observations.filter(item => item.status !== 'Resolved').length;
    const sensors = data.sensors.filter(item => item.fieldId === fieldId);
    return {
      fieldId,
      averageNdvi,
      openIssues,
      sensorsOnline: sensors.filter(item => item.status === 'Online').length,
      sensorsTotal: sensors.length,
      soilSamples: data.soilSamples.filter(item => item.fieldId === fieldId).length
    };
  }

  function summary(source = read()) {
    return {
      fields: source.fields.length,
      mappedArea: source.fields.reduce((sum, item) => sum + item.area, 0),
      managementZones: source.zones.length,
      soilSamples: source.soilSamples.length,
      sensorsOnline: source.sensors.filter(item => item.status === 'Online').length,
      openObservations: source.observations.filter(item => item.status !== 'Resolved').length,
      irrigationPlans: source.irrigationPlans.filter(item => item.status === 'Scheduled').length
    };
  }

  window.AgriSmartGIS = Object.freeze({
    read,
    addField,
    addManagementZone,
    recordSoilSample,
    registerSensor,
    updateSensorReading,
    addCropObservation,
    createIrrigationPlan,
    fieldHealth,
    summary
  });
})();