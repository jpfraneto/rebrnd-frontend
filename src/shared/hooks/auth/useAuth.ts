// Dependencies
import { useQuery } from "@tanstack/react-query";
import { useContext, useMemo } from "react";
// Services
import { getMe } from "@/services/auth";
// Context
import { AuthContext } from "@/shared/providers/AppProvider";

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
 * IMPORTANT: This query is configured to only fetch once per app session:
 * - staleTime: Infinity - Data never becomes stale, so it won't refetch
 * - refetchOnMount: false - Won't refetch when components mount
 * - refetchOnWindowFocus: false - Won't refetch on window focus
 * - refetchOnReconnect: false - Won't refetch on network reconnect
 * - React Query automatically deduplicates simultaneous requests with the same key
 *
 * The query will only execute once when the first component using this hook
 * mounts with all conditions met (token, miniappContext, isInitialized).
 * All subsequent components will use the cached data.
 *
 * @returns Query object containing user data, loading state, and error information
 */
export const useAuth = () => {
  const { token, miniappContext, isInitialized } = useContext(AuthContext);

  const shouldFetch = useMemo(
    () => !!token && !!miniappContext && isInitialized,
    [token, miniappContext, isInitialized]
  );
  console.log("The token", token);
  console.log("The miniappContext", miniappContext);
  console.log("The isInitialized", isInitialized);
  console.log("The shouldFetch", shouldFetch);

  return useQuery({
    // Static query key - doesn't change with token
    // This ensures all components share the same cached data
    queryKey: ["auth", "me"],
    queryFn: () => {
      if (!token) {
        throw new Error("No authentication token available");
      }
      return getMe();
    },
    retry: false,
    // Data never becomes stale - prevents any automatic refetches
    staleTime: Infinity,
    // Data never gets garbage collected - keeps it in cache forever
    gcTime: Infinity,
    // Only fetch when all conditions are met
    enabled: shouldFetch,
    // Disable all automatic refetching behaviors
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
};
