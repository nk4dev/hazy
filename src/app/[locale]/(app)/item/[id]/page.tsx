import { ItemDetailView } from "@/components/item/item-detail-view";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItemDetailView id={id} />;
}
