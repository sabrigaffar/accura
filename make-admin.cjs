const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://jhngtyyqiqhgnuclduhc.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTgyNCwiZXhwIjoyMDc2NzkxODI0fQ.TpahF4PHSo59oDOKmQ0ytwkkGOlUHI0NIFNTSd9c1Gg';

// Create Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function makeUserAdmin() {
  try {
    console.log('Converting user to admin...');
    
    // Update the first user (sabri) to be an admin
    const { data, error } = await supabase
      .from('profiles')
      .update({ user_type: 'admin' })
      .eq('full_name', 'sabri')
      .select();

    if (error) {
      console.error('Error updating user:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Successfully updated user to admin:');
      console.log(`- ${data[0].full_name} (${data[0].email}) is now an admin`);
    } else {
      console.log('No user found with the name "sabri"');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

makeUserAdmin();