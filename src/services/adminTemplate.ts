import { supabase } from "@/services/supabase";
import type { Prompt, Scenario, TaskPack } from "@/types";

function client() {
  if (!supabase) throw new Error("Supabase 未配置");
  return supabase;
}

export interface TemplatePayload {
  prompts: Prompt[];
  scenarios: Scenario[];
  taskPacks: TaskPack[];
}

export interface TemplateStats {
  promptCount: number;
  scenarioCount: number;
  taskPackCount: number;
}

export interface TemplateRecord {
  id: string;
  title: string;
  description: string;
  audience: string | null;
  version: number;
  status: "draft" | "published" | "archived";
  payload: TemplatePayload;
  stats: TemplateStats | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  id: string; // UI 提供，需与 packTemplate 的 templateId 一致以保证 payload 命名空间正确
  title: string;
  description: string;
  audience?: string;
  payload: TemplatePayload;
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  const c = client();
  const { data, error } = await c
    .from("templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TemplateRecord[]) ?? [];
}

export async function getTemplate(id: string): Promise<TemplateRecord | null> {
  const c = client();
  const { data, error } = await c
    .from("templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TemplateRecord | null;
}

export async function createTemplate(
  input: CreateTemplateInput
): Promise<TemplateRecord> {
  const c = client();
  const stats: TemplateStats = {
    promptCount: input.payload.prompts.length,
    scenarioCount: input.payload.scenarios.length,
    taskPackCount: input.payload.taskPacks.length,
  };
  const { data, error } = await c
    .from("templates")
    .insert({
      id: input.id,
      title: input.title,
      description: input.description,
      audience: input.audience ?? null,
      version: 1,
      status: "draft",
      payload: input.payload,
      stats,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TemplateRecord;
}

export async function updateTemplate(
  id: string,
  patch: Partial<Pick<TemplateRecord, "title" | "description" | "audience" | "payload">>
): Promise<TemplateRecord> {
  const c = client();
  const updates: Record<string, unknown> = { ...patch };
  if (patch.payload) {
    updates.stats = {
      promptCount: patch.payload.prompts.length,
      scenarioCount: patch.payload.scenarios.length,
      taskPackCount: patch.payload.taskPacks.length,
    };
  }
  const { data, error } = await c
    .from("templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TemplateRecord;
}

export async function publishTemplate(id: string): Promise<TemplateRecord> {
  const c = client();
  const { data, error } = await c
    .from("templates")
    .update({ status: "published" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TemplateRecord;
}

export async function archiveTemplate(id: string): Promise<void> {
  const c = client();
  const { error } = await c
    .from("templates")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string): Promise<void> {
  const c = client();
  const { error } = await c.from("templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
