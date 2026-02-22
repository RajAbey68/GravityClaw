import { redirect } from "next/navigation";

export default function GroupRoute() {
  redirect("/chat?mode=group");
}
