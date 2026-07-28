(() => {
  const FARM_KEY = 'agrismart-farms-v1';
  const EXPENSE_KEY = 'agrismart-expenses-v1';
  const HARVEST_KEY = 'agrismart-harvests-v1';
  const INVENTORY_KEY = 'agrismart-inventory-v1';
  const MOVEMENT_KEY = 'agrismart-inventory-movements-v1';
  const CURRENCY_KEY = 'agrismart-currency-v1';
  const DATA_KEYS = [FARM_KEY, EXPENSE_KEY, HARVEST_KEY, INVENTORY_KEY, MOVEMENT_KEY];
  const SUPPORTED_CURRENCIES = Object.freeze(['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'GHS', 'MWK', 'SLE', 'ZAR', 'XOF']);

  const read = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const normalizeCurrency = value => {
    const code = String(value || '').trim().toUpperCase();
    return SUPPORTED_CURRENCIES.includes(code) ? code : 'NGN';
  };

  const getCurrency = () => normalizeCurrency(localStorage.getItem(CURRENCY_KEY) || 'NGN');
  const setCurrency = value => {
    const currency = normalizeCurrency(value);
    localStorage.setItem(CURRENCY_KEY, currency);
    window.dispatchEvent(new CustomEvent('agrismart:currencychange', { detail: { currency } }));
    return currency;
  };

  const emitChange = (key, eventName = 'agrismart:datachange') => {
    window.dispatchEvent(new CustomEvent(eventName, { detail: { key } }));
  };

  const write = (key, value, eventName = 'agrismart:datachange') => {
    localStorage.setItem(key, JSON.stringify(value));
    emitChange(key, eventName);
  };

  const normalizeMoney = value => {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  };

  const addExpense = record => {
    const expense = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      category: String(record.category || 'Other').trim(),
      description: String(record.description || '').trim(),
      amount: normalizeMoney(record.amount),
      currency: normalizeCurrency(record.currency || getCurrency()),
      date: record.date || new Date().toISOString().slice(0, 10),
      farmId: record.farmId || null,
      createdAt: new Date().toISOString()
    };
    const expenses = read(EXPENSE_KEY);
    expenses.push(expense);
    write(EXPENSE_KEY, expenses);
    return expense;
  };

  const addHarvest = record => {
    const harvest = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      crop: String(record.crop || '').trim(),
      quantity: Math.max(0, Number(record.quantity) || 0),
      unit: String(record.unit || 'kg').trim(),
      revenue: normalizeMoney(record.revenue),
      currency: normalizeCurrency(record.currency || getCurrency()),
      date: record.date || new Date().toISOString().slice(0, 10),
      farmId: record.farmId || null,
      createdAt: new Date().toISOString()
    };
    const harvests = read(HARVEST_KEY);
    harvests.push(harvest);
    write(HARVEST_KEY, harvests);
    return harvest;
  };

  const removeRecord = (type, id) => {
    const keys = { expense: EXPENSE_KEY, harvest: HARVEST_KEY };
    const key = keys[type];
    if (!key) return false;
    const records = read(key);
    const filtered = records.filter(record => record.id !== id);
    if (filtered.length === records.length) return false;
    write(key, filtered);
    return true;
  };

  const getSummary = requestedCurrency => {
    const currency = normalizeCurrency(requestedCurrency || getCurrency());
    const farms = read(FARM_KEY);
    const expenses = read(EXPENSE_KEY);
    const harvests = read(HARVEST_KEY);
    const inventory = read(INVENTORY_KEY);
    const movements = read(MOVEMENT_KEY);
    const matchesCurrency = item => normalizeCurrency(item.currency || currency) === currency;
    const totalExpenses = expenses.filter(matchesCurrency).reduce((sum, item) => sum + normalizeMoney(item.amount), 0);
    const totalRevenue = harvests.filter(matchesCurrency).reduce((sum, item) => sum + normalizeMoney(item.revenue), 0);
    const totalArea = farms.reduce((sum, farm) => sum + (Number(farm.size) || 0), 0);
    return {
      currency,
      farms: farms.length,
      totalArea,
      expenses: expenses.filter(matchesCurrency).length,
      harvests: harvests.filter(matchesCurrency).length,
      inventoryItems: inventory.length,
      inventoryMovements: movements.length,
      totalExpenses,
      totalRevenue,
      estimatedProfit: totalRevenue - totalExpenses
    };
  };

  const buildCsv = () => {
    const rows = [['Record Type', 'Date', 'Farm ID', 'Category/Crop', 'Description/Unit', 'Amount/Revenue', 'Currency', 'Quantity']];
    read(EXPENSE_KEY).forEach(item => rows.push([
      'Expense', item.date, item.farmId || '', item.category, item.description, item.amount, normalizeCurrency(item.currency || getCurrency()), ''
    ]));
    read(HARVEST_KEY).forEach(item => rows.push([
      'Harvest', item.date, item.farmId || '', item.crop, item.unit, item.revenue, normalizeCurrency(item.currency || getCurrency()), item.quantity
    ]));
    return rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  };

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => download(buildCsv(), `agrismart-records-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');

  const exportBackup = () => {
    const payload = {
      app: 'AgriSmart Connect',
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: { currency: getCurrency() },
      farms: read(FARM_KEY),
      expenses: read(EXPENSE_KEY),
      harvests: read(HARVEST_KEY),
      inventory: read(INVENTORY_KEY),
      inventoryMovements: read(MOVEMENT_KEY)
    };
    download(JSON.stringify(payload, null, 2), `agrismart-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const validateArray = (data, key, required = true) => {
    if (Array.isArray(data[key])) {
      if (data[key].some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error(`Invalid backup structure: ${key} contains an invalid record`);
      }
      return data[key];
    }
    if (!required && data[key] === undefined) return [];
    throw new Error(`Invalid backup structure: ${key} is missing`);
  };

  const captureSnapshot = () => Object.fromEntries([...DATA_KEYS, CURRENCY_KEY].map(key => [key, localStorage.getItem(key)]));

  const restoreSnapshot = snapshot => {
    [...DATA_KEYS, CURRENCY_KEY].forEach(key => {
      if (snapshot[key] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, snapshot[key]);
    });
  };

  const notifyAllDataChanged = () => {
    [FARM_KEY, EXPENSE_KEY, HARVEST_KEY].forEach(key => emitChange(key));
    [INVENTORY_KEY, MOVEMENT_KEY].forEach(key => emitChange(key, 'agrismart:inventorychange'));
    window.dispatchEvent(new CustomEvent('agrismart:currencychange', { detail: { currency: getCurrency() } }));
    window.dispatchEvent(new CustomEvent('agrismart:restorecomplete'));
  };

  const importBackup = async file => {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('This file is not valid JSON');
    }

    if (!data || ![1, 2].includes(data.version)) throw new Error('Unsupported backup file');

    const restoredData = {
      [FARM_KEY]: validateArray(data, 'farms'),
      [EXPENSE_KEY]: validateArray(data, 'expenses'),
      [HARVEST_KEY]: validateArray(data, 'harvests'),
      [INVENTORY_KEY]: validateArray(data, 'inventory', false),
      [MOVEMENT_KEY]: validateArray(data, 'inventoryMovements', false)
    };

    const snapshot = captureSnapshot();
    try {
      DATA_KEYS.forEach(key => localStorage.setItem(key, JSON.stringify(restoredData[key])));
      if (data.settings?.currency) localStorage.setItem(CURRENCY_KEY, normalizeCurrency(data.settings.currency));
    } catch (error) {
      try {
        restoreSnapshot(snapshot);
      } catch {
        throw new Error('Restore failed and the previous local data could not be fully recovered');
      }
      throw new Error(error?.name === 'QuotaExceededError'
        ? 'Restore failed because this device does not have enough storage space'
        : 'Restore failed; your previous data was preserved');
    }

    notifyAllDataChanged();
    return getSummary();
  };

  window.AgriSmartReports = Object.freeze({
    addExpense,
    addHarvest,
    removeRecord,
    getExpenses: () => read(EXPENSE_KEY),
    getHarvests: () => read(HARVEST_KEY),
    getSummary,
    getCurrency,
    setCurrency,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    exportCsv,
    exportBackup,
    importBackup
  });
})();