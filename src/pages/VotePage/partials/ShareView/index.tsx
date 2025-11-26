import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatUnits } from "viem";
import sdk from "@farcaster/miniapp-sdk";

// Components
import Podium from "@/components/Podium";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

import Logo from "@/assets/images/logo.svg";

// Hooks
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { useAuth } from "@/shared/hooks/auth";

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
  const { data: authData, updateAuthData } = useAuth();

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
    async (txData) => {
      console.log("✅ [ShareView] Reward claim successful!", txData);
      sdk.haptics.notificationOccurred("success");

      const claimTxHash = txData?.txHash;
      if (!claimTxHash) {
        console.error(
          "❌ [ShareView] No transaction hash in claim success data"
        );
        return;
      }

      // Get castHash from claimData or authData
      const castHash =
        claimData?.castHash || authData?.todaysVoteStatus?.castHash;

      // Calculate today's day number
      const now = Math.floor(Date.now() / 1000);
      const day = Math.floor(now / 86400);

      // Get reward amount from claimData
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

      // Navigate to congrats view after successful claim
      navigateToView?.(
        VotingViewEnum.CONGRATS,
        currentBrands,
        currentVoteId,
        transactionHash,
        castHash || undefined
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

          // Calculate today's day number
          const now = Math.floor(Date.now() / 1000);
          const day = Math.floor(now / 86400);

          // Optimistically update auth context immediately with cast hash
          // This ensures UI updates instantly without waiting for backend
          updateAuthData({
            todaysVoteStatus: {
              hasVoted: true,
              hasShared: true,
              hasClaimed: false,
              voteId:
                currentVoteId || authData?.todaysVoteStatus?.voteId || null,
              castHash: castHash,
              transactionHash:
                transactionHash ||
                authData?.todaysVoteStatus?.transactionHash ||
                null,
              day: day,
            },
            contextualTransaction: {
              transactionHash: null, // No transaction yet - user needs to claim
              transactionType: null, // Will be 'claim' after claim transaction
              castHash: castHash, // Add castHash to contextualTransaction
              day: day,
            },
          });

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
          Already voted today!
        </Typography>
      </div>

      {/* Show vote transaction hash - State 2: User has voted, display the transaction */}
      <div className={styles.shareMessage}>
        <Typography
          variant={"geist"}
          weight={"medium"}
          size={12}
          lineHeight={16}
          textAlign={"center"}
        >
          Share your podium to unlock 10x BRND rewards
        </Typography>
      </div>
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
