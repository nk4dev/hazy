import { ok, withApiErrors } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/current-user";
import { bucketReadLaterItems } from "@/lib/read-later/bucketing";
import { getReadLaterQueue } from "@/lib/read-later/get-queue";
import { serializeSavedUrl } from "@/lib/serializers";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  const user = await requireUser();
  const inboxItems = await getReadLaterQueue(user.id);

  const { todaysThree, fiveMinutes, sitDown, totalMinutes, todaysThreeMinutes } =
    bucketReadLaterItems(inboxItems);

  return ok({
    totalCount: inboxItems.length,
    totalMinutes,
    todaysThreeMinutes,
    todaysThree: todaysThree.map((i) => serializeSavedUrl(i, i.readLater)),
    fiveMinutes: fiveMinutes.map((i) => serializeSavedUrl(i, i.readLater)),
    sitDown: sitDown.map((i) => serializeSavedUrl(i, i.readLater)),
  });
});
