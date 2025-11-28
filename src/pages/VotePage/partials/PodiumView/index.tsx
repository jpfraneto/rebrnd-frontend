// Dependencies
import { useCallback, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatUnits } from "viem";
import { useConnect } from "wagmi";

// Hooks
import { Brand } from "@/hooks/brands";
import { useAuth } from "@/shared/hooks/auth";
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";

import QuestionMarkIcon from "@/shared/assets/icons/question-mark.svg?react";
import VoteHashIcon from "@/shared/assets/icons/vote-hash.svg?react";
import CheersIcon from "@/shared/assets/icons/cheers.svg?react";
import ExternalLinkIconShare from "@/shared/assets/icons/external-link-icon-share.svg?react";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import IconButton from "@/components/IconButton";

// Types
import { VotingViewProps } from "../../types";

// StyleSheet
import styles from "./PodiumView.module.scss";

// Assets
import Logo from "@/assets/images/logo.svg";
import GoBackIcon from "@/assets/icons/go-back-icon.svg?react";

// Hooks
import { ModalsIds, useModal } from "@/hooks/ui";
import sdk from "@farcaster/miniapp-sdk";

interface PodiumViewProps extends VotingViewProps {}

export default function PodiumView({}: PodiumViewProps) {
  const navigate = useNavigate();
  const { openModal } = useModal();
  const { data: authData, updateAuthData } = useAuth();
  const { connect, connectors, error: connectError } = useConnect();

  const [isVotingOnChain, setIsVotingOnChain] = useState(false);
  const [_voteCost, setVoteCost] = useState<string>("0");
  const [, setVotedBrands] = useState<Brand[] | null>(null);
  // Use ref to access current votedBrands in async callback
  const votedBrandsRef = useRef<Brand[] | null>(null);

  // Share and claim state
  const [isSharing, setIsSharing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimData, setClaimData] = useState<{
    castHash: string;
    claimSignature: {
      signature: string;
      amount: string;
      deadline: number;
      nonce: number;
      canClaim: boolean;
    };
    day: number;
  } | null>(null);

  const {
    userInfo,
    brndBalance,
    isConnected,
    hasVotedToday: hasVotedOnChain,
    vote: voteOnChain,
    getVoteCost,
    isPending,
    isConfirming,
    isApproving,
    isVoting,
    error: contractError,
    verifyShareAndGetClaimSignature,
    executeClaimReward,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    isLoadingBrndBalance,
  } = useStoriesInMotion(
    // onAuthorizeSuccess - after wallet authorization
    (txData) => {
      console.log("Wallet authorization successful!", txData);
      // Don't navigate away yet - authorization is just the first step
    },
    undefined, // onLevelUpSuccess
    // onVoteSuccess - after successful vote transaction
    async (txData) => {
      console.log("✅ [PodiumView] Blockchain vote successful!", txData);
      sdk.haptics.notificationOccurred("success");

      const txHash = txData?.txHash;

      if (!txHash) {
        console.error(
          "❌ [PodiumView] No transaction hash in vote success data"
        );
        setIsVotingOnChain(false);
        setVotedBrands(null);
        votedBrandsRef.current = null;
        return;
      }

      // Get the brands from ref (to avoid closure issues)
      const brands = votedBrandsRef.current;

      // Calculate today's day number
      const now = Math.floor(Date.now() / 1000);
      const day = Math.floor(now / 86400);

      // Optimistically update auth context immediately with vote transaction AND brands
      // This ensures UI updates instantly without waiting for backend
      // Include brands so VotePage doesn't need to fetch them
      updateAuthData({
        hasVotedToday: true,
        todaysVote:
          brands && brands.length >= 3
            ? {
                id: authData?.todaysVote?.id || "", // Will be updated by backend later
                date: new Date().toISOString(),
                brand1: brands[0], // 1st place (2nd in UI)
                brand2: brands[1], // 2nd place (1st in UI)
                brand3: brands[2], // 3rd place (3rd in UI)
              }
            : authData?.todaysVote || null,
        todaysVoteStatus: {
          hasVoted: true,
          hasShared: false,
          hasClaimed: false,
          voteId: txHash, // Use transaction hash as vote ID
          castHash: null,
          transactionHash: txHash,
          day: day,
        },
        contextualTransaction: {
          transactionHash: txHash,
          transactionType: "vote",
          day: day,
        },
      });

      // Don't navigate - stay on same screen, just update UI
      // Clear voting state but keep brands for display
      setIsVotingOnChain(false);
    },
    // onClaimSuccess - after successful claim transaction
    async (txData) => {
      console.log("✅ [PodiumView] Reward claim successful!", txData);
      sdk.haptics.notificationOccurred("success");

      const claimTxHash = txData?.txHash;
      if (!claimTxHash) {
        console.error(
          "❌ [PodiumView] No transaction hash in claim success data"
        );
        setIsClaiming(false);
        return;
      }

      const castHash =
        claimData?.castHash ||
        authData?.todaysVoteStatus?.castHash ||
        undefined;
      const now = Math.floor(Date.now() / 1000);
      const day = Math.floor(now / 86400);
      const rewardAmount = claimData?.claimSignature?.amount;
      const transactionHash =
        authData?.todaysVoteStatus?.transactionHash ||
        authData?.contextualTransaction?.transactionHash ||
        undefined;

      updateAuthData({
        todaysVoteStatus: {
          hasVoted: true,
          hasShared: true,
          hasClaimed: true,
          voteId: transactionHash || authData?.todaysVoteStatus?.voteId || null, // Use transaction hash as vote ID
          castHash: castHash || null,
          transactionHash: transactionHash || null,
          day: day,
        },
        contextualTransaction: {
          transactionHash: claimTxHash,
          transactionType: "claim",
          rewardAmount: rewardAmount,
          castHash: castHash,
          day: day,
        },
      });

      setIsClaiming(false);
      setClaimData(null);
    }
  );

  // Calculate vote cost when user info changes
  useEffect(() => {
    if (userInfo?.brndPowerLevel) {
      const cost = getVoteCost(userInfo.brndPowerLevel);
      setVoteCost(parseFloat(formatUnits(cost, 18)).toFixed(2));
    }
  }, [userInfo, getVoteCost]);

  // No need to check claim status - we use todaysVoteStatus from /me endpoint

  /**
   * Validates the selected brands before submitting vote.
   *
   * @param {Brand[]} brands - Array of selected brands
   * @returns {boolean} Whether the brands are valid for voting
   */
  const validateBrands = useCallback(
    (brands: Brand[]): boolean => {
      // Check if we have exactly 3 brands
      if (brands.length !== 3) {
        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Invalid Selection",
          content: (
            <Typography>
              Please select exactly 3 brands for your podium.
            </Typography>
          ),
        });
        return false;
      }

      // Check if all brands are different
      const brandIds = brands.map((brand) => brand.id);
      const uniqueIds = new Set(brandIds);
      if (uniqueIds.size !== 3) {
        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Duplicate Selection",
          content: (
            <Typography>
              Please select 3 different brands for your podium.
            </Typography>
          ),
        });
        return false;
      }

      // Check if user has already voted today (backend check)
      if (authData?.hasVotedToday) {
        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Already Voted",
          content: (
            <Typography>
              You have already voted today. Come back tomorrow to vote again!
            </Typography>
          ),
        });
        return false;
      }

      // Check if user has already voted on-chain today
      if (hasVotedOnChain) {
        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Already Voted On-Chain",
          content: (
            <Typography>
              You have already voted on-chain today. Come back tomorrow to vote
              again!
            </Typography>
          ),
        });
        return false;
      }

      return true;
    },
    [openModal, authData, hasVotedOnChain]
  );

  /**
   * Determines the voting strategy and user's voting eligibility
   * Updated for V4 contract: ALL users must pay BRND to vote (minimum 100 BRND)
   */
  const determineVotingStrategy = useCallback(() => {
    const powerLevel = userInfo?.brndPowerLevel || 0;
    const balance = parseFloat(brndBalance || "0");
    const requiredAmount = parseFloat(formatUnits(getVoteCost(powerLevel), 18));

    if (!isConnected) {
      return {
        strategy: "connect-wallet",
        canVote: false,
        reason: "Connect your wallet to start voting",
        requiredAmount,
        currentBalance: balance,
      };
    }

    if (balance < requiredAmount) {
      return {
        strategy: "insufficient-brnd",
        canVote: false,
        reason: `You need ${requiredAmount.toFixed(
          0
        )} BRND to vote. Buy BRND tokens to participate.`,
        requiredAmount,
        currentBalance: balance,
      };
    }

    return {
      strategy: "on-chain",
      canVote: true,
      reason: `Ready to vote with ${requiredAmount.toFixed(0)} BRND`,
      requiredAmount,
      currentBalance: balance,
    };
  }, [userInfo?.brndPowerLevel, brndBalance, isConnected, getVoteCost]);

  /**
   * Handles wallet connection using wagmi's useConnect with Farcaster Mini App connector
   */
  const handleWalletConnection = useCallback(async () => {
    try {
      console.log("connecting wallet");
      // Check if wallet is already connected
      if (isConnected) {
        console.log("wallet already connected");
        return true;
      }

      // Use wagmi's useConnect with Farcaster Mini App connector
      if (!connectors || connectors.length === 0) {
        throw new Error("No wallet connectors available");
      }

      // Connect using the first connector (Farcaster Mini App connector)
      connect({ connector: connectors[0] });

      // Note: The connection is async, but wagmi will handle the state updates
      // The isConnected state will update automatically when connection succeeds
      // If there's an error, it will be available in connectError
      return true;
    } catch (error: any) {
      console.error("Wallet connection failed:", error);

      // Show user-friendly error message
      openModal(ModalsIds.BOTTOM_ALERT, {
        title: "Wallet Connection Failed",
        content: (
          <div>
            <Typography>
              Unable to connect your wallet. Please try again.
            </Typography>
            <br />
            <Typography size={12}>
              {error.message || "Unknown error occurred"}
            </Typography>
          </div>
        ),
      });

      return false;
    }
  }, [isConnected, connect, connectors, openModal]);

  // Handle connection errors from useConnect
  useEffect(() => {
    if (connectError) {
      console.error("Wallet connection error:", connectError);
      openModal(ModalsIds.BOTTOM_ALERT, {
        title: "Wallet Connection Failed",
        content: (
          <div>
            <Typography>
              Unable to connect your wallet. Please try again.
            </Typography>
            <br />
            <Typography size={12}>
              {connectError.message || "Unknown error occurred"}
            </Typography>
          </div>
        ),
      });
    }
  }, [connectError, openModal]);

  /**
   * Handles the submission of votes for the selected brands.
   * Updated for V4 contract with improved authorization and approval flow.
   */
  const handleSubmitVote = useCallback(
    async (brands: Brand[]) => {
      // Validate brands before submission
      if (!validateBrands(brands)) {
        return;
      }

      // Add haptic feedback
      sdk.haptics.selectionChanged();

      try {
        const votingStatus = determineVotingStrategy();
        console.log("votingStatus", votingStatus);
        const brandIds: [number, number, number] = [
          brands[1].id, // 1st place
          brands[0].id, // 2nd place
          brands[2].id, // 3rd place
        ];

        console.log(`Voting status:`, votingStatus);

        // In V4 contract: ALL voting requires BRND payment - no backend-only voting
        if (votingStatus.strategy !== "on-chain") {
          // This should not happen as validation should catch it, but handle gracefully
          throw new Error(votingStatus.reason);
        }

        // All users must vote on-chain with BRND payment
        setIsVotingOnChain(true);

        // Store brands for navigation after successful vote (both state and ref)
        setVotedBrands(brands);
        votedBrandsRef.current = brands;

        // Ensure wallet is connected
        const walletConnected = await handleWalletConnection();
        if (!walletConnected) {
          setIsVotingOnChain(false);
          setVotedBrands(null);
          votedBrandsRef.current = null;
          return;
        }

        // Submit on-chain vote - V4 contract handles authorization inline
        console.log("Submitting blockchain vote with brand IDs:", brandIds);
        await voteOnChain(brandIds);

        // Success handling is now done in the onVoteSuccess callback
      } catch (error: any) {
        console.error("❌ [PodiumView] Voting error:", error);

        setIsVotingOnChain(false);
        setVotedBrands(null);
        votedBrandsRef.current = null;

        // Show appropriate error feedback
        sdk.haptics.notificationOccurred("error");

        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Vote Failed",
          content: (
            <div>
              <Typography>
                Failed to submit your vote. Please try again.
              </Typography>
              {error.message && (
                <>
                  <br />
                  <Typography size={12}>Error: {error.message}</Typography>
                </>
              )}
              <br />
              <Typography size={12}>
                💡 Make sure you have enough BRND tokens and try again.
              </Typography>
            </div>
          ),
        });
      }
    },
    [
      validateBrands,
      determineVotingStrategy,
      handleWalletConnection,
      voteOnChain,
      openModal,
    ]
  );

  /**
   * Gets the appropriate action button based on voting status
   */
  const getNextAction = useCallback(() => {
    const votingStatus = determineVotingStrategy();

    if (votingStatus.strategy === "connect-wallet") {
      return {
        label: "🔗 Connect Wallet",
        description: "Connect your wallet to start voting",
        action: () => {
          sdk.haptics.selectionChanged();
          handleWalletConnection();
        },
        variant: "primary" as const,
      };
    }

    if (votingStatus.strategy === "insufficient-brnd") {
      return {
        label: "💰 Get $BRND",
        description: `You Need ${votingStatus.requiredAmount.toFixed(
          0
        )} tokens to vote onchain.`,
        action: () => {
          sdk.haptics.selectionChanged();
          sdk.actions.swapToken({
            sellToken:
              "eip155:8453/erc20:0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            buyToken:
              "eip155:8453/erc20:0x41Ed0311640A5e489A90940b1c33433501a21B07",
            sellAmount: votingStatus.requiredAmount.toString(),
          });
        },
        variant: "primary" as const,
      };
    }

    // Default action for users who can vote
    return {
      label: "🗳️ Vote Now",
      description: "Ready to vote",
      action: () => {
        // Action is handled by handleSubmitVote
        sdk.haptics.notificationOccurred("success");
      },
      variant: "primary" as const,
    };
  }, [determineVotingStrategy, handleWalletConnection, navigate]);

  /**
   * Handles sharing the cast on Farcaster
   */
  const handleShare = useCallback(async () => {
    if (isSharing || isVerifying) return;

    const brands =
      votedBrandsRef.current ||
      (authData?.todaysVote?.brand1
        ? [
            authData.todaysVote.brand2!,
            authData.todaysVote.brand1!,
            authData.todaysVote.brand3!,
          ]
        : null);

    if (!brands || brands.length < 3) {
      openModal(ModalsIds.BOTTOM_ALERT, {
        title: "Error",
        content: <Typography>No brands available to share</Typography>,
      });
      return;
    }

    setIsSharing(true);

    try {
      const getProfileOrChannel = (brand: any) => {
        return brand?.profile || brand?.channel || brand?.name || "Unknown";
      };

      const profile1 = getProfileOrChannel(brands[1]);
      const profile2 = getProfileOrChannel(brands[0]);
      const profile3 = getProfileOrChannel(brands[2]);

      const castText = `I just created my @brnd podium of today:\n\n🥇${brands[1]?.name} - ${profile1}\n🥈${brands[0]?.name} - ${profile2}\n🥉${brands[2]?.name} - ${profile3}`;

      const transactionHash =
        authData?.todaysVoteStatus?.transactionHash ||
        authData?.contextualTransaction?.transactionHash ||
        "";
      const embedUrl = `https://brnd.land?txHash=${transactionHash}`;

      const castResponse = await sdk.actions.composeCast({
        text: castText,
        embeds: [embedUrl],
      });

      if (castResponse && castResponse.cast?.hash) {
        setIsSharing(false);
        setIsVerifying(true);

        const castHash = castResponse.cast?.hash;
        const voteId = transactionHash || ""; // Use transaction hash as vote ID

        try {
          const verificationResult = await verifyShareAndGetClaimSignature(
            castHash,
            voteId,
            transactionHash || undefined
          );

          setClaimData({
            castHash,
            claimSignature: verificationResult.claimSignature,
            day: verificationResult.day,
          });

          const now = Math.floor(Date.now() / 1000);
          const day = Math.floor(now / 86400);

          updateAuthData({
            todaysVoteStatus: {
              hasVoted: true,
              hasShared: true,
              hasClaimed: false,
              voteId: transactionHash || null, // Use transaction hash as vote ID
              castHash: castHash,
              transactionHash: transactionHash || null,
              day: day,
            },
            contextualTransaction: {
              transactionHash: null,
              transactionType: null,
              castHash: castHash,
              day: day,
            },
          });

          setIsVerifying(false);
        } catch (error: any) {
          console.error("❌ [PodiumView] Share verification failed:", error);
          setIsVerifying(false);
          openModal(ModalsIds.BOTTOM_ALERT, {
            title: "Share Verification Failed",
            content: (
              <Typography>
                {error.message || "Failed to verify share. Please try again."}
              </Typography>
            ),
          });
        }
      } else {
        openModal(ModalsIds.BOTTOM_ALERT, {
          title: "Share Failed",
          content: (
            <Typography>Share was not completed. Please try again.</Typography>
          ),
        });
        setIsSharing(false);
      }
    } catch (error: any) {
      console.error("❌ [PodiumView] Share error:", error);
      openModal(ModalsIds.BOTTOM_ALERT, {
        title: "Share Failed",
        content: (
          <Typography>Failed to share cast. Please try again.</Typography>
        ),
      });
      setIsSharing(false);
    }
  }, [
    isSharing,
    isVerifying,
    authData,
    verifyShareAndGetClaimSignature,
    updateAuthData,
    openModal,
  ]);

  /**
   * Handles claiming rewards
   */
  const handleClaim = useCallback(async () => {
    if (!claimData || isClaiming || isClaimPending || isClaimConfirming) {
      return;
    }

    setIsClaiming(true);

    try {
      await executeClaimReward(
        claimData.castHash,
        claimData.claimSignature,
        claimData.day
      );
    } catch (error: any) {
      console.error("❌ [PodiumView] Claim failed:", error);
      setIsClaiming(false);
      openModal(ModalsIds.BOTTOM_ALERT, {
        title: "Claim Failed",
        content: (
          <Typography>
            {error.message || "Failed to claim reward. Please try again."}
          </Typography>
        ),
      });
    }
  }, [
    claimData,
    isClaiming,
    isClaimPending,
    isClaimConfirming,
    executeClaimReward,
    openModal,
  ]);

  /**
   * Handles the button click from the Podium component.
   * Checks voting status and either submits vote, shares, claims, or handles wallet/BRND actions.
   */
  const handlePodiumButtonClick = useCallback(
    (brands: Brand[]) => {
      // If user has shared, handle claim
      if (
        authData?.todaysVoteStatus?.hasShared &&
        !authData?.todaysVoteStatus?.hasClaimed
      ) {
        handleClaim();
        return;
      }

      // If user has voted, handle share
      if (authData?.todaysVoteStatus?.hasVoted || hasVotedOnChain) {
        handleShare();
        return;
      }

      // Otherwise, handle vote
      const votingStatus = determineVotingStrategy();

      // If user needs to connect wallet or get BRND, handle that first
      if (
        votingStatus.strategy === "connect-wallet" ||
        votingStatus.strategy === "insufficient-brnd"
      ) {
        const nextAction = getNextAction();
        nextAction.action();
        return;
      }

      // Otherwise, submit the vote
      handleSubmitVote(brands);
    },
    [
      authData,
      hasVotedOnChain,
      handleClaim,
      handleShare,
      determineVotingStrategy,
      getNextAction,
      handleSubmitVote,
    ]
  );

  /**
   * Handles the click event for the "How to Score" button.
   */
  const handleClickHowToScore = useCallback(() => {
    sdk.haptics.selectionChanged();

    openModal(ModalsIds.BOTTOM_ALERT, {
      title: "BRND Voting Rules & Rewards",
      content: (
        <div className={styles.list}>
          <Typography size={13} lineHeight={16} weight="medium">
            📊 SCORING SYSTEM
          </Typography>
          <Typography size={12} lineHeight={14}>
            🥇 1st: 60% • 🥈 2nd: 30% • 🥉 3rd: 10%
          </Typography>
          <Typography size={11} lineHeight={13}>
            Brands receive BRND tokens based on podium position
          </Typography>

          <Typography size={13} lineHeight={16} weight="medium">
            💸 VOTE COST
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Base cost: 100 $BRND (Level 0-1)
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Scales with BRND Power Level
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Level 1: 150 $BRND • Level 2: 200 $BRND • Level 3: 300 $BRND •
            Level 4: 400 $BRND • Level 5: 500 $BRND • Level 6: 600 $BRND • Level
            7: 700 $BRND • Level 8: 800 $BRND (max)
          </Typography>

          <Typography size={13} lineHeight={16} weight="medium">
            💰 REWARDS
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Earn 10x your vote cost back
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Example: 100 $BRND vote → 1,000 $BRND reward
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Claim rewards after creating your podium and sharing it as a cast
          </Typography>

          <Typography size={13} lineHeight={16} weight="medium">
            ⏰ VOTING SCHEDULE
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Once per day • Resets at midnight UTC
          </Typography>
          <Typography size={11} lineHeight={13}>
            • All votes recorded on Base blockchain
          </Typography>
          <Typography size={11} lineHeight={13}>
            • Leaderboard updates in real-time
          </Typography>
        </div>
      ),
    });
  }, [openModal]);

  return (
    <div className={styles.body}>
      <motion.div
        className={styles.container}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        <IconButton
          variant={"solid"}
          icon={<GoBackIcon />}
          onClick={() => navigate("/")}
          className={styles.backBtn}
        />
        <div className={styles.center}>
          <img src={Logo} className={styles.logo} alt="Logo" />
          <Typography
            size={18}
            lineHeight={24}
            variant={"druk"}
            weight={"text-wide"}
          >
            {authData?.todaysVoteStatus?.hasClaimed
              ? "Rewards Claimed!"
              : authData?.todaysVoteStatus?.hasShared
              ? "Already voted and shared!"
              : authData?.todaysVoteStatus?.hasVoted || hasVotedOnChain
              ? "Already voted today!"
              : "Add your top brands on this podium"}
          </Typography>

          {/* Show transaction chips - clean layout like CongratsView */}
          {(authData?.todaysVoteStatus?.hasVoted ||
            authData?.todaysVoteStatus?.hasShared ||
            authData?.contextualTransaction?.transactionType === "claim") && (
            <div className={styles.transactionsContainer}>
              {/* Show vote transaction if available */}
              {authData?.todaysVoteStatus?.transactionHash && (
                <div className={styles.transactionChip}>
                  <div className={styles.transactionHeader}>
                    <span className={styles.transactionIcon}>
                      <VoteHashIcon />
                    </span>
                    <span className={styles.transactionText}>
                      Vote Txn:{" "}
                      {authData.todaysVoteStatus.transactionHash.slice(0, 6)}...
                      {authData.todaysVoteStatus.transactionHash.slice(-4)}
                    </span>
                    <a
                      href={`https://basescan.org/tx/${authData.todaysVoteStatus.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.txLink}
                      title="View on Base Explorer"
                    >
                      <ExternalLinkIconShare />
                    </a>
                  </div>
                </div>
              )}

              {/* Show claim transaction if available */}
              {authData?.contextualTransaction?.transactionType === "claim" &&
                authData?.contextualTransaction?.transactionHash && (
                  <div className={styles.transactionChip}>
                    <div className={styles.transactionHeader}>
                      <span className={styles.transactionIcon}>
                        <CheersIcon />
                      </span>
                      <span className={styles.transactionText}>
                        Claim Txn:{" "}
                        {authData.contextualTransaction.transactionHash.slice(
                          0,
                          6
                        )}
                        ...
                        {authData.contextualTransaction.transactionHash.slice(
                          -4
                        )}
                      </span>
                      <a
                        href={`https://basescan.org/tx/${authData.contextualTransaction.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.txLink}
                        title="View on Base Explorer"
                      >
                        <ExternalLinkIconShare />
                      </a>
                    </div>
                  </div>
                )}
            </div>
          )}
          <span onClick={handleClickHowToScore}>
            <Typography
              variant="geist"
              weight="medium"
              size={12}
              lineHeight={16}
              className={styles.howToScoreBtn}
            >
              How Onchain Voting & Rewards Work{" "}
              <span className={styles.questionMarkIcon}>
                <QuestionMarkIcon />
              </span>
            </Typography>
          </span>

          {/* Show insufficient balance warning */}
          {(() => {
            const votingStatus = determineVotingStrategy();
            // Only show insufficient balance warning when:
            // 1. Balance data has finished loading (not while loading)
            // 2. User hasn't voted yet
            // 3. Strategy is actually "insufficient-brnd" 
            if (
              !isLoadingBrndBalance && // Wait for balance to load
              votingStatus.strategy === "insufficient-brnd" &&
              !hasVotedOnChain
            ) {
              return (
                <div className={styles.insufficientBalanceSection}>
                  <Typography
                    size={14}
                    lineHeight={18}
                    weight="medium"
                    textAlign="center"
                  >
                    ⚠️ Insufficient BRND Balance
                  </Typography>
                  <Typography size={12} lineHeight={16} textAlign="center">
                    You need {votingStatus.requiredAmount.toFixed(0)} BRND to
                    vote
                  </Typography>
                  <Typography size={11} lineHeight={14} textAlign="center">
                    Current balance: {votingStatus.currentBalance.toFixed(2)}{" "}
                    BRND
                  </Typography>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </motion.div>
      {/* Always show podium - button changes based on state */}
      <Podium
        onVote={handlePodiumButtonClick}
        variant={
          authData?.todaysVoteStatus?.hasVoted || hasVotedOnChain
            ? "readonly"
            : "selection"
        }
        initial={
          authData?.todaysVote
            ? [
                authData.todaysVote.brand2!,
                authData.todaysVote.brand1!,
                authData.todaysVote.brand3!,
              ]
            : undefined
        }
        buttonLabel={(() => {
          // If user has claimed, show claimed state
          if (authData?.todaysVoteStatus?.hasClaimed) {
            return "✅ Claimed";
          }

          // If user has shared, show claim button
          if (authData?.todaysVoteStatus?.hasShared) {
            if (isClaiming || isClaimPending || isClaimConfirming) {
              if (isClaimPending) return "⏳ Confirm in wallet...";
              if (isClaimConfirming) return "🔄 Processing...";
              return "💰 Claiming...";
            }
            if (claimData) {
              const claimAmount = parseFloat(
                formatUnits(BigInt(claimData.claimSignature.amount), 18)
              );
              return `Claim ${claimAmount.toFixed(0)} $BRND`;
            }
            return "Claim";
          }

          // If user has voted, show share button
          if (authData?.todaysVoteStatus?.hasVoted || hasVotedOnChain) {
            if (isSharing) return "Sharing...";
            if (isVerifying) return "Verifying Share";
            return "Share now";
          }

          // Otherwise, show vote button with status
          const nextAction = getNextAction();
          let buttonLabel = nextAction.label;

          const hasApprovalError =
            contractError &&
            (isApproving ||
              contractError.toLowerCase().includes("approval") ||
              contractError.toLowerCase().includes("approve")) &&
            !isPending &&
            !isConfirming;
          const hasVotingError =
            contractError &&
            (isVoting || contractError.toLowerCase().includes("vote")) &&
            !isPending &&
            !isConfirming;
          const hasGeneralError =
            contractError &&
            !isPending &&
            !isConfirming &&
            !isApproving &&
            !isVoting;

          if (isApproving) {
            if (hasApprovalError) {
              buttonLabel = "❌ Approval Failed - Try Again";
            } else if (isPending) {
              buttonLabel = "⏳ Approve BRND spending...";
            } else if (isConfirming) {
              buttonLabel = "🔄 Approving BRND spending...";
            } else {
              buttonLabel = "✅ Approval Complete - Preparing vote...";
            }
          } else if (isVoting) {
            if (hasVotingError) {
              buttonLabel = "❌ Vote Failed - Try Again";
            } else if (isPending) {
              buttonLabel = "⏳ Confirm in wallet...";
            } else if (isConfirming) {
              buttonLabel = "🔄 Processing vote...";
            } else {
              buttonLabel = "🗳️ Vote Now";
            }
          } else if (hasApprovalError || hasGeneralError) {
            buttonLabel = "❌ Transaction Failed - Try Again";
          } else if (isPending || isConfirming) {
            if (isPending) {
              buttonLabel = "⏳ Confirm transaction in wallet...";
            } else if (isConfirming) {
              buttonLabel = "🔄 Processing transaction...";
            } else {
              buttonLabel = nextAction.label;
            }
          } else if (isVotingOnChain) {
            if (isPending) {
              buttonLabel = "⏳ Confirm in wallet...";
            } else if (isConfirming) {
              buttonLabel = "🔄 Processing vote...";
            } else {
              buttonLabel = "🔄 Completing vote...";
            }
          }

          return buttonLabel;
        })()}
        buttonDisabled={(() => {
          // If claimed, disable button
          if (authData?.todaysVoteStatus?.hasClaimed) {
            return true;
          }

          // If shared, disable only during claim operations
          if (authData?.todaysVoteStatus?.hasShared) {
            return isClaiming || isClaimPending || isClaimConfirming;
          }

          // If voted, disable only during share operations
          if (authData?.todaysVoteStatus?.hasVoted || hasVotedOnChain) {
            return isSharing || isVerifying;
          }

          // Otherwise, use vote button disabled logic
          let buttonDisabled = false;
          const hasApprovalError =
            contractError &&
            (isApproving ||
              contractError.toLowerCase().includes("approval") ||
              contractError.toLowerCase().includes("approve")) &&
            !isPending &&
            !isConfirming;
          const hasVotingError =
            contractError &&
            (isVoting || contractError.toLowerCase().includes("vote")) &&
            !isPending &&
            !isConfirming;
          const hasGeneralError =
            contractError &&
            !isPending &&
            !isConfirming &&
            !isApproving &&
            !isVoting;

          if (isApproving) {
            buttonDisabled = (isPending || isConfirming) && !hasApprovalError;
          } else if (isVoting) {
            buttonDisabled = (isPending || isConfirming) && !hasVotingError;
          } else if (hasApprovalError || hasGeneralError) {
            buttonDisabled = false;
          } else if (isPending || isConfirming) {
            buttonDisabled = isPending || isConfirming;
          } else if (isVotingOnChain) {
            buttonDisabled = true;
          }

          return buttonDisabled;
        })()}
        buttonVariant={(() => {
          const nextAction = getNextAction();
          return nextAction.variant;
        })()}
      />
    </div>
  );
}
