import { createSupabaseAdmin } from '@pullquest/database';
import {
  Act,
  ActCurrentView,
  ACT_DURATION_DAYS,
  actDaysRemaining,
} from '@pullquest/shared';
import { actManagementQueue } from '../config/queues.js';

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

export function toActCurrentView(act: Act): ActCurrentView {
  return {
    ...act,
    days_remaining: actDaysRemaining(act.end_date),
    duration_days: ACT_DURATION_DAYS,
  };
}

export async function createNewAct(actNumber: number): Promise<Act> {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + ACT_DURATION_DAYS);

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

export async function enqueueActReset(force: boolean): Promise<string | undefined> {
  const job = await actManagementQueue.add(
    'act-reset',
    { force },
    { removeOnComplete: 20, removeOnFail: 50 }
  );
  return job.id;
}
