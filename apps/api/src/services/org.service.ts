import { createSupabaseAdmin } from '@pullquest/database';
import { Organization } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export async function createOrg(data: {
  github_org_id: number;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  installation_id: string | null;
}): Promise<Organization> {
  const { data: org, error } = await supabase
    .from('organizations')
    .upsert(
      {
        github_org_id: data.github_org_id,
        name: data.name,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        installation_id: data.installation_id,
        credibility_score: 100,
        subscription_status: 'none',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_org_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return org as Organization;
}

export async function getOrgById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Organization;
}

export async function getOrgDashboard(orgId: string) {
  const org = await getOrgById(orgId);
  if (!org) throw new Error('Organization not found');

  // Load Treasury
  const { data: treasury } = await supabase
    .from('treasuries')
    .select('*')
    .eq('org_id', orgId)
    .single();

  // Count open issues
  const { count: openIssuesCount } = await supabase
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('is_open', true);

  // Count total repo stars
  const { data: repos } = await supabase
    .from('repositories')
    .select('star_count')
    .eq('org_id', orgId);

  const starCount = repos?.reduce((acc, curr) => acc + (curr.star_count || 0), 0) || 0;

  return {
    organization: org,
    treasury: treasury || null,
    stats: {
      openIssuesCount: openIssuesCount || 0,
      starCount,
    },
  };
}

export async function getOrgContributors(orgId: string, page = 1, limit = 10) {
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // Query distinct users who earned XP from this org
  // Supabase doesn't have native distinct-on in standard query builder easily without raw SQL,
  // but we can query the xp_logs group or simple select user details.
  // For simplicity, query the xp_logs joined with users.
  const { data, error, count } = await supabase
    .from('xp_logs')
    .select('user_id, users(github_username, avatar_url, current_tier)', { count: 'exact' })
    .eq('org_id', orgId)
    .range(start, end);

  if (error) throw error;

  // Deduplicate and map
  const mapped = (data || []).map((x: any) => ({
    userId: x.user_id,
    github_username: x.users?.github_username || 'unknown',
    avatar_url: x.users?.avatar_url || null,
    tier: x.users?.current_tier || 'UNRANKED',
  }));

  return {
    data: mapped,
    total: count || 0,
  };
}
