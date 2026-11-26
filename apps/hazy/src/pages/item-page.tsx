import { useParams } from "@tanstack/react-router";
import { ItemDetailView } from "@/components/item/item-detail-view";

export function ItemPage() {
  const { id = "" } = useParams({ strict: false });
  return <ItemDetailView id={id} />;
}
