import { AskThreadView } from "@/components/ask/ask-thread-view";

export default async function AskThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <AskThreadView threadId={threadId} />;
}
