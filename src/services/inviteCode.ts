import { customAlphabet } from "nanoid";
import { supabase } from "@/services/supabase";

function client() {
  if (!supabase) throw new Error("Supabase 未配置");
  return supabase;
}

/** 邀请码字符集：去除易混 0/O/1/I */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const gen4 = customAlphabet(ALPHABET, 4);

export interface InviteCodeRecord {
  code: string;
  template_id: string;
  template_version: number;
  status: "unused" | "used" | "revoked";
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  used_at: string | null;
  used_by_fingerprint: string | null;
}

/** 生成一个新码：XXXX-XXXX-XXXX-XXXX */
export function newCode(): string {
  return `${gen4()}-${gen4()}-${gen4()}-${gen4()}`;
}

export async function generateCodes(
  templateId: string,
  templateVersion: number,
  count: number,
  expiresAt: string | null = null,
  notes: string | null = null
): Promise<InviteCodeRecord[]> {
  const c = client();
  const rows = Array.from({ length: count }, () => ({
    code: newCode(),
    template_id: templateId,
    template_version: templateVersion,
    expires_at: expiresAt,
    notes,
  }));
  const { data, error } = await c.from("invite_codes").insert(rows).select();
  if (error) throw new Error(error.message);
  return (data as InviteCodeRecord[]) ?? [];
}

export async function listCodes(
  templateId?: string,
  status?: InviteCodeRecord["status"]
): Promise<InviteCodeRecord[]> {
  const c = client();
  let q = c
    .from("invite_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (templateId) q = q.eq("template_id", templateId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as InviteCodeRecord[]) ?? [];
}

export async function revokeCode(code: string): Promise<void> {
  const c = client();
  const { error } = await c
    .from("invite_codes")
    .update({ status: "revoked" })
    .eq("code", code)
    .eq("status", "unused");
  if (error) throw new Error(error.message);
}

export function exportCodesToCSV(codes: InviteCodeRecord[]): string {
  const header = "code,template_id,template_version,status,created_at,used_at,notes\n";
  const rows = codes
    .map((c) =>
      [
        c.code,
        c.template_id,
        c.template_version,
        c.status,
        c.created_at,
        c.used_at ?? "",
        (c.notes ?? "").replace(/[\n,]/g, " "),
      ].join(",")
    )
    .join("\n");
  return header + rows;
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
