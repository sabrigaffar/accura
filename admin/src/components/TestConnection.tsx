import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TestConnection: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test Supabase connection
        const { data, error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (error) {
          setConnectionStatus('Failed');
          setError(`Supabase Error: ${error.message}`);
        } else {
          setConnectionStatus('Connected');
          setError(null);
        }
      } catch (err: any) {
        setConnectionStatus('Failed');
        setError(`Connection Error: ${err.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Connection Test</h2>
      <div className="space-y-2">
        <p><strong>Status:</strong> {connectionStatus}</p>
        {error && <p className="text-red-500"><strong>Error:</strong> {error}</p>}
        <p><strong>Supabase URL:</strong> {(import.meta as any).env.VITE_SUPABASE_URL || 'Not set'}</p>
      </div>
    </div>
  );
};

export default TestConnection;