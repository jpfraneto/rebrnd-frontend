import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  useLocation,
  useParams,
  useNavigate,
} from "react-router-dom";

// Components
import PodiumView from "./partials/PodiumView";
import ShareView from "./partials/ShareView";
import CongratsView from "./partials/CongratsView";
import AlreadySharedView from "./partials/AlreadySharedView";
import LoaderIndicator from "../../shared/components/LoaderIndicator";

// Types
import { VotingViewEnum } from "./types";

// Hooks
import { Brand } from "@/hooks/brands";
import { useAuth } from "@/hooks/auth";
import { useUserVotes } from "@/hooks/user/useUserVotes";
import { useQueryClient } from "@tanstack/react-query";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";

/**
 * The 4 precise voting states that a user can be in:
 * 1. not_voted - User hasn't voted today
 * 2. voted_not_shared - User voted but hasn't shared the cast
 * 3. shared_not_claimed - User voted and shared but hasn't claimed rewards
 * 4. claimed - User has completed the full flow (voted, shared, claimed)
 */
type VotingState =
  | { type: "loading" }
  | { type: "not_voted" }
  | {
      type: "voted_not_shared";
      voteId: string;
      voteTransactionHash: string | null; // Transaction hash from voting
      brands: Brand[];
    }
  | {
      type: "shared_not_claimed";
      voteId: string;
      voteTransactionHash: string | null; // Transaction hash from voting
      castHash: string | null; // Cast hash from sharing on Farcaster
      brands: Brand[];
    }
  | {
      type: "claimed";
      voteId: string;
      voteTransactionHash: string | null; // Transaction hash from voting
      castHash: string | null; // Cast hash from sharing on Farcaster
      claimTransactionHash: string | null; // Transaction hash from claiming rewards
      brands: Brand[];
    };

function VotePage(): React.ReactNode {
  const { unixDate } = useParams<{ unixDate?: string }>();
  const { search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading: authLoading,
    refetch: refetchAuth,
  } = useAuth();

  // Track if we're waiting for data after a state change (prevents flickering)
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Determine if we need to fetch vote data via fallback
  // This happens when we have voteStatus but no brand data in todaysVote
  const needsFallbackData = useMemo(() => {
    if (!user) return false;

    const hasVoteStatus = user.todaysVoteStatus?.hasVoted;
    const hasVoteData =
      user.todaysVote?.brand1 &&
      user.todaysVote?.brand2 &&
      user.todaysVote?.brand3;

    // Need fallback if:
    // 1. We have a specific unixDate but no vote data, OR
    // 2. We have voteStatus indicating a vote exists but no brand data
    return (
      (unixDate && !user.todaysVote && !user.todaysVoteStatus) ||
      (hasVoteStatus &&
        !hasVoteData &&
        user.todaysVoteStatus?.day)
    );
  }, [user, unixDate]);

  // Determine which unixDate to use for fallback fetch
  const fallbackUnixDate = useMemo(() => {
    if (unixDate) return Number(unixDate);
    if (user?.todaysVoteStatus?.day) return user.todaysVoteStatus.day;
    return undefined;
  }, [unixDate, user?.todaysVoteStatus?.day]);

  const { data: fallbackVotes, isFetching: fallbackLoading } = useUserVotes(
    needsFallbackData ? fallbackUnixDate : undefined
  );

  // Get the best available vote data (prefer todaysVote, fallback to fetched data)
  const votes = useMemo(() => {
    return user?.todaysVote || fallbackVotes || null;
  }, [user?.todaysVote, fallbackVotes]);

  const voteStatus = user?.todaysVoteStatus;
  const hasTransactionHash = voteStatus?.transactionHash;
  // Since transaction hash IS the vote ID, we always have a vote ID when we have a transaction hash
  const hasVoteId = voteStatus?.voteId || voteStatus?.transactionHash || user?.todaysVote?.id;
  const isOptimisticUpdate = false; // No more optimistic updates since txHash IS the vote ID

  // Loading state: true if we're loading auth OR fetching fallback data
  const isLoading =
    authLoading ||
    (needsFallbackData && fallbackLoading);

  /**
   * Determines if the voting process was successful based on URL search parameters.
   * This is used to handle post-vote navigation.
   */
  const hasSuccessParam = useMemo<boolean>(
    () => new URLSearchParams(search).get("success") === "",
    [search]
  );

  /**
   * Determines the precise voting state based on user data.
   * This is the SINGLE SOURCE OF TRUTH for the 4 voting states.
   *
   * State determination priority (most specific to least):
   * 1. claimed - hasClaimed = true
   * 2. shared_not_claimed - hasShared = true, hasClaimed = false
   * 3. voted_not_shared - hasVoted = true, hasShared = false
   * 4. not_voted - hasVoted = false or no vote status
   */
  const votingState = useMemo((): VotingState => {
    // If we don't have user data yet, show loading
    if (!user) {
      return { type: "loading" };
    }

    const status = user.todaysVoteStatus;
    // Check brands from both todaysVote and votes (fallback)
    // Prioritize todaysVote (which includes optimistic updates) over fallback votes
    const brandData = user.todaysVote || votes;
    // Check if brands exist (from optimistic update or backend)
    const hasBrandData = !!(
      brandData?.brand1 &&
      brandData?.brand2 &&
      brandData?.brand3
    );
    const hasTransactionHash = status?.transactionHash;
    // Since transaction hash IS the vote ID, we always have a vote ID when we have a transaction hash
    const hasVoteId = status?.voteId || status?.transactionHash || user.todaysVote?.id || votes?.id;

    // No more optimistic updates since transaction hash IS the vote ID
    const isOptimisticUpdate = false;

    // PRIORITY 1: If we have vote status AND brand data, show the state immediately
    // This handles both optimistic updates (with brands) and backend data
    // Skip ALL loading checks - we have everything we need to determine the state
    // This must come BEFORE any loading checks to ensure immediate UI update
    if (status?.hasVoted && hasBrandData) {
      // We have everything we need - proceed directly to state determination below
      // The state checks below (lines 200, 213, 236) will catch the correct state
    }
    // PRIORITY 2: If we have an optimistic update (transaction hash), don't show loading
    // Even if we don't have brands yet, the PodiumView can show the transaction hash
    else if (isOptimisticUpdate) {
      // Optimistic update - continue to state determination below
      // Line 248 will handle this case
    }
    // PRIORITY 3: Only show loading if we're actually loading and don't have optimistic update
    // AND we don't have the data we need
    else if (authLoading && !isOptimisticUpdate && !hasBrandData) {
      // If we're loading auth data AND we don't have an optimistic update AND no brands, show loading
      return { type: "loading" };
    } else if (status?.hasVoted && !hasBrandData && !isOptimisticUpdate) {
      // If we have vote status but no brand data and we're not in an optimistic update
      // Only show loading if we're actually fetching fallback data
      if (needsFallbackData && fallbackLoading) {
        return { type: "loading" };
      }
      // If we don't have brands and we're not fetching, we might be in a race condition
      // But we should still try to show a state rather than infinite loading
    }

    // Extract transaction hashes from user data
    const voteTransactionHash = status?.transactionHash || null;
    const castHash = status?.castHash || null;

    // Extract claim transaction hash from contextualTransaction if it's a claim transaction
    const claimTransactionHash =
      user?.contextualTransaction?.transactionType === "claim"
        ? user.contextualTransaction.transactionHash
        : null;

    // Check if user has claimed (either via status or via contextualTransaction)
    // This handles the case where the claim transaction just completed but backend hasn't updated yet
    const hasClaimed =
      status?.hasClaimed || (claimTransactionHash && status?.hasShared);

    // State 4: Voted, shared, and claimed rewards ✅
    // This is the final state - user has completed everything
    if (hasClaimed && hasBrandData) {
      return {
        type: "claimed",
        voteId: status.voteId || status.transactionHash || user.todaysVote?.id || votes?.id || "", // Use transaction hash as vote ID
        voteTransactionHash,
        castHash,
        claimTransactionHash,
        brands: [brandData.brand2, brandData.brand1, brandData.brand3], // UI order: 2nd, 1st, 3rd
      };
    }

    // State 3: Voted and shared, but hasn't claimed rewards yet
    // User needs to claim their 10x BRND rewards
    if (status?.hasShared && status?.hasVoted && hasBrandData) {
      return {
        type: "shared_not_claimed",
        voteId: status.voteId || status.transactionHash || user.todaysVote?.id || votes?.id || "", // Use transaction hash as vote ID
        voteTransactionHash,
        castHash,
        brands: [brandData.brand2, brandData.brand1, brandData.brand3], // UI order: 2nd, 1st, 3rd
      };
    }

    // State 2: Voted but hasn't shared the cast
    // User needs to share their vote on Farcaster to unlock rewards
    // Allow this state even with optimistic update (has transaction hash but no voteId yet)
    // Use brandData which can come from either user.todaysVote or votes
    if (status?.hasVoted && hasBrandData) {
      return {
        type: "voted_not_shared",
        voteId: status.voteId || status.transactionHash || user.todaysVote?.id || votes?.id || "", // Use transaction hash as vote ID
        voteTransactionHash,
        brands: [brandData.brand2, brandData.brand1, brandData.brand3], // UI order: 2nd, 1st, 3rd
      };
    }

    // Since transaction hash IS the vote ID, we no longer need special optimistic update handling

    // State 1: Not voted today
    // User can vote on their top 3 brands
    return { type: "not_voted" };
  }, [user, votes, authLoading, needsFallbackData]);

  /**
   * Navigation function for components that need to trigger state updates.
   * After actions like voting or sharing, we invalidate queries to refresh state.
   *
   * @param _id - The view to navigate to
   * @param _selection - The brands array
   * @param _voteId - The vote ID
   * @param _transactionHash - Optional transaction hash from voting
   * @param _castHash - Optional cast hash from composeCast result
   */
  const navigateToView = useCallback(
    (
      _id: VotingViewEnum,
      _selection: Brand[],
      _voteId: string,
      _transactionHash?: string,
      _castHash?: string
    ) => {
      // Invalidate auth query to trigger state refresh
      // The state machine will automatically determine the correct view
      // The castHash will be available from todaysVoteStatus.castHash after backend processes it
      queryClient.invalidateQueries({ queryKey: ["auth"] });

      // If we're on a specific date route, ensure we stay on it
      if (unixDate) {
        navigate(`/vote/${unixDate}`, { replace: true });
      } else {
        const todayUnix = Math.floor(Date.now() / 1000);
        navigate(`/vote/${todayUnix}`, { replace: true });
      }
    },
    [queryClient, navigate, unixDate]
  );

  /**
   * Common props for all view components.
   * These props are passed to each view component based on the current state.
   *
   * Transaction hash mapping:
   * - State 2 (voted_not_shared): voteTransactionHash (from voting)
   * - State 3 (shared_not_claimed): voteTransactionHash + castHash
   * - State 4 (claimed): voteTransactionHash + castHash + claimTransactionHash
   */
  const viewProps = useMemo(() => {
    // Extract data based on state type
    if (votingState.type === "loading" || votingState.type === "not_voted") {
      return {
        navigateToView,
        currentView: VotingViewEnum.PODIUM,
        currentBrands: [] as Brand[],
        currentVoteId: "",
        voteTransactionHash: undefined as string | undefined,
        claimTransactionHash: undefined as string | undefined,
        castHash: undefined as string | undefined,
        // Legacy prop for backward compatibility
        transactionHash: undefined as string | undefined,
      };
    }

    // For states 2, 3, and 4, we have vote data
    const baseProps = {
      navigateToView,
      currentView:
        votingState.type === "voted_not_shared"
          ? VotingViewEnum.SHARE
          : votingState.type === "shared_not_claimed"
          ? VotingViewEnum.SHARE
          : VotingViewEnum.CONGRATS,
      currentBrands: votingState.brands,
      currentVoteId: votingState.voteId,
      voteTransactionHash: votingState.voteTransactionHash || undefined,
      // Legacy prop for backward compatibility (maps to voteTransactionHash)
      transactionHash: votingState.voteTransactionHash || undefined,
    };

    // State 4: Add castHash and claimTransactionHash
    if (votingState.type === "claimed") {
      return {
        ...baseProps,
        castHash: votingState.castHash || undefined,
        claimTransactionHash: votingState.claimTransactionHash || undefined,
      };
    }

    // State 3: Add castHash
    if (votingState.type === "shared_not_claimed") {
      return {
        ...baseProps,
        castHash: votingState.castHash || undefined,
      };
    }

    // State 2: Only voteTransactionHash (already in baseProps)
    return baseProps;
  }, [votingState, navigateToView]);

  /**
   * Auto-redirect: If user has voted today but no unixDate, redirect to today's vote
   * This ensures users always land on the correct date-specific vote page.
   */
  useEffect(() => {
    if (
      !isLoading &&
      !isTransitioning &&
      user?.hasVotedToday &&
      !unixDate &&
      (user?.todaysVote?.id || user?.todaysVoteStatus?.hasVoted)
    ) {
      const todayUnix =
        user?.todaysVoteStatus?.day || Math.floor(Date.now() / 1000);
      navigate(`/vote/${todayUnix}`, { replace: true });
    }
  }, [isLoading, isTransitioning, user, unixDate, navigate]);

  /**
   * Handle success parameter - clean up URL after successful vote
   * This removes the ?success parameter once we've transitioned to the share view
   */
  useEffect(() => {
    if (hasSuccessParam && votingState.type === "voted_not_shared") {
      // Clean up URL by removing success parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [hasSuccessParam, votingState.type]);

  /**
   * Monitor state transitions and handle data refresh
   * This ensures smooth transitions between states without flickering
   */
  useEffect(() => {
    // If we transition from loading to a real state, mark transition as complete
    if (votingState.type !== "loading" && isTransitioning) {
      setIsTransitioning(false);
    }

    // If we detect a state change that requires data refresh, trigger it
    if (votingState.type !== "loading" && votingState.type !== "not_voted") {
      // Only refetch if we don't have brand data
      const brandData = user?.todaysVote || votes;
      if (!brandData?.brand1 && voteStatus?.hasVoted) {
        setIsTransitioning(true);
        refetchAuth();
      }
    }
  }, [votingState.type, isTransitioning, votes, voteStatus, user, refetchAuth]);

  /**
   * Monitor for claim completion - when user claims rewards, ensure smooth transition to State 4
   * This handles the transition from State 3 (shared_not_claimed) to State 4 (claimed)
   */
  useEffect(() => {
    // If we're in State 3 and the user has just claimed, ensure we refresh data
    if (
      votingState.type === "shared_not_claimed" &&
      user?.todaysVoteStatus?.hasClaimed &&
      !isTransitioning
    ) {
      // User has claimed - refetch to get the claim transaction hash
      setIsTransitioning(true);
      refetchAuth();
    }
  }, [
    votingState.type,
    user?.todaysVoteStatus?.hasClaimed,
    isTransitioning,
    refetchAuth,
  ]);

  /**
   * Renders the appropriate view based on the current voting state.
   * This is the core state machine that determines the UI.
   *
   * State 1 (not_voted): PodiumView - User can vote on their top 3 brands
   * State 2 (voted_not_shared): ShareView - User must share their vote (shows voteTransactionHash)
   * State 3 (shared_not_claimed): AlreadySharedView - User must claim rewards (shows voteTransactionHash + castHash)
   * State 4 (claimed): CongratsView - User has completed everything (shows voteTransactionHash + castHash + claimTransactionHash)
   */
  const renderCurrentState = (): React.ReactNode => {
    switch (votingState.type) {
      case "loading":
        return <LoaderIndicator size={30} variant="fullscreen" />;

      case "not_voted":
        // State 1: User hasn't voted today - Show voting interface
        // User can select their top 3 brands and vote
        return <PodiumView {...viewProps} />;

      case "voted_not_shared":
        // State 2: User voted but hasn't shared - Show share interface
        // Displays: voteTransactionHash (from voting transaction)
        // User must share their vote on Farcaster to unlock 10x rewards
        return <ShareView {...viewProps} />;

      case "shared_not_claimed":
        // State 3: User voted and shared but hasn't claimed - Show claim interface
        // Displays: voteTransactionHash (from State 1) + castHash (from State 2)
        // User must claim their 10x BRND rewards
        return <AlreadySharedView {...viewProps} />;

      case "claimed":
        // State 4: User has completed the full flow - Show congratulations
        // Displays: voteTransactionHash + castHash + claimTransactionHash
        // User has successfully completed the entire voting and rewards flow
        return <CongratsView {...viewProps} />;

      default:
        // Fallback to voting interface if state is unclear
        // This should rarely happen, but provides a safe default
        return <PodiumView {...viewProps} />;
    }
  };

  // Redirect if trying to view a vote that doesn't exist and user hasn't voted today
  // This prevents users from accessing invalid vote pages
  if (
    !isLoading &&
    !isTransitioning &&
    unixDate &&
    !votes?.id &&
    !voteStatus?.hasVoted
  ) {
    return <Navigate to="/" replace />;
  }

  return renderCurrentState();
}

export default withProtectionRoute(VotePage, "only-connected");
