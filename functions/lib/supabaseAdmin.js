import { createClient } from '@supabase/supabase-js';

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getEnv(env, name) {
  if (env && env[name]) {
    return env[name];
  }
  if (typeof process !== 'undefined' && process?.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
}

export function createAdminClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
