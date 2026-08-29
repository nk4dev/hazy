-- Canonicalise the collection_items unique constraint to (collection_id,
-- saved_url_id). drizzle-kit's introspection (which seeded 0000_baseline)
-- emitted the columns in the opposite order from how they exist on the
-- production database; this DROP + re-ADD brings every environment to the same
-- definition. Semantically a no-op — a composite UNIQUE is order-independent
-- for correctness — and safe: nothing references collection_items.
ALTER TABLE "collection_items" DROP CONSTRAINT "collection_items_collection_saved_url_unique";--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_saved_url_unique" UNIQUE("collection_id","saved_url_id");
