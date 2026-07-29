(() => {
  'use strict';

  const KEY = 'agrismart-crm-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const initial = () => ({ contacts: [], opportunities: [], activities: [], tasks: [] });
  const read = () => {
    try { return { ...initial(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return initial(); }
  };
  const save = data => {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:crmchange'));
    return data;
  };

  function addContact(input) {
    const data = read();
    const contact = {
      id: uid('contact'),
      type: String(input.type || 'Customer'),
      name: String(input.name || '').trim(),
      organization: String(input.organization || '').trim(),
      phone: String(input.phone || '').trim(),
      email: String(input.email || '').trim(),
      location: String(input.location || '').trim(),
      segment: String(input.segment || 'General'),
      status: String(input.status || 'Active'),
      notes: String(input.notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    if (!contact.name) throw new Error('Contact name is required.');
    data.contacts.unshift(contact);
    save(data);
    return contact;
  }

  function addOpportunity(input) {
    const data = read();
    if (!data.contacts.some(item => item.id === input.contactId)) throw new Error('Select a valid contact.');
    const opportunity = {
      id: uid('opportunity'),
      contactId: input.contactId,
      title: String(input.title || '').trim(),
      value: Number(input.value || 0),
      currency: String(input.currency || 'USD'),
      stage: String(input.stage || 'Lead'),
      probability: Number(input.probability || 10),
      expectedCloseDate: String(input.expectedCloseDate || ''),
      source: String(input.source || '').trim(),
      createdAt: new Date().toISOString()
    };
    if (!opportunity.title) throw new Error('Opportunity title is required.');
    data.opportunities.unshift(opportunity);
    save(data);
    return opportunity;
  }

  function logActivity(input) {
    const data = read();
    if (!data.contacts.some(item => item.id === input.contactId)) throw new Error('Select a valid contact.');
    const activity = {
      id: uid('activity'),
      contactId: input.contactId,
      type: String(input.type || 'Note'),
      subject: String(input.subject || '').trim(),
      details: String(input.details || '').trim(),
      occurredAt: String(input.occurredAt || new Date().toISOString()),
      createdAt: new Date().toISOString()
    };
    if (!activity.subject) throw new Error('Activity subject is required.');
    data.activities.unshift(activity);
    save(data);
    return activity;
  }

  function addTask(input) {
    const data = read();
    const task = {
      id: uid('task'),
      contactId: String(input.contactId || ''),
      title: String(input.title || '').trim(),
      dueDate: String(input.dueDate || ''),
      priority: String(input.priority || 'Medium'),
      owner: String(input.owner || '').trim(),
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    if (!task.title) throw new Error('Task title is required.');
    data.tasks.unshift(task);
    save(data);
    return task;
  }

  function updateOpportunityStage(id, stage) {
    const data = read();
    const opportunity = data.opportunities.find(item => item.id === id);
    if (!opportunity) throw new Error('Opportunity not found.');
    opportunity.stage = stage;
    opportunity.updatedAt = new Date().toISOString();
    save(data);
    return opportunity;
  }

  function completeTask(id) {
    const data = read();
    const task = data.tasks.find(item => item.id === id);
    if (!task) throw new Error('Task not found.');
    task.status = 'Completed';
    task.completedAt = new Date().toISOString();
    save(data);
    return task;
  }

  function summary() {
    const data = read();
    const pipelineValue = data.opportunities
      .filter(item => !['Won', 'Lost'].includes(item.stage))
      .reduce((sum, item) => sum + Number(item.value || 0), 0);
    return {
      totalContacts: data.contacts.length,
      activeContacts: data.contacts.filter(item => item.status === 'Active').length,
      openOpportunities: data.opportunities.filter(item => !['Won', 'Lost'].includes(item.stage)).length,
      pipelineValue,
      openTasks: data.tasks.filter(item => item.status === 'Open').length
    };
  }

  window.AgriSmartCRM = Object.freeze({
    read,
    addContact,
    addOpportunity,
    logActivity,
    addTask,
    updateOpportunityStage,
    completeTask,
    summary
  });
})();