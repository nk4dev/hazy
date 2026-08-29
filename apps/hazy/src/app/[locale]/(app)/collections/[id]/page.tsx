import { CollectionDetailView } from "@/components/collections/collection-detail-view";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionDetailView id={id} />;
}
