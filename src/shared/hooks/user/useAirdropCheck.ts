import { useQuery } from "@tanstack/react-query";

// Services
import { checkUserAirdrop, AirdropCheckResponse } from "@/services/user";

interface UseAirdropCheckOptions {
  enabled?: boolean;
}

/**
 * Custom hook for checking user's airdrop eligibility and status.
 * Uses TanStack Query for efficient data fetching and caching.
 *
 * @param options - Configuration options for the query
 * @returns Query result containing airdrop data, loading state, and error handling
 */
export const useAirdropCheck = (options: UseAirdropCheckOptions = {}) => {
  const { enabled = true } = options;

  return useQuery<AirdropCheckResponse, Error>({
    queryKey: ["airdrop", "check"],
    queryFn: checkUserAirdrop,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Changed to false to prevent automatic fetching
    enabled,
  });
};
