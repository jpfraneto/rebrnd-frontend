// Dependencies
import { useQuery, keepPreviousData } from "@tanstack/react-query";

// Services
import { getRecentPodiums } from "@/services/brands";

/**
 * Hook for fetching recent podiums with pagination
 */
export const useRecentPodiums = (page: number = 1, limit: number = 20) => {
  console.log("THE PAGE HERE IS", page);
  console.log("THE LIMIT HERE IS", limit);
  return useQuery({
    queryKey: ["recent-podiums", page, limit],
    queryFn: async () => {
      const response = await getRecentPodiums(page, limit);
      // Transform response to match component expectations
      return response;
    },
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    placeholderData: keepPreviousData, // Keep previous data while loading new page
  });
};
