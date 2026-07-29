(() => {
  'use strict';

  const STORE = 'agrismart-enterprise-tasks-v1';
  const STATUSES = Object.freeze(['open', 'in_progress', 'completed', 'cancelled']);
  const PRIORITIES = Object.freeze(['low', 'normal', 'high', 'critical']);

  const now = () => new Date().toISOString();
  const makeId = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
  const write = value => localStorage.setItem(STORE, JSON.stringify(value));

  function context() {
    const enterprise = window.AgriSmartEnterprise;
    return {
      organizationId: enterprise?.getSession?.()?.organizationId || 'org-whsf-demo',
      userId: enterprise?.getCurrentUser?.()?.id || 'user-demo-admin'
    };
  }

  function audit(action, task, detail = {}) {
    window.AgriSmartEnterprise?.audit?.(action, 'task', task.id, {
      title: task.title,
      status: task.status,
      assigneeId: task.assigneeId,
      ...detail
    });
  }

  function emit(type, task, payload = {}) {
    window.AgriSmartEvents?.publish?.(type, { task, ...payload }, {
      entityType: 'task', entityId: task.id
    });
    window.dispatchEvent(new CustomEvent('agrismart:taskchange', { detail: task }));
  }

  function list(filters = {}) {
    const { organizationId, userId } = context();
    return read().filter(task =>
      task.organizationId === organizationId &&
      (!filters.status || task.status === filters.status) &&
      (!filters.type || task.type === filters.type) &&
      (!filters.assigneeId || task.assigneeId === filters.assigneeId) &&
      (!filters.mine || task.assigneeId === userId)
    );
  }

  function get(id) {
    return list().find(task => task.id === id) || null;
  }

  function create(input = {}) {
    const { organizationId, userId } = context();
    const task = {
      id: makeId('task'),
      organizationId,
      type: String(input.type || 'general'),
      title: String(input.title || '').trim(),
      description: String(input.description || '').trim(),
      status: 'open',
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'normal',
      assigneeId: input.assigneeId || userId,
      createdBy: userId,
      dueAt: input.dueAt || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      workflowId: input.workflowId || null,
      approvalAction: input.approvalAction || null,
      metadata: input.metadata || {},
      createdAt: now(),
      updatedAt: now(),
      completedAt: null
    };
    if (!task.title) throw new Error('Task title is required.');
    const tasks = read();
    tasks.unshift(task);
    write(tasks);
    audit('task.created', task);
    emit('task.created', task);
    window.AgriSmartNotifications?.notify?.({
      recipientId: task.assigneeId,
      type: 'task.assigned',
      title: 'New task assigned',
      message: task.title,
      priority: task.priority,
      entityType: 'task',
      entityId: task.id
    });
    return task;
  }

  function updateStatus(id, status, note = '') {
    if (!STATUSES.includes(status)) throw new Error('Invalid task status.');
    const tasks = read();
    const index = tasks.findIndex(task => task.id === id && task.organizationId === context().organizationId);
    if (index < 0) throw new Error('Task not found.');
    const task = tasks[index];
    const previous = task.status;
    task.status = status;
    task.updatedAt = now();
    task.completedAt = status === 'completed' ? now() : null;
    task.metadata = { ...task.metadata, lastNote: String(note || '') };
    tasks[index] = task;
    write(tasks);
    audit('task.status_changed', task, { from: previous, to: status, note });
    emit('task.status_changed', task, { from: previous, to: status, note });
    return task;
  }

  function reassign(id, assigneeId) {
    if (!assigneeId) throw new Error('Assignee is required.');
    const tasks = read();
    const index = tasks.findIndex(task => task.id === id && task.organizationId === context().organizationId);
    if (index < 0) throw new Error('Task not found.');
    const task = tasks[index];
    const previous = task.assigneeId;
    task.assigneeId = assigneeId;
    task.updatedAt = now();
    tasks[index] = task;
    write(tasks);
    audit('task.reassigned', task, { from: previous, to: assigneeId });
    emit('task.reassigned', task, { from: previous, to: assigneeId });
    window.AgriSmartNotifications?.notify?.({
      recipientId: assigneeId,
      type: 'task.assigned',
      title: 'Task reassigned to you',
      message: task.title,
      priority: task.priority,
      entityType: 'task',
      entityId: task.id
    });
    return task;
  }

  function approveTask(id, decision, note = '') {
    const task = get(id);
    if (!task) throw new Error('Task not found.');
    if (task.type !== 'approval') throw new Error('This task is not an approval task.');
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Decision must be approved or rejected.');
    if (task.workflowId && task.approvalAction) {
      const nextState = decision === 'approved' ? task.approvalAction : 'rejected';
      window.AgriSmartWorkflow?.transition?.(task.workflowId, nextState, note);
    }
    const updated = updateStatus(id, 'completed', note);
    emit(`approval.${decision}`, updated, { decision, note });
    return updated;
  }

  function createWorkflowApproval(workflow) {
    if (!workflow || workflow.state !== 'submitted') return null;
    const existing = list({ type: 'approval' }).find(task => task.workflowId === workflow.id && task.status !== 'cancelled');
    if (existing) return existing;
    const approver = window.AgriSmartEnterprise?.getUsers?.().find(user =>
      user.organizationId === workflow.organizationId &&
      ['organization_admin', 'procurement_officer'].includes(user.role) &&
      user.status === 'active'
    );
    return create({
      type: 'approval',
      title: `Approve ${workflow.reference}`,
      description: workflow.title,
      assigneeId: approver?.id || context().userId,
      priority: Number(workflow.amount || 0) >= 1000000 ? 'high' : 'normal',
      entityType: 'workflow',
      entityId: workflow.id,
      workflowId: workflow.id,
      approvalAction: 'approved',
      metadata: { amount: workflow.amount, currency: workflow.currency }
    });
  }

  window.AgriSmartEvents?.subscribe?.('workflow.transitioned', event => {
    const workflow = event.payload?.workflow;
    if (workflow?.state === 'submitted') createWorkflowApproval(workflow);
  });

  window.AgriSmartTasks = Object.freeze({
    STATUSES, PRIORITIES, list, get, create, updateStatus, reassign, approveTask, createWorkflowApproval
  });
})();