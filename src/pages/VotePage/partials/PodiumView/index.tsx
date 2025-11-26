// Dependencies
import { useCallback, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useConnect } from "wagmi";

// Hooks
import { Brand } from "@/hooks/brands";
import { useAuth } from "@/shared/hooks/auth";
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";

import QuestionMarkIcon from "@/shared/assets/icons/question-mark.svg?react";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import IconButton from "@/components/IconButton";
import Button from "@/components/Button";

// Types
import { VotingViewProps, VotingViewEnum } from "../../types";

// StyleSheet
import styles from "./PodiumView.module.scss";

// Assets
import Logo from "@/assets/images/logo.svg";
import GoBackIcon from "@/assets/icons/go-back-icon.svg?react";

// Hooks
import { ModalsIds, useModal } from "@/hooks/ui";
import sdk from "@farcaster/miniapp-sdk";

interface PodiumViewProps extends VotingViewProps {}

export default function PodiumView({ navigateToView }: PodiumViewProps) {
  const navigate = useNavigate();
  const { openModal } = useModal();
  const queryClient = useQueryClient();
  const { data: authData, refetch: refetchAuth } = useAuth();
  const { connect, connectors, error: connectError } = useConnect();

  const [isVotingOnChain, setIsVotingOnChain] = useState(false);
  const [_voteCost, setVoteCost] = useState<string>("0");
  const [, setVotedBrands] = useState<Brand[] | null>(null);
  // Use ref to access current votedBrands in async callback
  const votedBrandsRef = useRef<Brand[] | null>(null);

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
  } = useStoriesInMotion(
    // onAuthorizeSuccess - after wallet authorization
    (txData) => {
      console.log("Wallet authorization successful!", txData);
      // Don't navigate away yet - authorization is just the first step
    },
    undefined, // onLevelUpSuccess
    // onVoteSuccess - after successful vote transaction
    async (txData) => {
      console.log("Blockchain vote successful!", txData);
      // Keep isVotingOnChain true until navigation completes to prevent button from showing "vote now" again

      // Invalidate and refetch auth query to get updated vote data
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      sdk.haptics.notificationOccurred("success");

      // Get the brands from ref (to avoid closure issues)
      const brands = votedBrandsRef.current;
      const txHash = txData?.txHash;

      // Wait for auth data to refresh with the new vote
      // Retry up to 5 times with increasing delays
      let retries = 0;
      const maxRetries = 5;
      const checkAuthData = async () => {
        const { data: updatedAuth } = await refetchAuth();

        // Check for voteId in todaysVoteStatus (more reliable than todaysVote)
        const voteId =
          updatedAuth?.todaysVoteStatus?.voteId || updatedAuth?.todaysVote?.id;

        if (voteId && brands) {
          // We have the vote ID and brands - navigate directly to ShareView
          const brandOrder = [
            brands[1], // 2nd place (1st in UI)
            brands[0], // 1st place (2nd in UI)
            brands[2], // 3rd place (3rd in UI)
          ];

          navigateToView?.(
            VotingViewEnum.SHARE,
            brandOrder,
            voteId,
            txHash || updatedAuth.todaysVoteStatus?.transactionHash,
            undefined // castHash not available yet at this point
          );

          // Clear voted brands and reset voting state only after navigation
          setVotedBrands(null);
          votedBrandsRef.current = null;
          setIsVotingOnChain(false);
        } else if (retries < maxRetries) {
          // Wait a bit longer and retry
          retries++;
          setTimeout(checkAuthData, 500 * retries);
        } else {
          // Fallback: navigate to vote page with success flag
          // The VotePage will handle showing the correct view
          const todayUnix = Math.floor(Date.now() / 1000);
          navigate(`/vote/${todayUnix}?success`);
          setVotedBrands(null);
          votedBrandsRef.current = null;
          setIsVotingOnChain(false);
        }
      };

      // Start checking after a short delay
      setTimeout(checkAuthData, 500);
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
   * Handles the button click from the Podium component.
   * Checks voting status and either submits vote or handles wallet/BRND actions.
   */
  const handlePodiumButtonClick = useCallback(
    (brands: Brand[]) => {
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
    [determineVotingStrategy, getNextAction, handleSubmitVote]
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
            Add your top brands on this podium
          </Typography>
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

          {/* Show appropriate message for users who have already voted */}
          {hasVotedOnChain && (
            <div className={styles.alreadyVotedSection}>
              {authData?.todaysVoteStatus?.hasClaimed ? (
                <>
                  <Typography
                    size={14}
                    lineHeight={18}
                    weight="medium"
                    textAlign="center"
                  >
                    ✅ Rewards Claimed!
                  </Typography>
                  <Typography size={12} lineHeight={16} textAlign="center">
                    You claimed your rewards and come back tomorrow to vote
                    again
                  </Typography>
                </>
              ) : authData?.todaysVoteStatus?.hasShared ? (
                <>
                  <Typography
                    size={14}
                    lineHeight={18}
                    weight="medium"
                    textAlign="center"
                  >
                    🎯 Already voted today!
                  </Typography>
                  <Typography size={12} lineHeight={16} textAlign="center">
                    Your cast was shared. Claim your 10x BRND rewards!
                  </Typography>
                </>
              ) : (
                <>
                  <Typography
                    size={14}
                    lineHeight={18}
                    weight="medium"
                    textAlign="center"
                  >
                    🎯 Already voted today!
                  </Typography>
                  <Typography size={12} lineHeight={16} textAlign="center">
                    Share your cast on Farcaster to unlock your 10x BRND rewards
                  </Typography>
                  {/* Show share button if user has voted but not shared */}
                  {!authData?.todaysVoteStatus?.hasShared &&
                    authData?.todaysVote &&
                    authData.todaysVote.brand1 &&
                    authData.todaysVote.brand2 &&
                    authData.todaysVote.brand3 && (
                      <div className={styles.shareButtonContainer}>
                        <Button
                          variant="primary"
                          caption="Share Your Vote"
                          onClick={() => {
                            sdk.haptics.selectionChanged();
                            // Get brand data from today's vote
                            const brandOrder = [
                              authData.todaysVote!.brand2!,
                              authData.todaysVote!.brand1!,
                              authData.todaysVote!.brand3!,
                            ]; // UI order: 2nd, 1st, 3rd
                            navigateToView?.(
                              VotingViewEnum.SHARE,
                              brandOrder,
                              authData.todaysVote!.id,
                              authData.todaysVoteStatus?.transactionHash ||
                                undefined
                            );
                          }}
                        />
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* Show insufficient balance warning */}
          {(() => {
            const votingStatus = determineVotingStrategy();
            if (
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
      {/* Hide podium if user has already voted */}
      {!hasVotedOnChain && (
        <Podium
          onVote={handlePodiumButtonClick}
          variant="selection"
          buttonLabel={(() => {
            // Show appropriate button based on current operation
            const nextAction = getNextAction();
            let buttonLabel = nextAction.label;

            // Check if there's an error (check both current operation and general error state)
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

            // Update button label based on current operation with detailed status messages
            if (isApproving) {
              if (hasApprovalError) {
                // Approval failed - show error state
                buttonLabel = "❌ Approval Failed - Try Again";
              } else if (isPending) {
                buttonLabel = "⏳ Approve BRND spending...";
              } else if (isConfirming) {
                buttonLabel = "🔄 Approving BRND spending...";
              } else {
                // Approval succeeded, waiting for vote to start
                buttonLabel = "✅ Approval Complete - Preparing vote...";
              }
            } else if (isVoting) {
              if (hasVotingError) {
                // Voting failed - show error state
                buttonLabel = "❌ Vote Failed - Try Again";
              } else if (isPending) {
                buttonLabel = "⏳ Confirm in wallet...";
              } else if (isConfirming) {
                buttonLabel = "🔄 Processing vote...";
              } else {
                buttonLabel = "🗳️ Vote Now";
              }
            } else if (hasApprovalError || hasGeneralError) {
              // Show error state if there was an approval error or general error
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
              // Keep showing processing state until transition completes
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
            let buttonDisabled = false;

            // Check if there's an error (check both current operation and general error state)
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

            // Update button disabled state based on current operation
            if (isApproving) {
              // Don't disable if there's an error - allow retry
              buttonDisabled = (isPending || isConfirming) && !hasApprovalError;
            } else if (isVoting) {
              // Don't disable if there's an error - allow retry
              buttonDisabled = (isPending || isConfirming) && !hasVotingError;
            } else if (hasApprovalError || hasGeneralError) {
              // Don't disable if there's an error - allow retry
              buttonDisabled = false;
            } else if (isPending || isConfirming) {
              buttonDisabled = isPending || isConfirming;
            } else if (isVotingOnChain) {
              // Keep button disabled until transition completes
              buttonDisabled = true;
            }

            return buttonDisabled;
          })()}
          buttonVariant={(() => {
            const nextAction = getNextAction();
            return nextAction.variant;
          })()}
        />
      )}
    </div>
  );
}
