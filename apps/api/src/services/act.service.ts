import { createSupabaseAdmin } from '@pullquest/database';
import { Act } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export async function getCurrentAct(): Promise<Act | null> {
  const { data, error } = await supabase
    .from('acts')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0] as Act;
}

export async function createNewAct(actNumber: number): Promise<Act> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 45); // 45 days duration

  const { data, error } = await supabase
    .from('acts')
    .insert({
      act_number: actNumber,
      status: 'ACTIVE',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Act;
}

/** XP logs require an Act FK. Boot Act 1 if none is running. */
export async function ensureActiveAct(): Promise<Act> {
  const current = await getCurrentAct();
  if (current) return current;

  const { data: latest, error } = await supabase
    .from('acts')
    .select('act_number')
    .order('act_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const nextNumber = latest ? latest.act_number + 1 : 1;
  return createNewAct(nextNumber);
}
