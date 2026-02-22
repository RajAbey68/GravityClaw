"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

interface ActionButtonProps {
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  className?: string;
  style?: CSSProperties;
  run: () => Promise<void>;
}

export function ActionButton({
  label,
  loadingLabel = "Working...",
  successLabel = "Saved",
  errorLabel = "Failed",
  className,
  style,
  run
}: ActionButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function onClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      await run();
      setState("success");
      window.setTimeout(() => setState("idle"), 1300);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 1600);
    }
  }

  const text =
    state === "loading"
      ? loadingLabel
      : state === "success"
        ? successLabel
        : state === "error"
          ? errorLabel
          : label;

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={state === "loading"}
      style={{
        border: "1px solid var(--gc-primary-soft)",
        background:
          state === "success"
            ? "rgba(80, 220, 160, 0.18)"
            : state === "error"
              ? "rgba(255, 122, 122, 0.14)"
              : "rgba(25, 209, 195, 0.12)",
        borderRadius: "10px",
        padding: "0.45rem 0.65rem",
        cursor: "pointer",
        transition: "background 180ms ease",
        ...style
      }}
    >
      {text}
    </button>
  );
}
