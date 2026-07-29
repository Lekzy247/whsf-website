(() => {
  'use strict';

  const KEY = 'agrismart-hr-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const defaults = () => ({ employees: [], attendance: [], leaveRequests: [], payrollRuns: [], training: [] });

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
    window.dispatchEvent(new CustomEvent('agrismart:hrchange', { detail: summary(data) }));
    return data;
  }

  function amount(value) {
    const result = Number(value || 0);
    if (!Number.isFinite(result) || result < 0) throw new Error('Enter a valid non-negative amount.');
    return result;
  }

  function addEmployee(input) {
    const data = read();
    const employee = {
      id: uid('employee'),
      employeeNumber: String(input.employeeNumber || `EMP-${String(data.employees.length + 1).padStart(5, '0')}`),
      firstName: String(input.firstName || '').trim(),
      lastName: String(input.lastName || '').trim(),
      role: String(input.role || '').trim(),
      department: String(input.department || 'Farm Operations').trim(),
      employmentType: String(input.employmentType || 'Full-time'),
      phone: String(input.phone || '').trim(),
      email: String(input.email || '').trim(),
      location: String(input.location || '').trim(),
      startDate: String(input.startDate || new Date().toISOString().slice(0, 10)),
      basePay: amount(input.basePay),
      currency: String(input.currency || 'USD').toUpperCase(),
      status: String(input.status || 'Active'),
      createdAt: new Date().toISOString()
    };
    if (!employee.firstName || !employee.lastName || !employee.role) throw new Error('First name, last name, and role are required.');
    if (data.employees.some(item => item.employeeNumber === employee.employeeNumber)) throw new Error('Employee number already exists.');
    data.employees.push(employee);
    save(data);
    return employee;
  }

  function recordAttendance(input) {
    const data = read();
    const employee = data.employees.find(item => item.id === input.employeeId);
    if (!employee) throw new Error('Employee not found.');
    const record = {
      id: uid('attendance'),
      employeeId: employee.id,
      date: String(input.date || new Date().toISOString().slice(0, 10)),
      clockIn: String(input.clockIn || ''),
      clockOut: String(input.clockOut || ''),
      hours: amount(input.hours),
      assignment: String(input.assignment || '').trim(),
      status: String(input.status || 'Present'),
      createdAt: new Date().toISOString()
    };
    data.attendance.unshift(record);
    save(data);
    return record;
  }

  function requestLeave(input) {
    const data = read();
    if (!data.employees.some(item => item.id === input.employeeId)) throw new Error('Employee not found.');
    const request = {
      id: uid('leave'),
      employeeId: input.employeeId,
      type: String(input.type || 'Annual Leave'),
      startDate: String(input.startDate || ''),
      endDate: String(input.endDate || ''),
      reason: String(input.reason || '').trim(),
      status: 'Pending',
      requestedAt: new Date().toISOString()
    };
    if (!request.startDate || !request.endDate) throw new Error('Leave start and end dates are required.');
    data.leaveRequests.unshift(request);
    save(data);
    return request;
  }

  function updateLeaveStatus(id, status, approver = '') {
    const data = read();
    const request = data.leaveRequests.find(item => item.id === id);
    if (!request) throw new Error('Leave request not found.');
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) throw new Error('Invalid leave status.');
    request.status = status;
    request.approver = String(approver || '').trim();
    request.updatedAt = new Date().toISOString();
    save(data);
    return request;
  }

  function runPayroll(input = {}) {
    const data = read();
    const employees = data.employees.filter(item => item.status === 'Active');
    const deductions = amount(input.deductionRate || 0);
    const payroll = {
      id: uid('payroll'),
      number: `PAY-${String(data.payrollRuns.length + 1).padStart(5, '0')}`,
      period: String(input.period || new Date().toISOString().slice(0, 7)),
      currency: String(input.currency || employees[0]?.currency || 'USD').toUpperCase(),
      status: 'Processed',
      lines: employees.map(employee => {
        const gross = employee.basePay;
        const deductionAmount = gross * (deductions / 100);
        return { employeeId: employee.id, gross, deductions: deductionAmount, net: gross - deductionAmount };
      }),
      processedAt: new Date().toISOString()
    };
    payroll.grossTotal = payroll.lines.reduce((sum, line) => sum + line.gross, 0);
    payroll.deductionTotal = payroll.lines.reduce((sum, line) => sum + line.deductions, 0);
    payroll.netTotal = payroll.lines.reduce((sum, line) => sum + line.net, 0);
    data.payrollRuns.unshift(payroll);
    save(data);
    return payroll;
  }

  function addTraining(input) {
    const data = read();
    if (!data.employees.some(item => item.id === input.employeeId)) throw new Error('Employee not found.');
    const training = {
      id: uid('training'),
      employeeId: input.employeeId,
      title: String(input.title || '').trim(),
      provider: String(input.provider || '').trim(),
      completedDate: String(input.completedDate || ''),
      expiryDate: String(input.expiryDate || ''),
      certificateNumber: String(input.certificateNumber || '').trim(),
      status: String(input.status || 'Completed'),
      createdAt: new Date().toISOString()
    };
    if (!training.title) throw new Error('Training title is required.');
    data.training.unshift(training);
    save(data);
    return training;
  }

  function summary(source = read()) {
    return {
      totalEmployees: source.employees.length,
      activeEmployees: source.employees.filter(item => item.status === 'Active').length,
      pendingLeave: source.leaveRequests.filter(item => item.status === 'Pending').length,
      payrollRuns: source.payrollRuns.length,
      latestNetPayroll: source.payrollRuns[0]?.netTotal || 0,
      trainingRecords: source.training.length
    };
  }

  window.AgriSmartHR = Object.freeze({
    read,
    addEmployee,
    recordAttendance,
    requestLeave,
    updateLeaveStatus,
    runPayroll,
    addTraining,
    summary
  });
})();