import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://jhngtyyqiqhgnuclduhc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTU4MjQsImV4cCI6MjA3Njc5MTgyNH0.SPS1C2yTseDHUtPlS0IzNnx6Mxjt2OgcpkiaQPN6UbE';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impobmd0eXlxaXFoZ251Y2xkdWhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTIxNTgyNCwiZXhwIjoyMDc2NzkxODI0fQ.TpahF4PHSo59oDOKmQ0ytwkkGOlUHI0NIFNTSd9c1Gg';

// Create Supabase client with service key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdminUsers() {
  try {
    // Check if there are any admin users
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'admin');

    if (error) {
      console.error('Error fetching admin users:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Found admin users:');
      data.forEach(user => {
        console.log(`- ${user.full_name} (${user.email}) - ID: ${user.id}`);
      });
    } else {
      console.log('No admin users found. Creating one...');
      await createAdminUser();
    }
  } catch (error) {
    console.error('Error checking admin users:', error);
  }
}

async function createAdminUser() {
  try {
    // You'll need to create an admin user manually in Supabase
    // This is just to show you how to do it
    console.log('To create an admin user:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Go to the SQL editor');
    console.log('3. Run a query like this:');
    console.log(`
      INSERT INTO profiles (id, full_name, email, phone_number, user_type, is_active)
      VALUES ('your-user-id', 'Admin User', 'admin@example.com', '+1234567890', 'admin', true);
    `);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

checkAdminUsers();