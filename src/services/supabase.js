import { createClient } from '@supabase/supabase-js';

// Proxy through Vite (dev) or Netlify /supabase-api rewrite (prod) to prevent adblocker/ISP blocks
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const useProxy = isLocalhost || import.meta.env.VITE_SUPABASE_PROXY === 'true';

const supabaseUrl = (useProxy && typeof window !== 'undefined')
  ? `${window.location.origin}/supabase-api`
  : (import.meta.env.VITE_SUPABASE_URL || 'https://zgudwlzlmroxkrkbmqxl.supabase.co');

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ZekvW0ted5X4KlMxACZl6w_UTxS831-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
