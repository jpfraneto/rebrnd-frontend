// Dependencies
import { useQuery } from "@tanstack/react-query";

// Services
import { checkClaimStatus, AirdropClaimStatusResponse } from "@/services/airdrop";

// Types
export interface UseAirdropClaimStatusOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to check user's airdrop claim status and eligibility
 */
export const useAirdropClaimStatus = (options: UseAirdropClaimStatusOptions = {}) => {
  return useQuery<AirdropClaimStatusResponse>({
    queryKey: ['airdrop-claim-status'],
    queryFn: checkClaimStatus,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    }
  });
};