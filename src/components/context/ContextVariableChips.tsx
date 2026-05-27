import { useMemo } from "react";
import { extractVariables } from "@/services/templateVariables";

interface Props {
  content: string;
}

export function ContextVariableChips({ content }: Props) {
  const variables = useMemo(() => extractVariables(content), [content]);

  if (variables.length === 0) {
    return (
      <p className="text-[11px] italic text-hint">
        未检测到变量。支持 {"{{变量}}"}、{"{变量}"}、【变量】、[变量]
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <span
          key={v}
          className="mono inline-flex items-center rounded-md bg-amber-soft px-2 py-0.5 text-[11px] text-amber"
        >
          {`{{${v}}}`}
        </span>
      ))}
    </div>
  );
}
