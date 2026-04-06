import { supabase } from '@/lib/supabase/client';

export async function getUsers() {
  const data = await supabase
    .from('users')
    .select('*');
  return data;
}
