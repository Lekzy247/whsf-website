(() => {
  'use strict';

  const STORE = 'agrismart-workflows-v1';
  const TYPES = Object.freeze({
    procurement: {
      label: 'Procurement to Finance',
      initial: 'draft',
      states: ['draft', 'submitted', 'approved', 'ordered', 'received', 'stocked', 'posted', 'completed', 'rejected', 'cancelled'],
      transitions: {
        draft: ['submitted', 'cancelled'],
        submitted: ['approved', 'rejected', 'cancelled'],
        approved: ['ordered', 'cancelled'],
        ordered: ['received', 'cancelled'],
        received: ['stocked'],
        stocked: ['posted'],
        posted: ['completed'],
        rejected: ['draft'],
        completed: [], cancelled: []
      }
    }
  });

  const read = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
  const write = value => localStorage.setItem(STORE, JSON.stringify(value));
  const makeId = prefix => `${prefix}-${crypto.randomUUID?.() || Date.now().toString(36)}`;
  const now = () => new Date().toISOString();

  function context() {
    const enterprise = window.AgriSmartEnterprise;
    return {
      organizationId: enterprise?.getSession?.()?.organizationId || 'org-whsf-demo',
      userId: enterprise?.getCurrentUser?.()?.id || 'user-demo-admin'
    };
  }

  function audit(action, workflow, details = {}) {
    window.AgriSmartEnterprise?.audit?.(action, 'workflow', workflow.id, {
      workflowType: workflow.type,
      reference: workflow.reference,
      state: workflow.state,
      ...details
    });
  }

  function list(type) {
    const { organizationId } = context();
    return read().filter(item => item.organizationId === organizationId && (!type || item.type === type));
  }

  function get(id) {
    return list().find(item => item.id === id) || null;
  }

  function create(type, input = {}) {
    const definition = TYPES[type];
    if (!definition) throw new Error(`Unknown workflow type: ${type}`);
    const { organizationId, userId } = context();
    const workflows = read();
    const workflow = {
      id: makeId('wf'),
      organizationId,
      type,
      reference: input.reference || `PR-${new Date().getFullYear()}-${String(workflows.length + 1).padStart(4, '0')}`,
      title: String(input.title || 'Untitled request').trim(),
      description: String(input.description || '').trim(),
      amount: Number(input.amount || 0),
      currency: input.currency || 'NGN',
      vendor: String(input.vendor || '').trim(),
      state: definition.initial,
      createdBy: userId,
      createdAt: now(),
      updatedAt: now(),
      history: [{ from: null, to: definition.initial, by: userId, at: now(), note: 'Workflow created' }],
      metadata: input.metadata || {}
    };
    workflows.push(workflow);
    write(workflows);
    audit('workflow.created', workflow);
    window.dispatchEvent(new CustomEvent('agrismart:workflowchange', { detail: workflow }));
    return workflow;
  }

  function allowedTransitions(workflowOrId) {
    const workflow = typeof workflowOrId === 'string' ? get(workflowOrId) : workflowOrId;
    if (!workflow) return [];
    return TYPES[workflow.type]?.transitions[workflow.state] || [];
  }

  function permissionFor(nextState) {
    if (nextState === 'submitted') return 'procurement.create';
    if (['approved', 'rejected'].includes(nextState)) return 'procurement.approve';
    if (nextState === 'ordered') return 'procurement.update';
    if (nextState === 'received') return 'warehouse.create';
    if (nextState === 'stocked') return 'inventory.update';
    if (nextState === 'posted') return 'finance.create';
    return null;
  }

  function transition(id, nextState, note = '') {
    const workflows = read();
    const index = workflows.findIndex(item => item.id === id && item.organizationId === context().organizationId);
    if (index < 0) throw new Error('Workflow not found.');
    const workflow = workflows[index];
    if (!allowedTransitions(workflow).includes(nextState)) throw new Error(`Cannot move from ${workflow.state} to ${nextState}.`);
    const permission = permissionFor(nextState);
    if (permission && window.AgriSmartEnterprise?.hasPermission && !window.AgriSmartEnterprise.hasPermission(permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
    const previous = workflow.state;
    workflow.state = nextState;
    workflow.updatedAt = now();
    workflow.history.push({ from: previous, to: nextState, by: context().userId, at: now(), note: String(note || '') });
    workflows[index] = workflow;
    write(workflows);
    audit('workflow.transitioned', workflow, { from: previous, to: nextState, note });
    window.dispatchEvent(new CustomEvent('agrismart:workflowchange', { detail: workflow }));
    return workflow;
  }

  function summary() {
    return list().reduce((result, workflow) => {
      result.total += 1;
      result.byState[workflow.state] = (result.byState[workflow.state] || 0) + 1;
      result.totalValue += Number(workflow.amount || 0);
      return result;
    }, { total: 0, totalValue: 0, byState: {} });
  }

  window.AgriSmartWorkflow = Object.freeze({ TYPES, list, get, create, transition, allowedTransitions, summary });
})();