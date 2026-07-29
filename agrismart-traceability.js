(() => {
  'use strict';

  const KEY = 'agrismart-traceability-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const empty = () => ({ lots: [], events: [], inspections: [], certificates: [], recalls: [] });

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...empty(), ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
      return empty();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:traceabilitychange', { detail: summary(data) }));
    return data;
  }

  function addLot(input) {
    const data = read();
    const lot = {
      id: uid('lot'),
      lotNumber: String(input.lotNumber || `LOT-${String(data.lots.length + 1).padStart(6, '0')}`),
      product: String(input.product || '').trim(),
      crop: String(input.crop || '').trim(),
      fieldId: String(input.fieldId || ''),
      harvestDate: String(input.harvestDate || ''),
      quantity: Math.max(0, Number(input.quantity || 0)),
      unit: String(input.unit || 'kg'),
      grade: String(input.grade || '').trim(),
      status: String(input.status || 'Available'),
      parentLotIds: Array.isArray(input.parentLotIds) ? input.parentLotIds : [],
      createdAt: new Date().toISOString()
    };
    if (!lot.product) throw new Error('Product is required.');
    if (data.lots.some(item => item.lotNumber === lot.lotNumber)) throw new Error('Lot number already exists.');
    data.lots.push(lot);
    save(data);
    return lot;
  }

  function recordEvent(input) {
    const data = read();
    if (!data.lots.some(item => item.id === input.lotId)) throw new Error('Lot not found.');
    const event = {
      id: uid('event'),
      lotId: input.lotId,
      type: String(input.type || 'Handling'),
      location: String(input.location || '').trim(),
      actor: String(input.actor || '').trim(),
      reference: String(input.reference || '').trim(),
      notes: String(input.notes || '').trim(),
      occurredAt: String(input.occurredAt || new Date().toISOString()),
      createdAt: new Date().toISOString()
    };
    data.events.unshift(event);
    save(data);
    return event;
  }

  function addInspection(input) {
    const data = read();
    const inspection = {
      id: uid('inspection'),
      lotId: String(input.lotId || ''),
      standard: String(input.standard || 'HACCP'),
      inspector: String(input.inspector || '').trim(),
      inspectionDate: String(input.inspectionDate || new Date().toISOString().slice(0, 10)),
      score: Math.min(100, Math.max(0, Number(input.score || 0))),
      result: String(input.result || 'Pending'),
      findings: String(input.findings || '').trim(),
      correctiveAction: String(input.correctiveAction || '').trim(),
      dueDate: String(input.dueDate || ''),
      status: String(input.status || 'Open'),
      createdAt: new Date().toISOString()
    };
    data.inspections.unshift(inspection);
    save(data);
    return inspection;
  }

  function addCertificate(input) {
    const data = read();
    const certificate = {
      id: uid('certificate'),
      name: String(input.name || '').trim(),
      standard: String(input.standard || '').trim(),
      certificateNumber: String(input.certificateNumber || '').trim(),
      issuingBody: String(input.issuingBody || '').trim(),
      issueDate: String(input.issueDate || ''),
      expiryDate: String(input.expiryDate || ''),
      scope: String(input.scope || '').trim(),
      status: String(input.status || 'Active'),
      createdAt: new Date().toISOString()
    };
    if (!certificate.name) throw new Error('Certificate name is required.');
    data.certificates.unshift(certificate);
    save(data);
    return certificate;
  }

  function initiateRecall(input) {
    const data = read();
    const lotIds = Array.isArray(input.lotIds) ? input.lotIds : [];
    if (!lotIds.length) throw new Error('At least one lot is required.');
    const recall = {
      id: uid('recall'),
      recallNumber: `RCL-${String(data.recalls.length + 1).padStart(5, '0')}`,
      lotIds,
      reason: String(input.reason || '').trim(),
      severity: String(input.severity || 'Medium'),
      authority: String(input.authority || '').trim(),
      owner: String(input.owner || '').trim(),
      status: 'Open',
      initiatedAt: new Date().toISOString()
    };
    lotIds.forEach(id => {
      const lot = data.lots.find(item => item.id === id);
      if (lot) lot.status = 'Recalled';
    });
    data.recalls.unshift(recall);
    save(data);
    return recall;
  }

  function closeRecall(id, notes = '') {
    const data = read();
    const recall = data.recalls.find(item => item.id === id);
    if (!recall) throw new Error('Recall not found.');
    recall.status = 'Closed';
    recall.closureNotes = String(notes || '').trim();
    recall.closedAt = new Date().toISOString();
    save(data);
    return recall;
  }

  function traceLot(lotId) {
    const data = read();
    const lot = data.lots.find(item => item.id === lotId);
    if (!lot) throw new Error('Lot not found.');
    return {
      lot,
      parents: data.lots.filter(item => lot.parentLotIds.includes(item.id)),
      children: data.lots.filter(item => item.parentLotIds.includes(lotId)),
      events: data.events.filter(item => item.lotId === lotId).sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt)),
      inspections: data.inspections.filter(item => item.lotId === lotId),
      recalls: data.recalls.filter(item => item.lotIds.includes(lotId))
    };
  }

  function verificationCode(lotId) {
    const lot = read().lots.find(item => item.id === lotId);
    if (!lot) throw new Error('Lot not found.');
    return `${location.origin}/trace/${encodeURIComponent(lot.lotNumber)}`;
  }

  function summary(source = read()) {
    const today = new Date();
    return {
      lots: source.lots.length,
      availableLots: source.lots.filter(item => item.status === 'Available').length,
      traceEvents: source.events.length,
      openInspections: source.inspections.filter(item => item.status !== 'Closed').length,
      activeCertificates: source.certificates.filter(item => item.status === 'Active' && (!item.expiryDate || new Date(item.expiryDate) >= today)).length,
      expiringCertificates: source.certificates.filter(item => item.expiryDate && new Date(item.expiryDate) >= today && new Date(item.expiryDate) - today <= 7776000000).length,
      openRecalls: source.recalls.filter(item => item.status === 'Open').length
    };
  }

  window.AgriSmartTraceability = Object.freeze({
    read,
    addLot,
    recordEvent,
    addInspection,
    addCertificate,
    initiateRecall,
    closeRecall,
    traceLot,
    verificationCode,
    summary
  });
})();