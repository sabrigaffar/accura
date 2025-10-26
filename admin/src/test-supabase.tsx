import { supabase } from './lib/supabase';

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Check if we can connect to Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection error:', error);
      return;
    }

    console.log('Supabase connection successful!');
    console.log('Data:', data);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseConnection();