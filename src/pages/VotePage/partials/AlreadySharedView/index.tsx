import { useCallback, useState, useEffect } from "react";
import { formatUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

// Hooks
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { useContextualTransaction } from "@/shared/hooks/user/useContextualTransaction";
import { useAuth } from "@/shared/hooks/auth";
import TransactionInfo from "@/shared/components/TransactionInfo";

// Types
import { VotingViewProps } from "../../types";

// StyleSheet
import styles from "./AlreadySharedView.module.scss";

// Assets
// import sdk from "@farcaster/miniapp-sdk"; // Removed as not used in this component

interface Place {
  icon: string;
  name: string;
}

interface AlreadySharedViewProps extends VotingViewProps {}

export default function AlreadySharedView({
  currentBrands,
  currentVoteId,
  transactionHash,
  castHash,
}: AlreadySharedViewProps) {
  const queryClient = useQueryClient();
  const { transaction, hasTransaction } = useContextualTransaction();
  const { data: authData } = useAuth();

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

      // Reset local claiming state immediately
      setIsClaiming(false);
      setIsLoadingClaimData(false);
      setClaimError(null);

      // Store the transaction hash and start polling for backend status update
      if (txData?.txHash) {
        setClaimTxHash(txData.txHash);
        setIsWaitingForBackend(true);
        console.log(
          "🔄 [AlreadySharedView] Starting to poll for claim status update...",
          {
            txHash: txData.txHash,
          }
        );
      }

      // Invalidate auth query immediately (polling will handle refetching)
      queryClient.invalidateQueries({ queryKey: ["auth"] });

      // Do an initial refetch after a short delay to give backend time to process
      setTimeout(async () => {
        try {
          await queryClient.refetchQueries({ queryKey: ["auth"] });
        } catch (error) {
          console.error(
            "❌ [AlreadySharedView] Initial refetch failed:",
            error
          );
        }
      }, 1500);
    }
  );

  const [isLoadingClaimData, setIsLoadingClaimData] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isWaitingForBackend, setIsWaitingForBackend] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

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
      setIsWaitingForBackend(false);
      setClaimTxHash(null);
    }
  }, [hasClaimed]);

  // Poll for claim status update after successful claim transaction
  useEffect(() => {
    if (!isWaitingForBackend || !claimTxHash) return;

    const pollForClaimStatus = async () => {
      try {
        console.log(
          "🔄 [AlreadySharedView] Polling for claim status update..."
        );

        // Invalidate and refetch auth query
        queryClient.invalidateQueries({ queryKey: ["auth"] });
        await queryClient.refetchQueries({ queryKey: ["auth"] });

        // The authData will be updated by React Query automatically
        // The hasClaimed check in the other useEffect will detect the change and stop polling
      } catch (error) {
        console.error(
          "❌ [AlreadySharedView] Error polling for claim status:",
          error
        );
        // Continue polling even on error
      }
    };

    // Initial delay to give backend time to process
    const initialDelay = setTimeout(() => {
      pollForClaimStatus();
    }, 2000); // 2 second initial delay

    // Set up polling interval (every 3 seconds)
    const pollInterval = setInterval(() => {
      pollForClaimStatus();
    }, 3000);

    // Stop polling after 60 seconds max
    const maxPollTimeout = setTimeout(() => {
      console.warn("⚠️ [AlreadySharedView] Polling timeout - stopping poll");
      setIsWaitingForBackend(false);
      setClaimTxHash(null);
    }, 60000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(pollInterval);
      clearTimeout(maxPollTimeout);
    };
  }, [isWaitingForBackend, claimTxHash, queryClient]);
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

  // Safely create places array
  const places: Place[] =
    currentBrands && currentBrands.length >= 3
      ? [
          {
            icon: "🥇",
            name:
              currentBrands[1]?.profile ||
              currentBrands[1]?.channel ||
              currentBrands[1]?.name,
          },
          {
            icon: "🥈",
            name:
              currentBrands[0]?.profile ||
              currentBrands[0]?.channel ||
              currentBrands[0]?.name,
          },
          {
            icon: "🥉",
            name:
              currentBrands[2]?.profile ||
              currentBrands[2]?.channel ||
              currentBrands[2]?.name,
          },
        ]
      : [];

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
      <div className={styles.successMessage}>
        <Typography
          variant={"geist"}
          weight={"medium"}
          size={16}
          lineHeight={20}
          textAlign={"center"}
        >
          Your vote was created and shared.
        </Typography>
        <Typography
          variant={"geist"}
          weight={"regular"}
          size={14}
          lineHeight={18}
          textAlign={"center"}
          className={styles.pointsText}
        >
          You can now claim your 10x $BRND rewards.
        </Typography>
      </div>

      <div className={styles.box}>
        <Typography
          variant={"geist"}
          weight={"regular"}
          size={16}
          lineHeight={20}
        >
          Your BRND podium of today:
        </Typography>
        <div className={styles.places}>
          {places.map((place, index) => (
            <Typography
              key={`--place-${index.toString()}`}
              variant={"geist"}
              weight={"regular"}
              size={16}
              lineHeight={20}
            >
              {place.icon} {place.name}
            </Typography>
          ))}
        </div>

        <div className={styles.podium}>
          <Podium
            isAnimated={false}
            variant={"readonly"}
            initial={currentBrands}
          />
        </div>
      </div>

      {/* Show transaction information - State 3: Vote transaction hash always shown */}
      {transactionHash && (
        <div className={styles.voteTransactionInfo}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={12}
            lineHeight={16}
            textAlign={"center"}
          >
            ✅ Vote Transaction: {transactionHash.slice(0, 6)}...
            {transactionHash.slice(-4)}
            <a
              href={`https://basescan.org/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.txLink}
              title="View on Base Explorer"
            >
              ↗
            </a>
          </Typography>
        </div>
      )}

      {castHash && (
        <div className={styles.castTransactionInfo}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={12}
            lineHeight={16}
            textAlign={"center"}
          >
            ✅ Cast Hash: {castHash}
          </Typography>
        </div>
      )}

      {/* Show contextual transaction information if available (for claim transactions) */}
      {hasTransaction && transaction && (
        <TransactionInfo
          transaction={transaction}
          className={styles.transactionInfo}
        />
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

      {/* Show claim status - only show if we have claim data */}
      {claimData && !isLoadingClaimData && (
        <div className={styles.claimMessage}>
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
            $BRND rewards
          </Typography>
        </div>
      )}

      {/* Show claiming status - only if not already claimed */}
      {!hasClaimed &&
        (isClaiming ||
          isClaimPending ||
          isClaimConfirming ||
          isWaitingForBackend) && (
          <div className={styles.claimMessage}>
            <Typography
              variant={"geist"}
              weight={"medium"}
              size={14}
              lineHeight={18}
              textAlign={"center"}
            >
              {isClaimPending
                ? "⏳ Confirm reward claim in wallet..."
                : isClaimConfirming
                ? "🔄 Processing reward claim..."
                : isWaitingForBackend
                ? "✅ Claim confirmed! Waiting for final confirmation..."
                : "💰 Claiming your reward..."}
            </Typography>
          </div>
        )}

      {/* Hide claim button if already claimed - state machine will show CongratsView */}
      {!hasClaimed && !isWaitingForBackend && (
        <div className={styles.actionGroup}>
          <Button
            variant={"primary"}
            caption={
              isLoadingClaimData
                ? "Authorizing..."
                : isClaimPending
                ? "Confirm in wallet..."
                : isClaimConfirming
                ? "Processing..."
                : isClaiming
                ? "Claiming..."
                : claimData
                ? `Claim ${parseFloat(
                    formatUnits(BigInt(claimData.claimSignature.amount), 18)
                  ).toFixed(0)} $BRND`
                : "Claim Rewards"
            }
            onClick={handleClickClaim}
            disabled={
              isLoadingClaimData ||
              isClaiming ||
              isClaimPending ||
              isClaimConfirming
            }
            iconLeft={
              isLoadingClaimData ||
              isClaiming ||
              isClaimPending ||
              isClaimConfirming ? (
                <LoaderIndicator size={16} />
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
