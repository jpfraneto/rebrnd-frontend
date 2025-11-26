import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import sdk from "@farcaster/miniapp-sdk";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

// Hooks
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { useContextualTransaction } from "@/shared/hooks/user/useContextualTransaction";

// Types
import { VotingViewProps, VotingViewEnum } from "../../types";

// Assets
import ShareIcon from "@/assets/icons/share-icon.svg?react";

// StyleSheet
import styles from "./ShareView.module.scss";

interface ShareViewProps extends VotingViewProps {}

export default function ShareView({
  currentBrands,
  currentVoteId,
  navigateToView,
  transactionHash,
}: ShareViewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { transaction, isVoteTransaction } = useContextualTransaction();

  const {
    verifyShareAndGetClaimSignature,
    executeClaimReward,
    isPending: isClaimPending,
    isConfirming: isClaimConfirming,
    error: claimError,
  } = useStoriesInMotion(
    undefined, // onAuthorizeSuccess
    undefined, // onLevelUpSuccess
    undefined, // onVoteSuccess
    // onClaimSuccess
    (txData) => {
      console.log("✅ [ShareView] Reward claim successful!", txData);
      // Invalidate auth query to refresh user data with updated todaysVoteStatus
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      // Navigate to congrats view after successful claim
      // castHash is available from currentBrands context or will be in todaysVoteStatus
      navigateToView?.(
        VotingViewEnum.CONGRATS,
        currentBrands,
        currentVoteId,
        transactionHash,
        undefined // castHash will be available from todaysVoteStatus after refresh
      );
    }
  );

  const [isSharing, setIsSharing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
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

  /**
   * Handles the click event for the "Skip" button.
   */
  const handleClickSkip = useCallback(() => {
    if (!currentVoteId || currentVoteId === "") {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [currentVoteId, navigate]);

  /**
   * Handles the unified sharing logic with verification.
   */
  const handleClickShare = useCallback(async () => {
    if (isSharing || isVerifying) return; // Prevent double-clicks

    setIsSharing(true);
    setShareError(null);

    try {
      // Safely extract profile/channel info
      const getProfileOrChannel = (brand: any) => {
        return brand?.profile || brand?.channel || brand?.name || "Unknown";
      };

      const profile1 = getProfileOrChannel(currentBrands[1]);
      const profile2 = getProfileOrChannel(currentBrands[0]);
      const profile3 = getProfileOrChannel(currentBrands[2]);

      const castText = `I just created my @brnd podium of today:\n\n🥇${currentBrands[1]?.name} - ${profile1}\n🥈${currentBrands[0]?.name} - ${profile2}\n🥉${currentBrands[2]?.name} - ${profile3}`;

      // Use the correct embed URL that matches backend expectation
      const embedUrl = `https://brnd.land?txHash=${transactionHash}`;

      // Compose cast with standardized text and embed
      const castResponse = await sdk.actions.composeCast({
        text: castText,
        embeds: [embedUrl],
      });

      // If cast was successful and we have a hash, verify share
      if (castResponse && castResponse.cast?.hash) {
        // Update state to show verification is happening
        setIsSharing(false);
        setIsVerifying(true);

        const castHash = castResponse.cast?.hash;
        console.log("✅ [ShareView] Cast shared successfully", {
          castHash,
          voteId: currentVoteId,
        });

        // Verify share and get claim signature (does not execute transaction)
        try {
          console.log("🔐 [ShareView] Verifying share...", {
            castHash,
            voteId: currentVoteId,
          });

          const verificationResult = await verifyShareAndGetClaimSignature(
            castHash,
            currentVoteId,
            transactionHash
          );

          console.log("✅ [ShareView] Share verified successfully", {
            amount: verificationResult.amount,
            day: verificationResult.day,
          });

          // Store claim data for the claim button
          setClaimData({
            castHash,
            claimSignature: verificationResult.claimSignature,
            day: verificationResult.day,
          });

          // Invalidate auth query to refresh todaysVoteStatus (hasShared should now be true)
          // The castHash will be available in todaysVoteStatus.castHash after backend processes it
          queryClient.invalidateQueries({ queryKey: ["auth"] });

          setIsVerifying(false);

          // Note: castHash is now available and will be passed through viewProps
          // via todaysVoteStatus.castHash after the auth query refreshes
        } catch (error: any) {
          console.error("❌ [ShareView] Share verification failed:", error);
          setIsVerifying(false);
          setShareError(
            error.message || "Failed to verify share. Please try again."
          );
        }
      } else {
        console.warn(
          "📤 [ShareView] Cast response missing hash:",
          castResponse
        );
        setShareError("Share was not completed. Please try again.");
        setIsSharing(false);
      }
    } catch (error) {
      console.error("📤 [ShareView] Share error:", error);
      setShareError("Failed to share cast. Please try again.");
      setIsSharing(false);
    }
  }, [
    currentBrands,
    currentVoteId,
    transactionHash,
    verifyShareAndGetClaimSignature,
    isSharing,
    isVerifying,
  ]);

  /**
   * Handles the claim reward button click - executes the transaction
   */
  const handleClickClaim = useCallback(async () => {
    if (!claimData || isClaiming || isClaimPending || isClaimConfirming) {
      return;
    }

    setIsClaiming(true);
    setShareError(null);

    try {
      console.log("💰 [ShareView] Executing claim reward transaction...", {
        castHash: claimData.castHash,
        amount: claimData.claimSignature.amount,
        day: claimData.day,
      });

      await executeClaimReward(
        claimData.castHash,
        claimData.claimSignature,
        claimData.day
      );

      console.log("✅ [ShareView] Claim reward transaction submitted");
      // Note: Navigation to CongratsView happens in onClaimSuccess callback
    } catch (error: any) {
      console.error("❌ [ShareView] Claim reward failed:", error);
      setIsClaiming(false);
      setShareError(
        error.message || "Failed to claim reward. Please try again."
      );
    }
  }, [
    claimData,
    executeClaimReward,
    isClaiming,
    isClaimPending,
    isClaimConfirming,
  ]);

  // Show loading or error state if data is missing
  if (!currentBrands || currentBrands.length < 3 || !currentVoteId) {
    return (
      <div className={styles.body}>
        <div className={styles.container}>
          <Typography>Loading vote data...</Typography>
        </div>
      </div>
    );
  }

  // Determine the current state for UI feedback
  const getButtonState = () => {
    if (isSharing) return "Sharing...";
    if (isVerifying) return "Verifying Share";
    if (claimData) {
      // Show claim amount after verification
      const claimAmount = parseFloat(
        formatUnits(BigInt(claimData.claimSignature.amount), 18)
      );
      return `Claim ${claimAmount.toFixed(0)} $BRND`;
    }
    if (isClaiming || isClaimPending || isClaimConfirming) {
      if (isClaimPending) return "⏳ Confirm in wallet...";
      if (isClaimConfirming) return "🔄 Processing...";
      return "Claiming...";
    }
    return "Share now";
  };

  const isLoading =
    isSharing ||
    isVerifying ||
    isClaiming ||
    isClaimPending ||
    isClaimConfirming;

  // Determine which button to show and what action it should perform
  const showClaimButton = claimData !== null && !isVerifying;

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        <Typography
          size={18}
          lineHeight={24}
          variant={"druk"}
          weight={"wide"}
          className={styles.title}
        >
          Share on farcaster
        </Typography>
      </div>

      {/* Show error message if share verification failed */}
      {shareError && (
        <div className={styles.errorMessage}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={14}
            lineHeight={18}
            textAlign={"center"}
          >
            {shareError}
          </Typography>
        </div>
      )}

      {/* Show verification status */}
      {isVerifying && (
        <div className={styles.verificationMessage}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={14}
            lineHeight={18}
            textAlign={"center"}
          >
            🔍 Verifying Share...
          </Typography>
        </div>
      )}

      {/* Show vote transaction hash - State 2: User has voted, display the transaction */}
      {(transactionHash ||
        (isVoteTransaction && transaction?.transactionHash)) && (
        <div className={styles.transactionStatus}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={12}
            lineHeight={16}
            textAlign={"center"}
          >
            ✅ Vote Transaction:{" "}
            {(transactionHash || transaction?.transactionHash)!.slice(0, 6)}...
            {(transactionHash || transaction?.transactionHash)!.slice(-4)}
            <a
              href={`https://basescan.org/tx/${
                transactionHash || transaction?.transactionHash
              }`}
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

      {/* Show claim ready status */}
      {claimData &&
        !isVerifying &&
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
              ✅ Share verified! Ready to claim{" "}
              {parseFloat(
                formatUnits(BigInt(claimData.claimSignature.amount), 18)
              ).toFixed(0)}{" "}
              $BRND
            </Typography>
          </div>
        )}

      {/* Show claiming status */}
      {(isClaiming || isClaimPending || isClaimConfirming) && (
        <div className={styles.verificationMessage}>
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
              : "💰 Claiming your reward..."}
          </Typography>
        </div>
      )}

      {/* Show claim error */}
      {claimError && (
        <div className={styles.errorMessage}>
          <Typography
            variant={"geist"}
            weight={"medium"}
            size={14}
            lineHeight={18}
            textAlign={"center"}
          >
            {claimError}
          </Typography>
        </div>
      )}

      <div className={styles.box}>
        <Typography
          variant={"geist"}
          weight={"regular"}
          size={16}
          lineHeight={20}
        >
          I've just created my BRND podium of today:
        </Typography>

        <div className={styles.podium}>
          <Podium
            isAnimated={false}
            variant={"readonly"}
            initial={currentBrands}
          />

          <div className={styles.action}>
            <Typography
              variant={"geist"}
              weight={"semiBold"}
              textAlign={"center"}
              size={14}
              lineHeight={10}
            >
              {isVerifying
                ? "Verifying your share..."
                : showClaimButton
                ? "Claim your 10x BRND reward"
                : isClaiming || isClaimPending || isClaimConfirming
                ? "Claiming your reward..."
                : "Share to claim your 10x BRND reward"}
            </Typography>
            <Button
              caption={getButtonState()}
              className={styles.button}
              iconLeft={
                isLoading ? (
                  <LoaderIndicator size={16} />
                ) : showClaimButton ? undefined : (
                  <ShareIcon />
                )
              }
              onClick={showClaimButton ? handleClickClaim : handleClickShare}
              disabled={isLoading && !showClaimButton}
            />
          </div>
        </div>
      </div>
      <div className={styles.action}>
        <Button
          variant={"underline"}
          caption="Skip"
          onClick={handleClickSkip}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
