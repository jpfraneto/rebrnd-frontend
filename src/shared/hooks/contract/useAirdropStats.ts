// Dependencies
import { useReadContract } from "wagmi";

// Config
import { AIRDROP_CONTRACT_CONFIG, AIRDROP_ABI } from "@/config/contracts";

/**
 * Hook to fetch real-time airdrop statistics from the smart contract
 */
export function useAirdropStats() {
  // Get overall airdrop status
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useReadContract({
    address: AIRDROP_CONTRACT_CONFIG.CONTRACT,
    abi: AIRDROP_ABI,
    functionName: "getStatus",
    chainId: AIRDROP_CONTRACT_CONFIG.CHAIN_ID,
  });

  // Get claim statistics
  const {
    data: claimStatsData,
    isLoading: claimStatsLoading,
    error: claimStatsError,
    refetch: refetchClaimStats,
  } = useReadContract({
    address: AIRDROP_CONTRACT_CONFIG.CONTRACT,
    abi: AIRDROP_ABI,
    functionName: "getClaimStats",
    chainId: AIRDROP_CONTRACT_CONFIG.CHAIN_ID,
  });

  // Get timing information
  const {
    data: timingData,
    isLoading: timingLoading,
    error: timingError,
    refetch: refetchTiming,
  } = useReadContract({
    address: AIRDROP_CONTRACT_CONFIG.CONTRACT,
    abi: AIRDROP_ABI,
    functionName: "getAirdropTiming",
    chainId: AIRDROP_CONTRACT_CONFIG.CHAIN_ID,
  });

  const isLoading = statusLoading || claimStatsLoading || timingLoading;
  const error = statusError || claimStatsError || timingError;

  const refetchAll = () => {
    refetchStatus();
    refetchClaimStats();
    refetchTiming();
  };

  // Parse and format the data
  let parsedData = null;
  if (statusData && claimStatsData && timingData) {
    const [
      root,
      enabled,
      totalClaimedAmountWei,
      totalClaimedUsers,
      escrowBalance,
      allowance,
      startTime,
      endTime,
      isActive,
    ] = statusData as [
      string,
      boolean,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean
    ];

    const [claimedWei, totalClaimers, claimedTokens] = claimStatsData as [
      bigint,
      bigint,
      bigint
    ];

    const [hasStarted, startTimeFromTiming, endTimeFromTiming, timeRemaining, isActiveFromTiming] = timingData as [
      boolean,
      bigint,
      bigint,
      bigint,
      boolean
    ];

    parsedData = {
      // Status data
      merkleRoot: root,
      claimingEnabled: enabled,
      totalClaimedWei: Number(totalClaimedAmountWei),
      totalClaimedUsers: Number(totalClaimedUsers),
      escrowBalance: Number(escrowBalance),
      allowance: Number(allowance),
      startTime: Number(startTime),
      endTime: Number(endTime),
      isActive,

      // Claim stats
      claimStats: {
        totalClaimedWei: Number(claimedWei),
        totalClaimers: Number(totalClaimers),
        totalClaimedTokens: Number(claimedTokens),
      },

      // Timing data
      timing: {
        hasStarted,
        startTime: Number(startTimeFromTiming),
        endTime: Number(endTimeFromTiming),
        timeRemaining: Number(timeRemaining),
        isActive: isActiveFromTiming,
      },

      // Derived values
      claimRate: totalClaimers > 0 ? (Number(totalClaimers) / 1111) * 100 : 0,
      timeRemainingFormatted: formatTimeRemaining(Number(timeRemaining)),
      airdropStatus: isActive ? "LIVE" : hasStarted ? "ENDED" : "NOT_STARTED",
    };
  }

  return {
    data: parsedData,
    isLoading,
    error,
    refetch: refetchAll,
  };
}

/**
 * Hook to check eligibility for a specific FID
 */
export function useCheckEligibility(
  fid: number,
  baseAmount: number,
  proof: string[],
  enabled: boolean = true
) {
  return useReadContract({
    address: AIRDROP_CONTRACT_CONFIG.CONTRACT,
    abi: AIRDROP_ABI,
    functionName: "checkEligibility",
    args: [BigInt(fid), BigInt(baseAmount), proof as `0x${string}`[]],
    chainId: AIRDROP_CONTRACT_CONFIG.CHAIN_ID,
    query: {
      enabled: enabled && fid > 0 && baseAmount > 0 && proof.length > 0,
    },
  });
}

/**
 * Utility function to format time remaining
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0h 0m";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}