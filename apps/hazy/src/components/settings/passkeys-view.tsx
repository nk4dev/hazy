import { hazyQueryKeys } from "@repo/api-client/query";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";
import { authClient } from "@/lib/clients";

type PasskeyItem = {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  createdAt?: string | Date | null;
};

export function PasskeysView() {
  const t = useTranslations("settings.passkeys");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const passkeysQuery = useQuery({
    queryKey: hazyQueryKeys.auth.passkeys(),
    queryFn: async () => {
      const res = await authClient.passkey.listUserPasskeys();
      if (res.error) {
        throw new Error(res.error.message || "Failed to load passkeys");
      }
      return (res.data ?? []) as PasskeyItem[];
    },
  });

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await authClient.passkey.addPasskey({
        name: name.trim() || undefined,
      });
      if (res?.error) {
        toast.error(res.error.message || t("addFailed"));
        return;
      }
      setName("");
      await queryClient.invalidateQueries({ queryKey: hazyQueryKeys.auth.passkeys() });
      toast.success(t("added"));
    } catch {
      toast.error(t("addFailed"));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await authClient.passkey.deletePasskey({ id });
      if (res?.error) {
        toast.error(res.error.message || t("deleteFailed"));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: hazyQueryKeys.auth.passkeys() });
      toast.success(t("deleted"));
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const passkeys = passkeysQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-base font-medium">{t("title")}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("note")}</p>
      </div>

      <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          disabled={adding}
          className="flex-1"
        />
        <Button type="submit" disabled={adding}>
          <Plus className="mr-1.5 size-4" />
          {adding ? t("adding") : t("add")}
        </Button>
      </form>

      {passkeysQuery.isPending ? (
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      ) : passkeysQuery.isError ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{t("loadFailed")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void passkeysQuery.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : passkeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl bg-card ring-1 ring-border">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {pk.name?.trim() || t("unnamed")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pk.deviceType ? `${pk.deviceType}` : "passkey"}
                    {pk.createdAt
                      ? ` · ${new Date(pk.createdAt).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deletingId === pk.id}
                onClick={() => void handleDelete(pk.id)}
              >
                <Trash2 className="mr-1 size-3.5" />
                {t("delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
