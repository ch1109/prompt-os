import { supabase, isSupabaseConfigured } from "./supabase";
import { db } from "@/db";

export async function publishTemplate(
  title: string,
  description: string,
  promptIds: string[]
): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error("未配置 Supabase，请在 .env.local 中添加 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY");
  }
  const prompts = (await db.prompts.bulkGet(promptIds)).filter(Boolean);
  const { data, error } = await supabase
    .from("shared_templates")
    .insert({ title, description, payload: { prompts } })
    .select("id")
    .single();
  if (error) throw error;
  return `${location.origin}/share/${data.id}`;
}
