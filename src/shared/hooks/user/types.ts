import { Brand } from "../brands";

export interface TodaysVoteStatus {
  hasVoted: boolean;
  hasShared: boolean;
  hasClaimed: boolean;
  voteId: string | null;
  castHash: string | null;
  transactionHash: string | null;
  day: number;
  lastVoteTimestamp?: string;
  sharedVoteToday?: boolean;
  todaysVote?: UserVote | null;
  votedToday?: boolean;
}

export interface ContextualTransaction {
  transactionHash: string | null;
  transactionType: "vote" | "claim" | null;
  rewardAmount?: string; // Only present when transactionType is 'claim' (in wei)
  castHash?: string; // Only present when transactionType is 'claim' - the Farcaster cast hash
  day?: number;
  createdAt?: string;
}

export type User = {
  fid: number;
  username: string;
  photoUrl: string;
  address?: string; // Wallet address
  banned?: boolean;
  createdAt: string;
  updatedAt?: string;
  points: number;
  hasVotedToday: boolean;
  todaysVote?: UserVote | null;
  isNewUser: boolean;
  notificationsEnabled?: boolean;
  hasSharedToday?: boolean; // Deprecated - use todaysVoteStatus.hasShared instead
  todaysVoteStatus?: TodaysVoteStatus | null;
  contextualTransaction?: ContextualTransaction | null;
  // BRND Power Level from contract
  brndPowerLevel?: number;
  // User stats
  claimedRewardsToday?: boolean;
  dailyStreak?: number;
  powerups?: number;
  totalPodiums?: number;
  totalVotes?: number;
  votedBrandsCount?: number;
  verified?: boolean;
  // Favorite brand
  favoriteBrand?: {
    id: number;
    imageUrl: string;
    name: string;
  };
  // Airdrop information
  airdrop?: {
    isEligible: boolean;
    airdropScore: number;
    tokenAllocation: number;
    percentage: number;
    leaderboardPosition: number;
    snapshotExists: boolean;
    hasClaimed?: boolean;
    latestSnapshot?: {
      id: number;
      merkleRoot: string;
      totalUsers: number;
      totalTokens: string;
      snapshotDate: string;
      leaderboardPosition?: number;
      multipliers?: string;
      percentage?: string;
    };
  };
};

export enum UserRoleEnum {
  ADMIN = "admin",
  USER = "user",
}

export interface UserVoteHistory {
  length: number;
  map(
    arg0: (brand: any, index: any) => import("react/jsx-runtime").JSX.Element
  ): import("react").ReactNode;
  id: string;
  date: string;
  brand1: Brand;
  brand2: Brand;
  brand3: Brand;
}

export interface UserVote {
  id: string;
  date: string;
  brand1: Brand;
  brand2: Brand;
  brand3: Brand;
}

export interface UserBrand {
  brand: Brand;
  points: number;
}

export interface UserBrand {
  brand: Brand;
  points: number; // Total points this user gave this brand
  voteCount: number; // How many times user voted for this brand
  lastVoted: string; // When they last voted for this brand
  position: number; // User's personal ranking (1st, 2nd, 3rd, etc.)
}
