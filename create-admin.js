const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://jhngtyyqiqhgnuclduhc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTgyNCwiZXhwIjoyMDc2NzkxODI0fQ.TpahF4PHSo59oDOKmQ0ytwkkGOlUHI0NIFNTSd9c1Gg';

// Create Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    // First, let's check if there are any existing admin users
    const { data: existingAdmins, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'admin');

    if (fetchError) {
      console.error('Error fetching existing admins:', fetchError);
      return;
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('Existing admin users found:');
      existingAdmins.forEach(user => {
        console.log(`- ${user.full_name} (${user.email})`);
      });
      return;
    }

    // If no admin users exist, create one
    console.log('No admin users found. You need to create an admin user manually.');
    console.log('\nTo create an admin user:');
    console.log('1. Go to your Supabase dashboard at https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to the Table Editor');
    console.log('4. Find the "profiles" table');
    console.log('5. Click "Insert" to add a new row');
    console.log('6. Fill in the details:');
    console.log('   - id: (leave blank to auto-generate or use a UUID)');
    console.log('   - full_name: "Admin User"');
    console.log('   - email: "admin@example.com"');
    console.log('   - phone_number: "+1234567890"');
    console.log('   - user_type: "admin"');
    console.log('   - is_active: true');
    console.log('   - language: "ar"');
    console.log('7. Click "Save"');
    console.log('\nAfter creating the admin user, you can log in to the admin dashboard with the email and password you used to register.');

  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();