import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { Sidebar } from "@/components/sidebar/Sidebar";

export default function Prompts() {
  return (
    <ThreeColumnLayout
      sidebar={<Sidebar />}
      main={<div className="p-4 text-sm text-foreground/50">卡片列表（待实现）</div>}
    />
  );
}
