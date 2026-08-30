import { LibraryView } from "@/components/library/library-view";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  return <LibraryView initialQuery={typeof q === "string" ? q : ""} />;
}
