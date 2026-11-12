import { createClient } from '@supabase/supabase-js';

class UnsupportedRealtimeWebSocket {
  constructor() {
    throw new Error('Realtime WebSocket is not supported in stateless serverless functions.');
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getEnv(name) {
  if (typeof Netlify !== 'undefined' && Netlify?.env?.get) {
    return Netlify.env.get(name);
  }
  return process.env[name];
}

export function createAdminClient(supabaseUrl, serviceRoleKey) {
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
  };

  // Fallback for Node 20 runtimes lacking global WebSocket so @supabase/realtime-js does not throw on createClient()
  if (typeof globalThis.WebSocket === 'undefined') {
    options.realtime = { transport: UnsupportedRealtimeWebSocket };
  }

  return createClient(supabaseUrl, serviceRoleKey, options);
}
