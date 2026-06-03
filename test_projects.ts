import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

async function run() {
  console.log('Testing projects query...');
  try {
    const { data, error, count } = await supabase
      .from('projects')
      .select('id, client_name, service_states')
      .limit(10);
    
    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      console.log('Successfully fetched projects. Count:', data?.length);
      console.log('First project service states:', JSON.stringify(data?.[0], null, 2));
      console.log('All fetched projects service states:');
      data?.forEach(p => {
        console.log(`${p.client_name}:`, p.service_states);
      });
    }
  } catch (e: any) {
    console.error('Caught exception:', e);
  }
}

run();
