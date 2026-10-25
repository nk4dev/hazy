import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { NotesClient } from "./notes-client";

export default function NotesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NotesClient />
    </Suspense>
  );
}
