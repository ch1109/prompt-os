import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/services/supabase";
import { db } from "@/db";
import type { Prompt } from "@/types";

interface Template {
  id: string;
  title: string;
  description: string;
  payload: { prompts?: Prompt[] };
  created_at: string;
}

export default function ShareView() {
  const { id } = useParams<{ id: string }>();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setError("未配置 Supabase，无法加载共享模板");
      setLoading(false);
      return;
    }
    supabase
      .from("shared_templates")
      .select("*")
      .eq("id", id!)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) setError("模板不存在或已被删除");
        else setTpl(data as Template);
        setLoading(false);
      });
  }, [id]);

  async function handleImport() {
    if (!tpl) return;
    const prompts = tpl.payload.prompts ?? [];
    await db.prompts.bulkPut(prompts);
    setImported(true);
  }

  if (loading) return <div className="p-8 text-center text-sm text-foreground/50">加载中…</div>;
  if (error) return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  if (!tpl) return null;

  const prompts = tpl.payload.prompts ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{tpl.title}</h1>
      {tpl.description && <p className="text-foreground/70">{tpl.description}</p>}
      <p className="text-sm text-foreground/50">包含 {prompts.length} 条 Prompt</p>

      <ul className="space-y-2">
        {prompts.map((p) => (
          <li key={p.id} className="rounded-lg border border-border px-3 py-2 text-sm">
            <div className="font-medium">{p.title}</div>
            {p.summary && <div className="text-xs text-foreground/60 mt-0.5">{p.summary}</div>}
          </li>
        ))}
      </ul>

      <button
        onClick={handleImport}
        disabled={imported}
        className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90 disabled:opacity-60"
      >
        {imported ? `已导入 ${prompts.length} 条 Prompt ✓` : "导入到我的库"}
      </button>
    </div>
  );
}
