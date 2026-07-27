import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) {
    window.location.replace('/agrilearn/login.html');
    return null;
  }
  return user;
}

export async function signOutUser() {
  await supabase.auth.signOut();
  window.location.replace('/agrilearn/login.html');
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
