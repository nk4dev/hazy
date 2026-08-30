import { NoteClient } from "./note-client";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteClient id={id} />;
}
