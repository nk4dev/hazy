import { useParams } from "@tanstack/react-router";
import { CollectionDetailView } from "@/components/collections/collection-detail-view";

export function CollectionDetailPage() {
  const { id = "" } = useParams({ strict: false });
  return <CollectionDetailView id={id} />;
}
