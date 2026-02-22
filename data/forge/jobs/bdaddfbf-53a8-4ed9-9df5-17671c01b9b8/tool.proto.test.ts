import manifest from "./tool.proto";

if (!manifest.id || !manifest.responseTemplate) {
  throw new Error("invalid generated manifest for forge-prepare-outbound-status-digest-bdaddfbf");
}
