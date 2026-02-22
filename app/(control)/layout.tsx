import { ControlShell } from "@/src/ui/components/shell/control-shell";

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  return <ControlShell>{children}</ControlShell>;
}
