import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { LibraryClient } from "./library-client";

export default function LibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryClient />
    </Suspense>
  );
}
