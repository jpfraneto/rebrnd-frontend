// Dependencies
import { Outlet } from "react-router-dom";
import {
  useState,
  useEffect,
  createContext,
  useCallback,
  useMemo,
} from "react";

// Providers
import { BottomSheetProvider } from "./BottomSheetProvider";
import { ModalProvider } from "./ModalProvider";
import { PowerLevelProvider } from "../contexts/PowerLevelContext";

// Components
import NotificationPrompt from "@/shared/components/NotificationPrompt";

// Farcaster Miniapp Init
import sdk from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Services
import { setFarcasterToken } from "../utils/auth";
import { getMe } from "@/services/auth";

// Utils
import {
  shouldShowNotificationPrompt,
  markNotificationsEnabled,
} from "@/shared/utils/notifications";

// Types
import { User, TodaysVoteStatus, ContextualTransaction } from "@/shared/hooks/user";

// Global flag to ensure /me is only called once per session (for initial load)
let hasCalledGetMe = false;

export interface AuthContextData {
  token: string | undefined;
  signIn: () => Promise<void>;
  signOut: () => void;
  miniappContext: Context.MiniAppContext | null;
  isInitialized: boolean;
  // Auth data - replaces useAuth hook
  data: (User & { hasVotedToday: boolean; isNewUser: boolean }) | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Optimistic update function to update auth state immediately
  updateAuthData: (updates: Partial<User & { hasVotedToday: boolean; isNewUser: boolean }>) => void;
}

export const AuthContext = createContext<AuthContextData>({
  token: undefined,
  signIn: async () => {},
  signOut: () => {},
  miniappContext: null,
  isInitialized: false,
  data: undefined,
  isLoading: false,
  error: null,
  refetch: async () => {},
  updateAuthData: () => {},
});

const queryClient = new QueryClient();

/**
 * AppProvider component that manages Farcaster miniapp authentication and context.
 *
 * This provider handles the complete authentication flow for Farcaster miniapps:
 * 1. Initializes the Farcaster SDK and obtains QuickAuth token
 * 2. Loads miniapp context (user data, etc.)
 * 3. Automatically authenticates with backend via /me endpoint
 * 4. Prompts user to add miniapp if they haven't already
 * 5. Manages authentication state throughout the app lifecycle
 *
 * The provider eliminates the need for explicit login flows since Farcaster
 * miniapps have implicit authentication through the platform.
 */
export function AppProvider(): JSX.Element {
  const [token, setToken] = useState<string>();
  const [miniappContext, setMiniappContext] =
    useState<Context.MiniAppContext | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAddMiniappPrompt, setShowAddMiniappPrompt] = useState(false);
  const [userFid, setUserFid] = useState<number | null>(null);
  
  // Auth data state - replaces React Query in useAuth
  const [authData, setAuthData] = useState<(User & { hasVotedToday: boolean; isNewUser: boolean }) | undefined>(undefined);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);

  // Optimistic update function to immediately update auth state
  const updateAuthData = useCallback((updates: Partial<User & { hasVotedToday: boolean; isNewUser: boolean }>) => {
    setAuthData((prev) => {
      if (!prev) return prev;
      
      // Deep merge the updates
      const updated = {
        ...prev,
        ...updates,
        // Handle nested objects
        todaysVoteStatus: updates.todaysVoteStatus 
          ? { ...prev.todaysVoteStatus, ...updates.todaysVoteStatus } as TodaysVoteStatus
          : prev.todaysVoteStatus,
        contextualTransaction: updates.contextualTransaction !== undefined
          ? updates.contextualTransaction as ContextualTransaction | null
          : prev.contextualTransaction,
        todaysVote: updates.todaysVote !== undefined
          ? updates.todaysVote
          : prev.todaysVote,
        airdrop: updates.airdrop
          ? { ...prev.airdrop, ...updates.airdrop }
          : prev.airdrop,
      };
      
      console.log("🔄 [AuthContext] Optimistically updated auth data:", updates);
      return updated;
    });
  }, []);

  // Refetch function - NO-OP since we only call /me once per session
  // This is kept for backwards compatibility but does nothing
  const refetchAuthData = useCallback(async () => {
    console.log("🚫 [AuthContext] Refetch requested but /me only called once per session - using optimistic updates instead");
    // Do nothing - we don't refetch /me after initial load
    // All updates happen via updateAuthData (optimistic updates)
  }, []);

  useEffect(() => {
    async function initMiniapp() {
      if (isInitialized) return;

      try {
        // Obtain QuickAuth token from Farcaster
        const { token: newToken } = await sdk.quickAuth.getToken();
        setToken(newToken);
        setFarcasterToken(newToken);

        // Signal that miniapp is ready
        await sdk.actions.ready();

        // Load miniapp context (user profile, etc.)
        const context = await sdk.context;
        setMiniappContext(context);

        // Store user FID for later use
        if (context.user?.fid) {
          setUserFid(context.user.fid);
        }

        // Call /me endpoint ONLY ONCE during the entire user session
        if (newToken && !hasCalledGetMe) {
          hasCalledGetMe = true; // Set flag immediately to prevent any other calls
          setIsLoadingAuth(true);
          setAuthError(null);
          try {
            console.log("🔄 [AuthContext] Fetching user data via /me endpoint (ONCE PER SESSION)");
            const userData = await getMe();
            console.log("✅ [AuthContext] Successfully fetched user data:", userData);
            setAuthData(userData);
          } catch (error) {
            console.error("❌ [AuthContext] Failed to fetch user data:", error);
            setAuthError(error instanceof Error ? error : new Error("Failed to fetch user data"));
            // Reset flag on error so user can retry
            hasCalledGetMe = false;
          } finally {
            setIsLoadingAuth(false);
          }
        } else if (newToken && hasCalledGetMe) {
          console.log("🚫 [AuthContext] /me already called this session, skipping");
        }
        
        setIsInitialized(true);

        // Short delay to let the app settle before showing prompt
        setTimeout(() => {
          // Check if user has already added the miniapp via Farcaster context
          if (context.client?.added) {
            return;
          }

          checkAndShowAddMiniappPrompt(context.user?.fid);
        }, 1000);
      } catch (error) {
        console.error("Failed to initialize miniapp:", error);
        setIsInitialized(false);
      }
    }

    initMiniapp();
  }, [isInitialized]);

  /**
   * Check if we should show the add miniapp prompt on app load
   */
  const checkAndShowAddMiniappPrompt = useCallback(
    (fid: number | undefined) => {
      if (!fid) return;

      // Use existing notification prompt logic but for initial app load
      // This checks localStorage and other conditions to determine if we should prompt
      const shouldShow = shouldShowNotificationPrompt(
        fid,
        false // We don't have backend state yet, so assume notifications not enabled
      );

      if (shouldShow) {
        setShowAddMiniappPrompt(true);
      } else {
      }
    },
    []
  );

  /**
   * Handle completion of add miniapp prompt flow
   */
  const handleAddMiniappComplete = useCallback(
    (added: boolean): void => {
      setShowAddMiniappPrompt(false);

      if (added && userFid) {
        // Mark as enabled in localStorage for future reference
        markNotificationsEnabled(userFid);
      }
    },
    [userFid]
  );

  const signIn = useCallback(async () => {
    try {
      // Get new QuickAuth token
      const { token: newToken } = await sdk.quickAuth.getToken();
      setToken(newToken);
      setFarcasterToken(newToken);

      // Refresh context
      const context = await sdk.context;
      setMiniappContext(context);

      // For signIn, allow refetch since user explicitly signed in again
      if (newToken) {
        setIsLoadingAuth(true);
        setAuthError(null);
        try {
          console.log("🔄 [AuthContext] Refetching user data via /me endpoint (explicit signIn)");
          const userData = await getMe();
          console.log("✅ [AuthContext] Successfully refetched user data:", userData);
          setAuthData(userData);
        } catch (error) {
          console.error("❌ [AuthContext] Failed to refetch user data:", error);
          setAuthError(error instanceof Error ? error : new Error("Failed to refetch user data"));
        } finally {
          setIsLoadingAuth(false);
        }
      }
    } catch (error) {
      console.error("Failed to sign in:", error);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(undefined);
    setMiniappContext(null);
    setIsInitialized(false);
    setShowAddMiniappPrompt(false);
    setUserFid(null);
    // Clear auth data
    setAuthData(undefined);
    setAuthError(null);
    setIsLoadingAuth(false);
    // Reset the global flag so /me can be called again in next session
    hasCalledGetMe = false;
    // Clear all cached data
    queryClient.clear();
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      token,
      signIn,
      signOut,
      miniappContext,
      isInitialized,
      data: authData,
      isLoading: isLoadingAuth,
      error: authError,
      refetch: refetchAuthData,
      updateAuthData,
    }),
    [token, signIn, signOut, miniappContext, isInitialized, authData, isLoadingAuth, authError, refetchAuthData, updateAuthData]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={contextValue}>
        <PowerLevelProvider>
          <BottomSheetProvider>
            <ModalProvider>
              {/* Add miniapp prompt overlay - shown on app load if needed */}
              {showAddMiniappPrompt && userFid && (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px",
                  }}
                >
                  <NotificationPrompt
                    userFid={userFid}
                    onComplete={handleAddMiniappComplete}
                    points={0} // No points context on app load
                  />
                </div>
              )}
              <Outlet />
            </ModalProvider>
          </BottomSheetProvider>
        </PowerLevelProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
