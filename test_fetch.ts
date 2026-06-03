import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

async function run() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  try {
    const start = Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    const duration = Date.now() - start;
    console.log(`Query completed in ${duration}ms`);
    if (error) {
      console.error('Supabase returned error:', error);
    } else {
      console.log('Query succeeded. Profiles retrieved:', data?.length);
      console.log('Sample profiles:', data);
    }
  } catch (e: any) {
    console.error('Caught error during fetch:', e);
  }
}

run();
