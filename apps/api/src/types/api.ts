// The wire contract lives in `@repo/api-client` (one definition shared by this
// service and every client). Re-exported here so the moved `@/types/api`
// imports across `src/lib` keep resolving.
export * from "@repo/api-client/types";
