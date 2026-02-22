import { Suspense } from "react";
import { AgentsPage } from "@/src/ui/pages/agents-page";

export default function AgentsRoute() {
  return (
    <Suspense fallback={<div className="gc-card" style={{ padding: "1rem" }}>Loading agents...</div>}>
      <AgentsPage />
    </Suspense>
  );
}
