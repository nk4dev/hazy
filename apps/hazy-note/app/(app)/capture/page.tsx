import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { CaptureClient } from "./capture-client";

export default function CapturePage() {
  return (
    <Suspense fallback={<Loading />}>
      <CaptureClient />
    </Suspense>
  );
}
