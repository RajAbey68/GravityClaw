import { redirect } from "next/navigation";

interface Props {
  params: { agentId: string };
}

export default function AgentByIdRoute({ params }: Props) {
  redirect(`/agents?agentId=${encodeURIComponent(params.agentId)}`);
}

