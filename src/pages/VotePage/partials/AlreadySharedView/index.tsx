import { useCallback, useState, useEffect } from "react";
import { formatUnits } from "viem";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

// Hooks
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { useAuth } from "@/shared/hooks/auth";

// Types
import { VotingViewProps } from "../../types";

// StyleSheet
import styles from "./AlreadySharedView.module.scss";

// Assets
import Logo from "@/assets/images/logo.svg";
import sdk from "@farcaster/miniapp-sdk";
import VoteHashIcon from "@/shared/assets/icons/vote-hash.svg?react";
import ExternalLinkIconShare from "@/shared/assets/icons/external-link-icon-share.svg?react";

interface AlreadySharedViewProps extends VotingViewProps {}

export default function AlreadySharedView({
  currentBrands,
  currentVoteId,
  transactionHash,
  castHash,
}: AlreadySharedViewProps) {
  const { data: authData, updateAuthData } = useAuth();

  const {
    getClaimSignatureForSharedVote,
    executeClaimReward,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    error: contractError,
  } = useStoriesInMotion(
    undefined, // onAuthorizeSuccess
    undefined, // onLevelUpSuccess
    undefined, // onVoteSuccess
    // onClaimSuccess
    async (txData) => {
      console.log("✅ [AlreadySharedView] Reward claim successful!", txData);
      sdk.haptics.notificationOccurred("success");

      const claimTxHash = txData?.txHash;
      if (!claimTxHash) {
        console.error(
          "❌ [AlreadySharedView] No transaction hash in claim success data"
        );
        setIsClaiming(false);
        setIsLoadingClaimData(false);
        setClaimError(null);
        return;
      }

      // Reset local claiming state immediately
      setIsClaiming(false);
      setIsLoadingClaimData(false);
      setClaimError(null);

      // Calculate today's day number
      const now = Math.floor(Date.now() / 1000);
      const day = Math.floor(now / 86400);

      // Get reward amount from claimData if available
      const rewardAmount = claimData?.claimSignature?.amount;

      // Optimistically update auth context immediately with claim transaction
      updateAuthData({
        todaysVoteStatus: {
          hasVoted: true,
          hasShared: true,
          hasClaimed: true,
          voteId: currentVoteId || authData?.todaysVoteStatus?.voteId || null,
          castHash: castHash || authData?.todaysVoteStatus?.castHash || null,
          transactionHash:
            transactionHash ||
            authData?.todaysVoteStatus?.transactionHash ||
            null,
          day: day,
        },
        contextualTransaction: {
          transactionHash: claimTxHash,
          transactionType: "claim",
          rewardAmount: rewardAmount,
          castHash:
            castHash || authData?.todaysVoteStatus?.castHash || undefined,
          day: day,
        },
      });
    }
  );

  const [isLoadingClaimData, setIsLoadingClaimData] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Check if user has claimed - if so, the state machine should transition to State 4
  // This prevents showing claiming UI when we've already transitioned
  const hasClaimed =
    authData?.todaysVoteStatus?.hasClaimed ||
    (authData?.contextualTransaction?.transactionType === "claim" &&
      authData?.contextualTransaction?.transactionHash &&
      authData?.todaysVoteStatus?.hasShared);

  // Reset claiming state if we've transitioned to claimed state
  useEffect(() => {
    if (hasClaimed) {
      setIsClaiming(false);
      setIsLoadingClaimData(false);
      setClaimError(null);
    }
  }, [hasClaimed]);

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

  // Note: Continue button removed as this component is for claiming rewards

  /**
   * Handles the claim reward button click - fetches signature and executes transaction
   */
  const handleClickClaim = useCallback(async () => {
    if (
      isClaiming ||
      isClaimPending ||
      isClaimConfirming ||
      isLoadingClaimData
    ) {
      return;
    }

    // If we already have claim data, execute directly
    if (claimData) {
      setIsClaiming(true);
      setClaimError(null);

      try {
        console.log(
          "💰 [AlreadySharedView] Executing claim reward transaction...",
          {
            castHash: claimData.castHash,
            amount: claimData.claimSignature.amount,
            day: claimData.day,
          }
        );

        await executeClaimReward(
          claimData.castHash,
          claimData.claimSignature,
          claimData.day
        );

        console.log(
          "✅ [AlreadySharedView] Claim reward transaction submitted"
        );
        // Note: Navigation/refresh happens in onClaimSuccess callback
      } catch (error: any) {
        console.error("❌ [AlreadySharedView] Claim reward failed:", error);
        setIsClaiming(false);
        setClaimError(
          error.message || "Failed to claim reward. Please try again."
        );
      }
      return;
    }

    // Otherwise, fetch claim signature first
    if (!currentVoteId) {
      setClaimError("Vote ID is required");
      return;
    }

    setIsLoadingClaimData(true);
    setClaimError(null);

    try {
      console.log("🔐 [AlreadySharedView] Fetching claim signature...", {
        voteId: currentVoteId,
        transactionHash,
      });

      const result = await getClaimSignatureForSharedVote(
        currentVoteId,
        transactionHash
      );

      console.log("✅ [AlreadySharedView] Claim signature received", {
        hasClaimSignature: !!result.claimSignature,
        amount: result.amount,
        day: result.day,
        castHash: result.castHash,
      });

      if (result.claimSignature && result.claimSignature.canClaim) {
        const newClaimData = {
          castHash: result.castHash || "",
          claimSignature: result.claimSignature,
          day: result.day,
        };
        setClaimData(newClaimData);
        setIsLoadingClaimData(false);

        // Immediately execute the claim after getting signature
        setIsClaiming(true);
        await executeClaimReward(
          newClaimData.castHash,
          newClaimData.claimSignature,
          newClaimData.day
        );
        console.log(
          "✅ [AlreadySharedView] Claim reward transaction submitted"
        );
      } else {
        throw new Error("Cannot claim - already claimed or not eligible");
      }
    } catch (error: any) {
      console.error(
        "❌ [AlreadySharedView] Failed to get claim signature:",
        error
      );
      setIsLoadingClaimData(false);
      setIsClaiming(false);
      setClaimError(
        error.message || "Failed to get claim signature. Please try again."
      );
    }
  }, [
    claimData,
    currentVoteId,
    transactionHash,
    getClaimSignatureForSharedVote,
    executeClaimReward,
    isClaiming,
    isClaimPending,
    isClaimConfirming,
    isLoadingClaimData,
  ]);

  // Determine button state
  const getButtonState = () => {
    if (isLoadingClaimData) return "Authorizing...";
    if (isClaimPending) return "Confirm in wallet...";
    if (isClaimConfirming) return "Processing...";
    if (isClaiming) return "Claiming...";
    if (claimData) {
      const claimAmount = parseFloat(
        formatUnits(BigInt(claimData.claimSignature.amount), 18)
      );
      return `Claim ${claimAmount.toFixed(0)} $BRND`;
    }
    return "Claim Rewards";
  };

  const isLoading =
    isLoadingClaimData || isClaiming || isClaimPending || isClaimConfirming;

  // Show loading state if data is missing
  if (!currentBrands || currentBrands.length < 3 || !currentVoteId) {
    return (
      <div className={styles.body}>
        <div className={styles.container}>
          <Typography>Loading vote data...</Typography>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <div>
        <div className={styles.center}>
          <img src={Logo} className={styles.logo} alt="Logo" />
        </div>
      </div>
      <div className={styles.container}>
        <Typography
          size={18}
          lineHeight={24}
          variant={"druk"}
          weight={"wide"}
          className={styles.title}
        >
          Already voted and shared!
        </Typography>
      </div>

      {/* Show share message */}
      <div className={styles.shareMessage}>
        <Typography
          variant={"geist"}
          weight={"medium"}
          size={12}
          lineHeight={16}
          textAlign={"center"}
        >
          Claim your daily $BRND rewards
        </Typography>
      </div>

      {/* Show vote transaction if available */}
      <div className={styles.transactionsContainer}>
        {transactionHash && (
          <div className={styles.transactionChip}>
            <div className={styles.transactionHeader}>
              <span className={styles.transactionIcon}>
                <VoteHashIcon />
              </span>
              <span className={styles.transactionText}>
                Vote Txn: {transactionHash.slice(0, 6)}...
                {transactionHash.slice(-4)}
              </span>
              <a
                href={`https://basescan.org/tx/${transactionHash}`}
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

      {/* Show claim ready status */}
      {claimData &&
        !isLoadingClaimData &&
        !isClaiming &&
        !isClaimPending &&
        !isClaimConfirming && (
          <div className={styles.verificationMessage}>
            <Typography
              variant={"geist"}
              weight={"medium"}
              size={14}
              lineHeight={18}
              textAlign={"center"}
            >
              ✅ Ready to claim{" "}
              {parseFloat(
                formatUnits(BigInt(claimData.claimSignature.amount), 18)
              ).toFixed(0)}{" "}
              $BRND
            </Typography>
          </div>
        )}

      {/* Show claim error */}
      {(claimError || contractError) && (
        <div className={styles.errorMessage}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={14}
            lineHeight={18}
            textAlign={"center"}
          >
            {claimError || contractError}
          </Typography>
        </div>
      )}

      <div className={styles.box}>
        <div className={styles.podium}>
          <Podium
            isAnimated={false}
            variant={"readonly"}
            initial={currentBrands}
          />

          <div className={styles.action}>
            <Button
              caption={getButtonState()}
              className={styles.button}
              iconLeft={isLoading ? <LoaderIndicator size={16} /> : undefined}
              onClick={handleClickClaim}
              disabled={isLoading || !!hasClaimed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
