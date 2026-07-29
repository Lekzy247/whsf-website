(() => {
  'use strict';

  const KEY = 'agrismart-fleet-v1';
  const makeId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const blank = () => ({ vehicles: [], drivers: [], deliveries: [], fuel: [], maintenance: [] });
  const read = () => {
    try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return blank(); }
  };
  const write = state => {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('agrismart:fleetchange'));
    return state;
  };

  function addVehicle(input) {
    const state = read();
    const vehicle = {
      id: makeId('vehicle'),
      registration: String(input.registration || '').trim().toUpperCase(),
      type: String(input.type || 'Truck'),
      capacity: Number(input.capacity || 0),
      capacityUnit: String(input.capacityUnit || 'kg'),
      status: 'Available',
      createdAt: new Date().toISOString()
    };
    if (!vehicle.registration) throw new Error('Vehicle registration is required.');
    if (state.vehicles.some(item => item.registration === vehicle.registration)) throw new Error('Vehicle already exists.');
    state.vehicles.push(vehicle);
    write(state);
    return vehicle;
  }

  function addDriver(input) {
    const state = read();
    const driver = {
      id: makeId('driver'),
      name: String(input.name || '').trim(),
      phone: String(input.phone || '').trim(),
      licenseNumber: String(input.licenseNumber || '').trim(),
      licenseExpiry: String(input.licenseExpiry || ''),
      status: 'Available',
      completedDeliveries: 0,
      createdAt: new Date().toISOString()
    };
    if (!driver.name || !driver.licenseNumber) throw new Error('Driver name and license number are required.');
    state.drivers.push(driver);
    write(state);
    return driver;
  }

  function scheduleDelivery(input) {
    const state = read();
    const vehicle = state.vehicles.find(item => item.id === input.vehicleId);
    const driver = state.drivers.find(item => item.id === input.driverId);
    if (!vehicle || vehicle.status !== 'Available') throw new Error('Select an available vehicle.');
    if (!driver || driver.status !== 'Available') throw new Error('Select an available driver.');
    const delivery = {
      id: makeId('delivery'),
      number: `DEL-${Date.now().toString().slice(-7)}`,
      origin: String(input.origin || '').trim(),
      destination: String(input.destination || '').trim(),
      cargo: String(input.cargo || '').trim(),
      quantity: Number(input.quantity || 0),
      unit: String(input.unit || 'kg'),
      vehicleId: vehicle.id,
      driverId: driver.id,
      scheduledDate: String(input.scheduledDate || ''),
      trackingCode: `TRK-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      status: 'Scheduled',
      createdAt: new Date().toISOString()
    };
    if (!delivery.origin || !delivery.destination || !delivery.cargo) throw new Error('Origin, destination and cargo are required.');
    vehicle.status = 'Assigned';
    driver.status = 'Assigned';
    state.deliveries.unshift(delivery);
    write(state);
    return delivery;
  }

  function setDeliveryStatus(deliveryId, status, proofOfDelivery = '') {
    const state = read();
    const delivery = state.deliveries.find(item => item.id === deliveryId);
    if (!delivery) throw new Error('Delivery not found.');
    delivery.status = status;
    delivery.updatedAt = new Date().toISOString();
    if (proofOfDelivery) delivery.proofOfDelivery = String(proofOfDelivery);
    const vehicle = state.vehicles.find(item => item.id === delivery.vehicleId);
    const driver = state.drivers.find(item => item.id === delivery.driverId);
    if (status === 'Dispatched') {
      if (vehicle) vehicle.status = 'In Transit';
      if (driver) driver.status = 'On Delivery';
    }
    if (status === 'Delivered' || status === 'Cancelled') {
      if (vehicle) vehicle.status = 'Available';
      if (driver) {
        driver.status = 'Available';
        if (status === 'Delivered') driver.completedDeliveries += 1;
      }
    }
    write(state);
    return delivery;
  }

  function recordFuel(input) {
    const state = read();
    if (!state.vehicles.some(item => item.id === input.vehicleId)) throw new Error('Vehicle not found.');
    const record = {
      id: makeId('fuel'),
      vehicleId: input.vehicleId,
      litres: Number(input.litres || 0),
      cost: Number(input.cost || 0),
      odometer: Number(input.odometer || 0),
      date: String(input.date || new Date().toISOString().slice(0, 10))
    };
    if (record.litres <= 0 || record.cost < 0) throw new Error('Enter valid fuel details.');
    state.fuel.unshift(record);
    write(state);
    return record;
  }

  function recordMaintenance(input) {
    const state = read();
    if (!state.vehicles.some(item => item.id === input.vehicleId)) throw new Error('Vehicle not found.');
    const record = {
      id: makeId('maintenance'),
      vehicleId: input.vehicleId,
      serviceType: String(input.serviceType || '').trim(),
      cost: Number(input.cost || 0),
      serviceDate: String(input.serviceDate || ''),
      nextServiceDate: String(input.nextServiceDate || ''),
      notes: String(input.notes || ''),
      createdAt: new Date().toISOString()
    };
    if (!record.serviceType) throw new Error('Service type is required.');
    state.maintenance.unshift(record);
    write(state);
    return record;
  }

  window.AgriSmartFleet = Object.freeze({
    read,
    addVehicle,
    addDriver,
    scheduleDelivery,
    dispatchDelivery: deliveryId => setDeliveryStatus(deliveryId, 'Dispatched'),
    completeDelivery: (deliveryId, proofOfDelivery) => setDeliveryStatus(deliveryId, 'Delivered', proofOfDelivery),
    cancelDelivery: deliveryId => setDeliveryStatus(deliveryId, 'Cancelled'),
    recordFuel,
    recordMaintenance
  });
})();