import { Suspense } from "react";
import { ChatPage } from "@/src/ui/pages/chat-page";

export default function ChatRoute() {
  return (
    <Suspense fallback={<div className="gc-card" style={{ padding: "1rem" }}>Loading chat...</div>}>
      <ChatPage />
    </Suspense>
  );
}
