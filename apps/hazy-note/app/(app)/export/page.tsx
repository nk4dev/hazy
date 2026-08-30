import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { ExportClient } from "./export-client";

export default function ExportPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExportClient />
    </Suspense>
  );
}
