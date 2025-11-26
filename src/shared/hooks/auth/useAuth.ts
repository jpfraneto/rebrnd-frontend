// Dependencies
import { useContext } from "react";
// Context
import { AuthContext } from "@/shared/providers/AppProvider";

/**
 * Custom hook for authentication state management in Farcaster miniapps.
 *
 * This hook returns the user authentication data that is fetched once during
 * app initialization in the AuthContext. This eliminates the performance issue
 * of calling React Query hooks in every component.
 *
 * The AuthContext handles:
 * - Token verification
 * - User creation for first-time users
 * - Profile updates and voting status
 * - Single /me endpoint call during app startup
 *
 * All components using this hook share the same cached data from the context,
 * preventing redundant API calls.
 *
 * @returns Object containing user data, loading state, error information, and refetch function
 */
export const useAuth = () => {
  const { data, isLoading, error, refetch, isInitialized, updateAuthData } = useContext(AuthContext);
  
  return {
    data,
    isLoading,
    error,
    refetch,
    updateAuthData,
    // For backwards compatibility with components that check isSuccess
    isSuccess: !isLoading && !error && !!data,
    // For backwards compatibility with components that check isError
    isError: !!error,
    // For backwards compatibility with React Query properties
    isPending: isLoading,
    isRefetching: false, // Not implementing refetch loading state for simplicity
    // Only consider data available when initialization is complete
    isReady: isInitialized,
  };
};
