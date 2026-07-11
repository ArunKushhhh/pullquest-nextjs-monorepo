import { createSupabaseAdmin } from '@pullquest/database';
import { User, CoinTransactionType } from '@pullquest/shared';
import { creditCoins } from './coin.service.js';

const supabase = createSupabaseAdmin();

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as User;
}

export async function getUserByGithubId(githubId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('github_id', githubId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as User;
}

export async function getOrCreateUser(
  userId: string,
  githubId: number,
  githubUsername: string,
  email: string | null,
  avatarUrl: string | null
): Promise<User> {
  // Check if exists by primary key first
  const existing = await getUserById(userId);
  if (existing) {
    const { data: updated, error } = await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        github_username: githubUsername,
        email,
        avatar_url: avatarUrl,
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return updated as User;
  }

  // Create new user (matching Supabase Auth ID)
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      id: userId, // CRITICAL: Map primary key to Supabase Auth ID
      github_id: githubId,
      github_username: githubUsername,
      email,
      avatar_url: avatarUrl,
      role: 'CONTRIBUTOR',
      global_xp: 0,
      current_tier: 'INITIATOR',
      earned_coins: 0,
      purchased_coins: 0,
      locked_coins: 0,
      last_login_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  // Credit signup bonus
  const userWithCoins = await creditCoins(
    newUser.id,
    150,
    CoinTransactionType.SIGNUP_BONUS,
    null,
    'Signup bonus reward'
  );

  return userWithCoins;
}
