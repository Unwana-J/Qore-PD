
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
  console.log("Wiping projects table...");
  const { error: projectError } = await supabase
    .from('projects')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (projectError) console.error("Error wiping projects:", projectError);
  else console.log("Projects table wiped successfuly.");

  console.log("Auditing profiles...");
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email');
  
  if (profileError) console.error("Error fetching profiles:", profileError);
  else {
    console.log("Current profiles:", JSON.stringify(profiles, null, 2));
    const dummyNames = ['Sarah Jenkins', 'Michael Chen', 'John King', 'PM'];
    const toDelete = profiles.filter(p => dummyNames.includes(p.name || '') || (p.name === 'User' && p.email?.includes('dummy')));
    
    for (const p of toDelete) {
        console.log(`Deleting dummy profile: ${p.name} (${p.id})`);
        await supabase.from('profiles').delete().eq('id', p.id);
    }
  }
}

wipe();
