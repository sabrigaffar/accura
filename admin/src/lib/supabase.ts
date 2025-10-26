import { createClient } from '@supabase/supabase-js';

// Supabase configuration - using the same project as the main app
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For administrative operations that need to bypass RLS
// This should be used carefully and only in secure environments
export const createAdminClient = () => {
  const supabaseServiceKey = (import.meta as any).env.VITE_SUPABASE_SERVICE_KEY;
  if (supabaseServiceKey) {
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
};

// Check Supabase configuration
if (!supabaseUrl) {
  console.warn('Warning: VITE_SUPABASE_URL is not configured');
}

if (!supabaseAnonKey) {
  console.warn('Warning: VITE_SUPABASE_ANON_KEY is not configured');
}