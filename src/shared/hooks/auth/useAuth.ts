// Dependencies
import { useQuery } from "@tanstack/react-query";
// Services
import { getMe } from "@/services/auth";
// Context
import { AuthContext } from "@/shared/providers/AppProvider";
import { useContext } from "react";

/**
 * Custom hook for authentication state management in Farcaster miniapps.
 *
 * This hook automatically handles user authentication by calling the /me endpoint
 * when a QuickAuth token is available. The endpoint handles:
 * - Token verification
 * - User creation for first-time users
 * - Profile updates and voting status
 *
 * The hook only executes when both the QuickAuth token and miniapp context
 * are available, ensuring proper initialization order.
 *
 * @returns Query object containing user data, loading state, and error information
 */
export const useAuth = () => {
  const { token, miniappContext, isInitialized } = useContext(AuthContext);

  // Check if we should make the request
  const shouldFetch = !!token && !!miniappContext && isInitialized;

  return useQuery({
    queryKey: ["auth"],
    queryFn: () => {
      // Double-check token exists before making request
      if (!token) {
        throw new Error("No authentication token available");
      }

      return getMe();
    },
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error (401, 403)
      if (error?.message?.includes("401") || error?.message?.includes("403")) {
        return false;
      }
      return failureCount < 1; // Retry once for other errors
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    // Only fetch when we have all required data
    enabled: shouldFetch,
    // Don't run on window focus if we don't have proper auth
    refetchOnWindowFocus: shouldFetch,
    // Don't run on reconnect if we don't have proper auth
    refetchOnReconnect: shouldFetch,
  });
};
