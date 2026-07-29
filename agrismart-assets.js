(() => {
  'use strict';

  const KEY = 'agrismart-assets-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults = () => ({ assets: [], maintenance: [], workOrders: [], fuelLogs: [], utilization: [] });

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
    window.dispatchEvent(new CustomEvent('agrismart:assetschange', { detail: summary(data) }));
    return data;
  }

  function number(value, label) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a valid non-negative number.`);
    return parsed;
  }

  function addAsset(input) {
    const data = read();
    const asset = {
      id: uid('asset'),
      assetNumber: String(input.assetNumber || `AST-${String(data.assets.length + 1).padStart(5, '0')}`),
      name: String(input.name || '').trim(),
      category: String(input.category || 'Farm Equipment'),
      manufacturer: String(input.manufacturer || '').trim(),
      model: String(input.model || '').trim(),
      serialNumber: String(input.serialNumber || '').trim(),
      location: String(input.location || '').trim(),
      purchaseDate: String(input.purchaseDate || ''),
      purchaseCost: number(input.purchaseCost, 'Purchase cost'),
      salvageValue: number(input.salvageValue, 'Salvage value'),
      usefulLifeYears: number(input.usefulLifeYears || 5, 'Useful life'),
      currency: String(input.currency || 'USD').toUpperCase(),
      meterType: String(input.meterType || 'Hours'),
      currentMeter: number(input.currentMeter, 'Current meter'),
      status: String(input.status || 'Active'),
      createdAt: new Date().toISOString()
    };
    if (!asset.name) throw new Error('Asset name is required.');
    if (data.assets.some(item => item.assetNumber === asset.assetNumber)) throw new Error('Asset number already exists.');
    data.assets.push(asset);
    save(data);
    return asset;
  }

  function scheduleMaintenance(input) {
    const data = read();
    if (!data.assets.some(item => item.id === input.assetId)) throw new Error('Asset not found.');
    const record = {
      id: uid('maintenance'),
      assetId: input.assetId,
      type: String(input.type || 'Preventive'),
      description: String(input.description || '').trim(),
      scheduledDate: String(input.scheduledDate || ''),
      meterDue: number(input.meterDue, 'Meter due'),
      estimatedCost: number(input.estimatedCost, 'Estimated cost'),
      assignedTo: String(input.assignedTo || '').trim(),
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    };
    if (!record.description || !record.scheduledDate) throw new Error('Maintenance description and scheduled date are required.');
    data.maintenance.unshift(record);
    save(data);
    return record;
  }

  function createWorkOrder(input) {
    const data = read();
    if (!data.assets.some(item => item.id === input.assetId)) throw new Error('Asset not found.');
    const workOrder = {
      id: uid('workorder'),
      number: `WO-${String(data.workOrders.length + 1).padStart(5, '0')}`,
      assetId: input.assetId,
      maintenanceId: String(input.maintenanceId || ''),
      priority: String(input.priority || 'Medium'),
      issue: String(input.issue || '').trim(),
      technician: String(input.technician || '').trim(),
      laborCost: number(input.laborCost, 'Labor cost'),
      partsCost: number(input.partsCost, 'Parts cost'),
      status: 'Open',
      openedAt: new Date().toISOString()
    };
    if (!workOrder.issue) throw new Error('Work order issue is required.');
    data.workOrders.unshift(workOrder);
    save(data);
    return workOrder;
  }

  function completeWorkOrder(id, input = {}) {
    const data = read();
    const workOrder = data.workOrders.find(item => item.id === id);
    if (!workOrder) throw new Error('Work order not found.');
    workOrder.status = 'Completed';
    workOrder.laborCost = number(input.laborCost ?? workOrder.laborCost, 'Labor cost');
    workOrder.partsCost = number(input.partsCost ?? workOrder.partsCost, 'Parts cost');
    workOrder.notes = String(input.notes || '').trim();
    workOrder.completedAt = new Date().toISOString();
    if (workOrder.maintenanceId) {
      const maintenance = data.maintenance.find(item => item.id === workOrder.maintenanceId);
      if (maintenance) maintenance.status = 'Completed';
    }
    save(data);
    return workOrder;
  }

  function recordFuel(input) {
    const data = read();
    if (!data.assets.some(item => item.id === input.assetId)) throw new Error('Asset not found.');
    const log = {
      id: uid('fuel'),
      assetId: input.assetId,
      date: String(input.date || new Date().toISOString().slice(0, 10)),
      quantity: number(input.quantity, 'Fuel quantity'),
      unit: String(input.unit || 'liters'),
      unitCost: number(input.unitCost, 'Unit cost'),
      totalCost: number(input.quantity, 'Fuel quantity') * number(input.unitCost, 'Unit cost'),
      meterReading: number(input.meterReading, 'Meter reading'),
      operator: String(input.operator || '').trim(),
      createdAt: new Date().toISOString()
    };
    data.fuelLogs.unshift(log);
    const asset = data.assets.find(item => item.id === input.assetId);
    if (log.meterReading > asset.currentMeter) asset.currentMeter = log.meterReading;
    save(data);
    return log;
  }

  function recordUtilization(input) {
    const data = read();
    if (!data.assets.some(item => item.id === input.assetId)) throw new Error('Asset not found.');
    const record = {
      id: uid('utilization'),
      assetId: input.assetId,
      date: String(input.date || new Date().toISOString().slice(0, 10)),
      hours: number(input.hours, 'Hours'),
      assignment: String(input.assignment || '').trim(),
      operator: String(input.operator || '').trim(),
      meterEnd: number(input.meterEnd, 'Ending meter'),
      createdAt: new Date().toISOString()
    };
    data.utilization.unshift(record);
    const asset = data.assets.find(item => item.id === input.assetId);
    if (record.meterEnd > asset.currentMeter) asset.currentMeter = record.meterEnd;
    save(data);
    return record;
  }

  function depreciation(assetId, asOf = new Date().toISOString().slice(0, 10)) {
    const asset = read().assets.find(item => item.id === assetId);
    if (!asset) throw new Error('Asset not found.');
    if (!asset.purchaseDate || !asset.usefulLifeYears) return { annual: 0, accumulated: 0, bookValue: asset.purchaseCost };
    const annual = Math.max(0, (asset.purchaseCost - asset.salvageValue) / asset.usefulLifeYears);
    const years = Math.max(0, (new Date(asOf) - new Date(asset.purchaseDate)) / 31557600000);
    const accumulated = Math.min(asset.purchaseCost - asset.salvageValue, annual * years);
    return { annual, accumulated, bookValue: Math.max(asset.salvageValue, asset.purchaseCost - accumulated) };
  }

  function summary(source = read()) {
    const maintenanceCost = source.workOrders.reduce((sum, item) => sum + item.laborCost + item.partsCost, 0);
    const fuelCost = source.fuelLogs.reduce((sum, item) => sum + item.totalCost, 0);
    return {
      totalAssets: source.assets.length,
      activeAssets: source.assets.filter(item => item.status === 'Active').length,
      scheduledMaintenance: source.maintenance.filter(item => item.status === 'Scheduled').length,
      openWorkOrders: source.workOrders.filter(item => item.status === 'Open').length,
      maintenanceCost,
      fuelCost,
      utilizationHours: source.utilization.reduce((sum, item) => sum + item.hours, 0)
    };
  }

  window.AgriSmartAssets = Object.freeze({
    read,
    addAsset,
    scheduleMaintenance,
    createWorkOrder,
    completeWorkOrder,
    recordFuel,
    recordUtilization,
    depreciation,
    summary
  });
})();