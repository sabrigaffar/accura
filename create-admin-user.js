const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://jhngtyyqiqhgnuclduhc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTgyNCwiZXhwIjoyMDc2NzkxODI0fQ.TpahF4PHSo59oDOKmQ0ytwkkGOlUHI0NIFNTSd9c1Gg';

// Create Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    // First, let's create a new user with email and password
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'admin@wasalni.com',
      password: 'Admin123!',
      options: {
        data: {
          full_name: 'Admin User',
          phone_number: '+966500000000',
          user_type: 'admin',
          is_active: true,
          language: 'ar'
        }
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Auth user created successfully:', authData.user.id);
    
    // Now let's update the profile to ensure it's an admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: 'Admin User',
        email: 'admin@wasalni.com',
        phone_number: '+966500000000',
        user_type: 'admin',
        is_active: true,
        language: 'ar'
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return;
    }

    console.log('Admin user created successfully!');
    console.log('Email: admin@wasalni.com');
    console.log('Password: Admin123!');
    console.log('You can now log in to the admin dashboard with these credentials.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();