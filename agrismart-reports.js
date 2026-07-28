(() => {
  const FARM_KEY = 'agrismart-farms-v1';
  const EXPENSE_KEY = 'agrismart-expenses-v1';
  const HARVEST_KEY = 'agrismart-harvests-v1';

  const read = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('agrismart:datachange', { detail: { key } }));
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

  const getSummary = () => {
    const farms = read(FARM_KEY);
    const expenses = read(EXPENSE_KEY);
    const harvests = read(HARVEST_KEY);
    const totalExpenses = expenses.reduce((sum, item) => sum + normalizeMoney(item.amount), 0);
    const totalRevenue = harvests.reduce((sum, item) => sum + normalizeMoney(item.revenue), 0);
    const totalArea = farms.reduce((sum, farm) => sum + (Number(farm.size) || 0), 0);
    return {
      farms: farms.length,
      totalArea,
      expenses: expenses.length,
      harvests: harvests.length,
      totalExpenses,
      totalRevenue,
      estimatedProfit: totalRevenue - totalExpenses
    };
  };

  const buildCsv = () => {
    const rows = [['Record Type', 'Date', 'Farm ID', 'Category/Crop', 'Description/Unit', 'Amount/Revenue', 'Quantity']];
    read(EXPENSE_KEY).forEach(item => rows.push([
      'Expense', item.date, item.farmId || '', item.category, item.description, item.amount, ''
    ]));
    read(HARVEST_KEY).forEach(item => rows.push([
      'Harvest', item.date, item.farmId || '', item.crop, item.unit, item.revenue, item.quantity
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
      version: 1,
      exportedAt: new Date().toISOString(),
      farms: read(FARM_KEY),
      expenses: read(EXPENSE_KEY),
      harvests: read(HARVEST_KEY)
    };
    download(JSON.stringify(payload, null, 2), `agrismart-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const importBackup = async file => {
    const data = JSON.parse(await file.text());
    if (!data || data.version !== 1) throw new Error('Unsupported backup file');
    if (!Array.isArray(data.farms) || !Array.isArray(data.expenses) || !Array.isArray(data.harvests)) {
      throw new Error('Invalid backup structure');
    }
    write(FARM_KEY, data.farms);
    write(EXPENSE_KEY, data.expenses);
    write(HARVEST_KEY, data.harvests);
    return getSummary();
  };

  window.AgriSmartReports = Object.freeze({
    addExpense,
    addHarvest,
    removeRecord,
    getExpenses: () => read(EXPENSE_KEY),
    getHarvests: () => read(HARVEST_KEY),
    getSummary,
    exportCsv,
    exportBackup,
    importBackup
  });
})();