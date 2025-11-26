// Dependencies
import { useQuery } from "@tanstack/react-query";

// Services
import { getUserProfile, UserProfileData } from "@/services/user";

/**
 * Hook for fetching the current user's profile data including stats and metrics.
 * Requires authentication. Data includes leaderboard position, points, streak, etc.
 */
export const useUserProfile = () => {
  return useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  });
};

// Export the response type for use in components
export type { UserProfileData };