import { NoteClient } from "../[id]/note-client";

// A blank note held in memory — nothing is written to the DB until the first
// real edit (see NoteClient's `persist`).
export default function NewNotePage() {
  return <NoteClient />;
}
