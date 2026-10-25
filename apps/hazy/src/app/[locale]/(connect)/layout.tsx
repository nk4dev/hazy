import { HazyMark } from "@/components/hazy-mark";

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <div className="flex items-center gap-2">
        <HazyMark size={28} />
        <span className="text-lg font-medium">Hazy</span>
      </div>
      {children}
    </div>
  );
}
