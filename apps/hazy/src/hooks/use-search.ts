import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { hazyQueries } from "@/lib/clients";

export function useSearchQuery(query: string) {
  return useQuery({
    ...hazyQueries.search(query),
    placeholderData: keepPreviousData,
  });
}
