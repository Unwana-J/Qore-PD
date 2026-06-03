import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

async function run() {
  console.log('Testing service_extensions query...');
  try {
    const { data, error, count } = await supabase
      .from('service_extensions')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.error('Error fetching service_extensions:', error);
    } else {
      console.log('Successfully fetched service_extensions. Count:', count || data?.length);
      console.log('Sample row:', data?.[0]);
    }
  } catch (e: any) {
    console.error('Caught exception:', e);
  }
}

run();
