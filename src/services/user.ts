// API Dependency
import { request } from "./api";

// Configuration
import { BRAND_SERVICE, USER_SERVICE, AIRDROP_SERVICE } from "@/config/api";

// Types
import {
  User,
  UserVoteHistory,
  UserVote,
  UserBrand,
} from "../shared/hooks/user";

export interface ShareVerificationData {
  castHash: string;
  voteId: string;
}

export interface ShareVerificationResponse {
  verified: boolean;
  pointsAwarded: number;
  newTotalPoints: number;
  message: string;
}

/**
 * Retrieves the vote history of a user from the user service.
 *
 * @param id - The ID of the user whose vote history is being retrieved.
 * @param pageId - The page number for paginated vote history.
 * @returns A promise that resolves with an object containing the count of votes and the user's vote history data.
 */
export const getUserVotesHistory = async (id: User["fid"], pageId: number) =>
  await request<{ count: number; data: Record<string, UserVoteHistory> }>(
    `${USER_SERVICE}/user/${id}/vote-history`,
    {
      method: "GET",
      params: {
        pageId: String(pageId),
        limit: String(3 * 10),
      },
    }
  );

/**
 * Retrieves the current user's vote history using authentication.
 * No user ID required - uses the auth token to identify the user.
 *
 * @param pageId - The page number for paginated vote history.
 * @param limit - Number of records per page (default: 15).
 * @returns A promise that resolves with an object containing the count of votes and the user's vote history data.
 */
export const getMyVoteHistory = async (
  pageId: number = 1,
  limit: number = 15
) =>
  await request<{ count: number; data: Record<string, UserVoteHistory> }>(
    `${USER_SERVICE}/my-vote-history`,
    {
      method: "GET",
      params: {
        pageId: String(pageId),
        limit: String(limit),
      },
    }
  );

/**
 * Interface for leaderboard API response (matches backend LeaderboardResponse)
 */
export interface LeaderboardApiResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  currentUser?: {
    position: number;
    points: number;
    user: Pick<User, "fid" | "username" | "photoUrl">;
  };
}

/**
 * Retrieves the user leaderboard with ranking and pagination.
 * Uses authentication to also return current user's position.
 *
 * @param page - The page number for pagination (default: 1).
 * @param limit - The number of users per page (default: 50).
 * @returns A promise that resolves with the leaderboard data including users, pagination, and current user position.
 */
export const getUserLeaderboard = async (
  page: number = 1,
  limit: number = 50
): Promise<LeaderboardApiResponse> =>
  await request<LeaderboardApiResponse>(`${USER_SERVICE}/leaderboard`, {
    method: "GET",
    params: {
      page: String(page),
      limit: String(limit),
    },
  });

/**
 * Retrieves the user votes for a specific date.
 *
 * @param unixDate - The Unix timestamp representing the date for which to retrieve the votes.
 * @returns A promise that resolves with an object containing the count of votes and the user's vote history data.
 */
export const getUserVotes = async (unixDate: number) =>
  await request<UserVote>(`${USER_SERVICE}/votes/${unixDate}`, {
    method: "GET",
  });

export const getUserBrands = async () =>
  await request<UserBrand[]>(`${USER_SERVICE}/brands`, {
    method: "GET",
  });

export const shareFrame = async (): Promise<boolean> =>
  await request(`${USER_SERVICE}/share-frame`, {
    method: "POST",
  });

/**
 * Verifies a shared cast and awards points for valid shares.
 *
 * @param data - Object containing castHash and voteId
 * @returns A promise that resolves with verification result and updated points
 */
export const verifyShare = async (
  data: ShareVerificationData
): Promise<ShareVerificationResponse> =>
  await request<ShareVerificationResponse>(`${BRAND_SERVICE}/verify-share`, {
    method: "POST",
    body: data,
    headers: {
      "Content-Type": "application/json",
    },
  });

/**
 * Interface for airdrop check API response
 */
export interface AirdropCheckResponse {
  calculation: {
    fid: number;
    basePoints: number;
    totalMultiplier: number;
    finalScore: number;
    leaderboardPosition: number;
    tokenAllocation: number;
    percentage: number;
    challenges: Array<{
      name: string;
      description: string;
      currentValue: number;
      currentMultiplier: number;
      maxMultiplier: number;
      completed: boolean;
      progress: {
        current: number;
        required: number;
        unit: string;
      };
      tiers: Array<{
        requirement: number;
        multiplier: number;
        achieved: boolean;
      }>;
    }>;
  };
}

/**
 * Checks the current user's airdrop eligibility and details.
 * Uses authentication to identify the user via the backend's quickAuth mechanism.
 *
 * @returns A promise that resolves with airdrop check data including eligibility, points, and completed tasks.
 */
export const checkUserAirdrop = async (): Promise<AirdropCheckResponse> =>
  await request<AirdropCheckResponse>(`${AIRDROP_SERVICE}/check-user`, {
    method: "GET",
  });

/**
 * Interface for airdrop leaderboard entry
 */
export interface AirdropLeaderboardEntry {
  rank: number;
  fid: number;
  username: string;
  photoUrl: string | null;
  basePoints: number;
  multipliers: {
    followAccounts: number;
    channelInteraction: number;
    holdingBrnd: number;
    collectibles: number;
    votedBrands: number;
    sharedPodiums: number;
    neynarScore: number;
    proUser: number;
  };
  totalMultiplier: number;
  finalScore: number;
  tokenAllocation: number;
  percentage: number;
  lastUpdated: string;
}

/**
 * Interface for airdrop leaderboard API response
 */
export interface AirdropLeaderboardResponse {
  leaderboard: AirdropLeaderboardEntry[];
  total: number;
  limit: number;
}

/**
 * Retrieves the airdrop leaderboard data.
 * No authentication required for leaderboard viewing.
 *
 * @param limit - Number of entries to return (max: 1000, default: 100).
 * @returns A promise that resolves with the airdrop leaderboard data.
 */
export const getAirdropLeaderboard = async (
  limit: number = 100
): Promise<AirdropLeaderboardResponse> =>
  await request<AirdropLeaderboardResponse>(`${AIRDROP_SERVICE}/leaderboard`, {
    method: "GET",
    params: {
      limit: String(limit),
    },
  });
