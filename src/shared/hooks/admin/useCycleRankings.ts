import { useQuery } from "@tanstack/react-query";
import { getCycleRankings, getDeploymentInfo } from "@/services/admin";

export interface CycleRanking {
  position: number;
  brand: {
    id: number;
    name: string;
    imageUrl: string;
    url: string;
    warpcastUrl: string;
    profile: string;
    channel: string;
    followerCount: number;
    category: string;
  };
  scores: {
    allTime: number;
    week: number;
    month: number;
    current: number;
  };
  rankings: {
    allTime: number;
    week: number;
    month: number;
  };
  percentageOfLeader: number;
}

export interface CycleInfo {
  period: "week" | "month";
  cycleNumber: number;
  startTime: string;
  endTime: string;
  timeRemaining: {
    milliseconds: number;
    days: number;
    hours: number;
    minutes: number;
  };
  isActive: boolean;
  nextCycleStart: string;
}

export interface CycleRankingsResponse {
  period: "week" | "month";
  rankings: CycleRanking[];
  cycleInfo: CycleInfo;
  metadata: {
    generatedAt: string;
    totalBrands: number;
    cycleNumber: number;
  };
}

export interface DeploymentInfo {
  deployment: {
    assumedTime: string;
    timezone: string;
    note: string;
  };
  firstVote: {
    id: string;
    timestamp: string;
    timeFromDeployment: number;
  } | null;
  latestVote: {
    id: string;
    timestamp: string;
  } | null;
  statistics: {
    totalVotes: number;
    daysActive: number;
  };
  cycles: {
    week: CycleInfo;
    month: CycleInfo;
  };
}

// Hook to get cycle rankings - following your pattern
export const useCycleRankings = (
  period: "week" | "month",
  limit: number = 10
) => {
  return useQuery({
    queryKey: ["admin", "cycles", period, "rankings", limit],
    queryFn: () => getCycleRankings(period, limit),
    refetchInterval: 60000, // Refetch every minute for live updates
    staleTime: 30000, // Consider fresh for 30 seconds
    refetchOnWindowFocus: false,
  });
};

// Hook to get deployment info - following your pattern
export const useDeploymentInfo = () => {
  return useQuery({
    queryKey: ["admin", "deployment-info"],
    queryFn: () => getDeploymentInfo(),
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    refetchOnWindowFocus: false,
  });
};
