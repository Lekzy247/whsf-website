(() => {
  'use strict';

  const STORAGE_KEY = 'agrismart-farms-v1';
  const farmView = document.querySelector('[data-view-panel="farm"]');
  const originalForm = document.querySelector('#farm-form');
  const list = document.querySelector('[data-farm-list]');
  if (!farmView || !originalForm || !list) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>':