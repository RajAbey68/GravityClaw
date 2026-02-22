"use client";

import { useEffect, useState } from "react";

export function DevlogViewer() {
  const [content, setContent] = useState("Loading DEVLOG...");

  useEffect(() => {
    fetch("/api/docs/DEVLOG.md")
      .then((res) => res.json())
      .then((data: { content?: string; error?: string }) => setContent(data.content ?? data.error ?? "No content"))
      .catch(() => setContent("Unable to load DEVLOG.md"));
  }, []);

  return (
    <div className="gc-card" style={{ padding: "0.9rem" }}>
      <strong>DEVLOG Viewer</strong>
      <pre
        className="gc-scroll"
        style={{
          marginTop: "0.7rem",
          whiteSpace: "pre-wrap",
          maxHeight: "45vh",
          overflowY: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "0.74rem"
        }}
      >
        {content}
      </pre>
    </div>
  );
}
