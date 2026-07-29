(() => {
  'use strict';

  const KEYS = Object.freeze({
    events: 'agrismart-enterprise-events-v1',
    notifications: 'agrismart-enterprise-notifications-v1',
    preferences: 'agrismart-enterprise-notification-preferences-v1'
  });

  const PRIORITIES = Object.freeze(['low', 'normal', 'high', 'critical']);
  const CHANNELS = Object.freeze(['in_app', 'email', 'sms', 'whatsapp', 'push']);
  const subscribers = new Map();

  const now = () => new Date().toISOString();
  const makeId = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function context() {
    const enterprise = window.AgriSmartEnterprise;
    return {
      organizationId: enterprise?.getSession?.()?.organizationId || 'org-whsf-demo',
      userId: enterprise?.getCurrentUser?.()?.id || 'user-demo-admin'
    };
  }

  function scoped(items) {
    const { organizationId } = context();
    return items.filter(item => item.organizationId === organizationId);
  }

  function audit(action, entityType, entityId, detail = {}) {
    window.AgriSmartEnterprise?.audit?.(action, entityType, entityId, detail);
  }

  function subscribe(type, handler) {
    if (typeof handler !== 'function') throw new Error('Event handler must be a function.');
    const handlers = subscribers.get(type) || new Set();
    handlers.add(handler);
    subscribers.set(type, handlers);
    return () => unsubscribe(type, handler);
  }

  function unsubscribe(type, handler) {
    subscribers.get(type)?.delete(handler);
  }

  function publish(type, payload = {}, options = {}) {
    if (!type || typeof type !== 'string') throw new Error('Event type is required.');
    const { organizationId, userId } = context();
    const event = {
      id: makeId('evt'),
      type: type.trim(),
      organizationId,
      actorId: options.actorId || userId,
      entityType: options.entityType || null,
      entityId: options.entityId || null,
      correlationId: options.correlationId || null,
      payload,
      createdAt: now()
    };

    const events = read(KEYS.events, []);
    events.unshift(event);
    write(KEYS.events, events.slice(0, 2000));

    const handlers = [
      ...(subscribers.get(type) || []),
      ...(subscribers.get('*') || [])
    ];

    handlers.forEach(handler => {
      try { handler(event); }
      catch (error) { console.error(`AgriSmart event handler failed for ${type}`, error); }
    });

    window.dispatchEvent(new CustomEvent('agrismart:event', { detail: event }));
    audit('event.published', 'event', event.id, { type, entityType: event.entityType, entityId: event.entityId });
    return event;
  }

  function listEvents(filters = {}) {
    return scoped(read(KEYS.events, [])).filter(event =>
      (!filters.type || event.type === filters.type) &&
      (!filters.entityType || event.entityType === filters.entityType) &&
      (!filters.entityId || event.entityId === filters.entityId)
    );
  }

  function getPreferences(userId = context().userId) {
    const preferences = read(KEYS.preferences, {});
    return preferences[userId] || {
      channels: { in_app: true, email: true, sms: false, whatsapp: false, push: false },
      mutedTypes: []
    };
  }

  function setPreferences(input, userId = context().userId) {
    const preferences = read(KEYS.preferences, {});
    const current = getPreferences(userId);
    const channels = { ...current.channels, ...(input.channels || {}) };
    Object.keys(channels).forEach(channel => {
      if (!CHANNELS.includes(channel)) delete channels[channel];
      else channels[channel] = Boolean(channels[channel]);
    });
    preferences[userId] = {
      channels,
      mutedTypes: Array.isArray(input.mutedTypes) ? [...new Set(input.mutedTypes.map(String))] : current.mutedTypes
    };
    write(KEYS.preferences, preferences);
    audit('notification.preferences_updated', 'user', userId, preferences[userId]);
    return preferences[userId];
  }

  function notify(input = {}) {
    const { organizationId, userId } = context();
    const recipientId = input.recipientId || userId;
    const preferences = getPreferences(recipientId);
    const type = String(input.type || 'general');
    if (preferences.mutedTypes.includes(type)) return null;

    const priority = PRIORITIES.includes(input.priority) ? input.priority : 'normal';
    const channels = (input.channels || ['in_app']).filter(channel => CHANNELS.includes(channel) && preferences.channels[channel] !== false);
    if (!channels.length) return null;

    const notification = {
      id: makeId('ntf'),
      organizationId,
      recipientId,
      type,
      title: String(input.title || 'AgriSmart notification').trim(),
      message: String(input.message || '').trim(),
      priority,
      channels,
      link: input.link || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      readAt: null,
      createdAt: now()
    };

    const notifications = read(KEYS.notifications, []);
    notifications.unshift(notification);
    write(KEYS.notifications, notifications.slice(0, 2000));
    window.dispatchEvent(new CustomEvent('agrismart:notification', { detail: notification }));
    audit('notification.created', 'notification', notification.id, { recipientId, type, priority, channels });
    return notification;
  }

  function listNotifications(filters = {}) {
    const { userId } = context();
    return scoped(read(KEYS.notifications, [])).filter(notification =>
      notification.recipientId === (filters.recipientId || userId) &&
      (filters.unreadOnly ? !notification.readAt : true) &&
      (!filters.type || notification.type === filters.type)
    );
  }

  function markRead(id) {
    const notifications = read(KEYS.notifications, []);
    const index = notifications.findIndex(item => item.id === id && item.organizationId === context().organizationId);
    if (index < 0) throw new Error('Notification not found.');
    notifications[index].readAt = notifications[index].readAt || now();
    write(KEYS.notifications, notifications);
    window.dispatchEvent(new CustomEvent('agrismart:notificationchange', { detail: notifications[index] }));
    return notifications[index];
  }

  function markAllRead() {
    const notifications = read(KEYS.notifications, []);
    const { organizationId, userId } = context();
    const timestamp = now();
    notifications.forEach(item => {
      if (item.organizationId === organizationId && item.recipientId === userId && !item.readAt) item.readAt = timestamp;
    });
    write(KEYS.notifications, notifications);
    window.dispatchEvent(new CustomEvent('agrismart:notificationchange'));
    return listNotifications();
  }

  function unreadCount() {
    return listNotifications({ unreadOnly: true }).length;
  }

  function notifyWorkflow(event) {
    const workflow = event.payload?.workflow;
    if (!workflow) return;
    const labels = {
      submitted: 'Purchase request submitted', approved: 'Purchase request approved', rejected: 'Purchase request rejected',
      ordered: 'Purchase order created', received: 'Goods received', stocked: 'Inventory stocked',
      posted: 'Financial posting completed', completed: 'Workflow completed', cancelled: 'Workflow cancelled'
    };
    const state = workflow.state;
    notify({
      type: `workflow.${state}`,
      title: labels[state] || 'Workflow updated',
      message: `${workflow.reference}: ${workflow.title}`,
      priority: ['rejected', 'cancelled'].includes(state) ? 'high' : 'normal',
      entityType: 'workflow',
      entityId: workflow.id,
      channels: ['in_app']
    });
  }

  subscribe('workflow.created', event => notify({
    type: 'workflow.created',
    title: 'New workflow created',
    message: `${event.payload.workflow.reference}: ${event.payload.workflow.title}`,
    entityType: 'workflow',
    entityId: event.payload.workflow.id
  }));
  subscribe('workflow.transitioned', notifyWorkflow);

  window.AgriSmartEvents = Object.freeze({ publish, subscribe, unsubscribe, list: listEvents });
  window.AgriSmartNotifications = Object.freeze({
    PRIORITIES, CHANNELS, notify, list: listNotifications, markRead, markAllRead, unreadCount,
    getPreferences, setPreferences
  });
})();