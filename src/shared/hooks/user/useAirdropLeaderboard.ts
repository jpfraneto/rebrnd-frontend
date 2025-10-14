// Dependencies
import { useQuery } from "@tanstack/react-query";

// Services
import { getAirdropLeaderboard, AirdropLeaderboardResponse } from "@/services/user";

/**
 * Hook for fetching airdrop leaderboard data.
 * Data is cached for 5 minutes to reduce API calls while maintaining freshness.
 */
export const useAirdropLeaderboard = (limit: number = 100) => {
  return useQuery({
    queryKey: ["airdrop-leaderboard", limit],
    queryFn: () => getAirdropLeaderboard(limit),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

// Export the response type for use in components
export type { AirdropLeaderboardResponse };