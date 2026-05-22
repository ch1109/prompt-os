import { supabase } from "@/services/supabase";

function client() {
  if (!supabase) throw new Error("Supabase 未配置");
  return supabase;
}

export interface RedemptionRecord {
  id: number;
  code: string;
  template_id: string;
  template_version: number;
  redeemed_at: string;
  fingerprint: string | null;
  user_agent: string | null;
}

export async function listRedemptions(
  templateId?: string,
  limit = 100,
  offset = 0
): Promise<RedemptionRecord[]> {
  const c = client();
  let q = c
    .from("redemptions")
    .select("*")
    .order("redeemed_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (templateId) q = q.eq("template_id", templateId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as RedemptionRecord[]) ?? [];
}

export async function countRedemptions(templateId?: string): Promise<number> {
  const c = client();
  let q = c.from("redemptions").select("id", { count: "exact", head: true });
  if (templateId) q = q.eq("template_id", templateId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
