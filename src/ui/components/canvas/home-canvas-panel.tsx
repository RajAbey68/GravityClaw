"use client";

import { UniversalCanvas } from "@/src/ui/components/canvas/universal-canvas";
import { useSystemEvents } from "@/src/ui/components/shell/use-system-events";

export function HomeCanvasPanel() {
  const { events } = useSystemEvents();
  return <UniversalCanvas events={events} />;
}
