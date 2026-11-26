import { useParams } from "@tanstack/react-router";
import { AskThreadView } from "@/components/ask/ask-thread-view";

export function AskThreadPage() {
  const { threadId = "" } = useParams({ strict: false });
  return <AskThreadView threadId={threadId} />;
}
