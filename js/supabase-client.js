import { CONFIG } from './config.js';

let client = null;

export async function getSupabase(){
  if (CONFIG.DEMO_MODE || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return null;
  if (client) return client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'flowstock-wms-auth'
    }
  });
  return client;
}

export async function getSession(){
  const sb = await getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export async function signInWithPassword(email, password){
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase is not configured.');
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOut(){
  const sb = await getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function onAuthChange(callback){
  const sb = await getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function invoke(name, body = {}){
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'REQUEST_FAILED');
  return data;
}

export async function select(table, columns='*', configure){
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  let q = sb.from(table).select(columns);
  if (configure) q = configure(q);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
