(() => {
  'use strict';

  const KEY = 'agrismart-finance-v2';
  const LEGACY_KEY = 'agrismart-finance-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const defaults = () => ({ accounts: [], journals: [], budgets: [], invoices: [], bills: [], payments: [] });

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}');
      return { ...defaults(), ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:financechange', { detail: dashboard(data) }));
    return data;
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid non-negative amount.');
    return amount;
  }

  function addAccount(input) {
    const data = read();
    const account = {
      id: uid('account'),
      code: String(input.code || '').trim(),
      name: String(input.name || '').trim(),
      type: String(input.type || 'Asset'),
      currency: String(input.currency || 'USD').toUpperCase(),
      active: input.active !== false,
      createdAt: new Date().toISOString()
    };
    if (!account.code || !account.name) throw new Error('Account code and name are required.');
    if (data.accounts.some(item => item.code === account.code)) throw new Error('Account code already exists.');
    data.accounts.push(account);
    save(data);
    return account;
  }

  function postJournal(input) {
    const data = read();
    const lines = Array.isArray(input.lines) ? input.lines.map(line => ({
      accountId: String(line.accountId || ''),
      debit: money(line.debit || 0),
      credit: money(line.credit || 0),
      memo: String(line.memo || '').trim()
    })) : [];
    if (lines.length < 2) throw new Error('A journal requires at least two lines.');
    const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
    const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(debitTotal - creditTotal) > 0.005) throw new Error('Journal debits and credits must balance.');
    const journal = {
      id: uid('journal'),
      number: `JE-${String(data.journals.length + 1).padStart(5, '0')}`,
      date: String(input.date || today()),
      description: String(input.description || '').trim(),
      reference: String(input.reference || '').trim(),
      currency: String(input.currency || 'USD').toUpperCase(),
      lines,
      debitTotal,
      creditTotal,
      status: 'Posted',
      postedAt: new Date().toISOString()
    };
    if (!journal.description) throw new Error('Journal description is required.');
    data.journals.unshift(journal);
    save(data);
    return journal;
  }

  function addBudget(input) {
    const data = read();
    const budget = {
      id: uid('budget'),
      name: String(input.name || '').trim(),
      amount: money(input.amount || 0),
      currency: String(input.currency || 'USD').toUpperCase(),
      period: String(input.period || 'Annual'),
      costCenter: String(input.costCenter || '').trim(),
      startDate: String(input.startDate || ''),
      endDate: String(input.endDate || ''),
      createdAt: new Date().toISOString()
    };
    if (!budget.name) throw new Error('Budget name is required.');
    data.budgets.push(budget);
    save(data);
    return budget;
  }

  function createInvoice(input) {
    const data = read();
    const invoice = {
      id: uid('invoice'),
      number: `INV-${String(data.invoices.length + 1).padStart(5, '0')}`,
      customerId: String(input.customerId || ''),
      customerName: String(input.customerName || '').trim(),
      issueDate: String(input.issueDate || today()),
      dueDate: String(input.dueDate || today()),
      amount: money(input.amount || 0),
      paidAmount: 0,
      currency: String(input.currency || 'USD').toUpperCase(),
      description: String(input.description || '').trim(),
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    if (!invoice.customerName) throw new Error('Customer name is required.');
    data.invoices.unshift(invoice);
    save(data);
    return invoice;
  }

  function createBill(input) {
    const data = read();
    const bill = {
      id: uid('bill'),
      number: `BILL-${String(data.bills.length + 1).padStart(5, '0')}`,
      supplierId: String(input.supplierId || ''),
      supplierName: String(input.supplierName || '').trim(),
      issueDate: String(input.issueDate || today()),
      dueDate: String(input.dueDate || today()),
      amount: money(input.amount || 0),
      paidAmount: 0,
      currency: String(input.currency || 'USD').toUpperCase(),
      description: String(input.description || '').trim(),
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    if (!bill.supplierName) throw new Error('Supplier name is required.');
    data.bills.unshift(bill);
    save(data);
    return bill;
  }

  function recordPayment(input) {
    const data = read();
    const direction = String(input.direction || 'Incoming');
    const documentList = direction === 'Incoming' ? data.invoices : data.bills;
    const document = documentList.find(item => item.id === input.documentId);
    if (!document) throw new Error('Related invoice or bill was not found.');
    const amount = money(input.amount || 0);
    const outstanding = Math.max(0, document.amount - document.paidAmount);
    if (amount <= 0 || amount > outstanding) throw new Error('Payment must be greater than zero and no more than the outstanding balance.');
    const payment = {
      id: uid('payment'),
      direction,
      documentId: document.id,
      documentNumber: document.number,
      amount,
      currency: document.currency,
      method: String(input.method || 'Bank Transfer'),
      reference: String(input.reference || '').trim(),
      date: String(input.date || today()),
      createdAt: new Date().toISOString()
    };
    document.paidAmount += amount;
    document.status = document.paidAmount >= document.amount ? 'Paid' : 'Partially Paid';
    data.payments.unshift(payment);
    save(data);
    return payment;
  }

  function ageReceivables(asOf = today()) {
    const point = new Date(`${asOf}T00:00:00Z`).getTime();
    return read().invoices.filter(item => item.status !== 'Paid').map(item => {
      const daysOverdue = Math.max(0, Math.floor((point - new Date(`${item.dueDate}T00:00:00Z`).getTime()) / 86400000));
      return { ...item, outstanding: item.amount - item.paidAmount, daysOverdue };
    });
  }

  function agePayables(asOf = today()) {
    const point = new Date(`${asOf}T00:00:00Z`).getTime();
    return read().bills.filter(item => item.status !== 'Paid').map(item => {
      const daysOverdue = Math.max(0, Math.floor((point - new Date(`${item.dueDate}T00:00:00Z`).getTime()) / 86400000));
      return { ...item, outstanding: item.amount - item.paidAmount, daysOverdue };
    });
  }

  function dashboard(source = read()) {
    const receivables = source.invoices.reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0);
    const payables = source.bills.reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0);
    const cashIn = source.payments.filter(item => item.direction === 'Incoming').reduce((sum, item) => sum + item.amount, 0);
    const cashOut = source.payments.filter(item => item.direction === 'Outgoing').reduce((sum, item) => sum + item.amount, 0);
    return {
      accounts: source.accounts.length,
      journals: source.journals.length,
      budgets: source.budgets.length,
      totalBudget: source.budgets.reduce((sum, item) => sum + item.amount, 0),
      receivables,
      payables,
      cashIn,
      cashOut,
      netCash: cashIn - cashOut
    };
  }

  function profitAndLoss() {
    const data = read();
    const income = data.payments.filter(item => item.direction === 'Incoming').reduce((sum, item) => sum + item.amount, 0);
    const expenses = data.payments.filter(item => item.direction === 'Outgoing').reduce((sum, item) => sum + item.amount, 0);
    return { income, expenses, netProfit: income - expenses };
  }

  window.AgriSmartFinance = Object.freeze({
    read,
    load: read,
    addAccount,
    postJournal,
    addBudget,
    createInvoice,
    createBill,
    recordPayment,
    ageReceivables,
    agePayables,
    dashboard,
    profitAndLoss
  });
})();