const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://jhngtyyqiqhgnuclduhc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTgyNCwiZXhwIjoyMDc2NzkxODI0fQ.TpahF4PHSo59oDOKmQ0ytwkkGOlUHI0NIFNTSd9c1Gg';

// Create Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    // Let's first check if the admin user already exists
    const { data: existingAdmin, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@wasalni.com')
      .single();

    if (existingAdmin) {
      console.log('Admin user already exists:');
      console.log('Email: admin@wasalni.com');
      console.log('You can log in to the admin dashboard with this email and your password.');
      return;
    }

    // If no admin user exists with this email, provide instructions
    console.log('To create an admin user:');
    console.log('1. Go to your Supabase dashboard at https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to "Authentication" → "Users"');
    console.log('4. Click "Add user"');
    console.log('5. Enter the following details:');
    console.log('   - Email: admin@wasalni.com');
    console.log('   - Password: Admin123!');
    console.log('6. Click "Add user"');
    console.log('7. After the user is created, go to "Table Editor"');
    console.log('8. Find the "profiles" table');
    console.log('9. Find the row with the new user ID');
    console.log('10. Edit the row and set "user_type" to "admin"');
    console.log('11. Save the changes');
    console.log('\nYou can then log in to the admin dashboard with:');
    console.log('Email: admin@wasalni.com');
    console.log('Password: Admin123!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();