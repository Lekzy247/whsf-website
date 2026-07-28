(() => {
  const INVENTORY_KEY = 'agrismart-inventory-v1';
  const MOVEMENT_KEY = 'agrismart-inventory-movements-v1';

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
    window.dispatchEvent(new CustomEvent('agrismart:inventorychange', { detail: { key } }));
  };

  const createId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const text = value => String(value || '').trim();

  const addItem = record => {
    const name = text(record.name);
    const unit = text(record.unit) || 'units';
    if (!name) throw new Error('Item name is required');

    const items = read(INVENTORY_KEY);
    const duplicate = items.find(item => item.name.toLowerCase() === name.toLowerCase() && item.unit.toLowerCase() === unit.toLowerCase());
    if (duplicate) throw new Error('An inventory item with this name and unit already exists');

    const item = {
      id: createId(),
      name,
      category: text(record.category) || 'Other',
      unit,
      quantity: number(record.quantity),
      reorderLevel: number(record.reorderLevel),
      farmId: record.farmId || null,
      supplier: text(record.supplier),
      notes: text(record.notes),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    items.push(item);
    write(INVENTORY_KEY, items);
    return item;
  };

  const updateItem = (id, changes) => {
    const items = read(INVENTORY_KEY);
    const index = items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Inventory item not found');

    const current = items[index];
    const updated = {
      ...current,
      name: changes.name === undefined ? current.name : text(changes.name),
      category: changes.category === undefined ? current.category : text(changes.category),
      unit: changes.unit === undefined ? current.unit : text(changes.unit),
      reorderLevel: changes.reorderLevel === undefined ? current.reorderLevel : number(changes.reorderLevel),
      supplier: changes.supplier === undefined ? current.supplier : text(changes.supplier),
      notes: changes.notes === undefined ? current.notes : text(changes.notes),
      farmId: changes.farmId === undefined ? current.farmId : changes.farmId,
      updatedAt: new Date().toISOString()
    };

    if (!updated.name || !updated.unit) throw new Error('Item name and unit are required');
    items[index] = updated;
    write(INVENTORY_KEY, items);
    return updated;
  };

  const recordMovement = record => {
    const items = read(INVENTORY_KEY);
    const index = items.findIndex(item => item.id === record.itemId);
    if (index < 0) throw new Error('Inventory item not found');

    const type = record.type === 'out' ? 'out' : 'in';
    const quantity = number(record.quantity);
    if (quantity <= 0) throw new Error('Movement quantity must be greater than zero');

    const currentQuantity = number(items[index].quantity);
    if (type === 'out' && quantity > currentQuantity) throw new Error('Not enough stock for this movement');

    items[index] = {
      ...items[index],
      quantity: type === 'in' ? currentQuantity + quantity : currentQuantity - quantity,
      updatedAt: new Date().toISOString()
    };
    write(INVENTORY_KEY, items);

    const movements = read(MOVEMENT_KEY);
    const movement = {
      id: createId(),
      itemId: record.itemId,
      itemName: items[index].name,
      type,
      quantity,
      unit: items[index].unit,
      reason: text(record.reason) || (type === 'in' ? 'Stock received' : 'Farm use'),
      date: record.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };
    movements.push(movement);
    write(MOVEMENT_KEY, movements);
    return { item: items[index], movement };
  };

  const removeItem = id => {
    const items = read(INVENTORY_KEY);
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    write(INVENTORY_KEY, filtered);
    return true;
  };

  const getItems = filters => {
    let items = read(INVENTORY_KEY);
    if (filters?.category) items = items.filter(item => item.category === filters.category);
    if (filters?.farmId) items = items.filter(item => item.farmId === filters.farmId);
    if (filters?.lowStock) items = items.filter(item => number(item.quantity) <= number(item.reorderLevel));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  };

  const getSummary = () => {
    const items = read(INVENTORY_KEY);
    const lowStock = items.filter(item => number(item.quantity) <= number(item.reorderLevel));
    const outOfStock = items.filter(item => number(item.quantity) === 0);
    const categories = [...new Set(items.map(item => item.category).filter(Boolean))];
    return {
      itemCount: items.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      categoryCount: categories.length,
      lowStock
    };
  };

  const exportCsv = () => {
    const rows = [['Item', 'Category', 'Quantity', 'Unit', 'Reorder Level', 'Supplier', 'Farm ID', 'Updated At']];
    read(INVENTORY_KEY).forEach(item => rows.push([
      item.name, item.category, item.quantity, item.unit, item.reorderLevel,
      item.supplier, item.farmId || '', item.updatedAt
    ]));
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agrismart-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  window.AgriSmartInventory = Object.freeze({
    addItem,
    updateItem,
    recordMovement,
    removeItem,
    getItems,
    getMovements: () => read(MOVEMENT_KEY).slice().reverse(),
    getSummary,
    exportCsv
  });
})();