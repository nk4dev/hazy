import { SkeletonCards } from "@/components/loading";

export default function NotesLoading() {
  return (
    <main className="flex flex-col gap-5 p-4 pb-10 sm:p-[26px_30px_40px]">
      <header className="flex items-end gap-4">
        <div>
          <div className="mb-[5px] text-[11px] uppercase tracking-[0.1em] text-text/[0.42]">
            ノート
          </div>
          <h3 className="tracking-[-0.02em]">概念単位で書きためる</h3>
        </div>
      </header>
      <SkeletonCards count={6} />
    </main>
  );
}
