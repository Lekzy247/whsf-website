(() => {
  'use strict';

  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const SESSION_KEY = 'agrismart-cloud-auth-session-v2';

  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  function readSession() {
    try {