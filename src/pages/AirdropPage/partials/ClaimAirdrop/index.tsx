// Dependencies
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./ClaimAirdrop.module.scss";

// Components
import Typography from "@/shared/components/Typography";
import Button from "@/shared/components/Button";
import IconButton from "@/shared/components/IconButton";
import AirdropSvg from "@/shared/assets/images/airdrop.svg?react";

import Confetti from "react-confetti-boom";

import UnicornStudioAnimation from "@/shared/components/UnicornStudioAnimation";

// Hooks
import { useAirdropClaim } from "@/shared/hooks/contract/useAirdropClaim";
import { useAuth } from "@/shared/hooks/auth/useAuth";
import { useAirdropCheck } from "@/shared/hooks/user/useAirdropCheck";
import { useAirdropClaimStatus } from "@/shared/hooks/user/useAirdropClaimStatus";
import { useAccount } from "wagmi";

// Assets
import GoBackIcon from "@/assets/icons/go-back-icon.svg?react";
import sdk from "@farcaster/miniapp-sdk";
import airdropBackgroundImage from "@/shared/assets/images/airdrop-background.png";

interface ClaimAirdropProps {
  airdropData?: {
    calculation: {
      finalScore: number;
      leaderboardPosition: number;
      tokenAllocation: number;
      totalMultiplier: number;
    };
  };
  onBack: () => void;
}

// Electric digit animation component for main airdrop amount (9 digits)
const ElectricDigits: React.FC<{ amount: string; isLoading: boolean }> = ({
  amount,
  isLoading,
}) => {
  // Format with 9 digits padding for loading state
  const formatAmountWithPadding = (amt: string) => {
    const numericValue = amt.replace(/[^0-9]/g, "");
    return numericValue.padStart(9, "0").replace(/(\d{3})(?=\d)/g, "$1,");
  };

  // Format actual number without padding for loaded state
  const formatAmountActual = (amt: string) => {
    const numericValue = amt.replace(/[^0-9]/g, "");
    const num = parseInt(numericValue, 10);
    return num.toLocaleString();
  };

  const loadingFormattedAmount = formatAmountWithPadding(amount);
  const actualFormattedAmount = formatAmountActual(amount);
  const [displayDigits, setDisplayDigits] = React.useState<string[]>(
    loadingFormattedAmount.split("")
  );

  React.useEffect(() => {
    if (!isLoading) {
      setDisplayDigits(actualFormattedAmount.split(""));
      return;
    }

    // Initialize with random digits (9 digits with padding)
    setDisplayDigits(
      loadingFormattedAmount.split("").map((char) => {
        if (char === "," || char === ".") return char;
        return Math.floor(Math.random() * 10).toString();
      })
    );

    // Haptic feedback interval - call frequently during loading
    const hapticInterval = setInterval(() => {
      try {
        sdk.haptics.impactOccurred("light");
      } catch (error) {
        // Silently fail if haptics not available
      }
    }, 150); // Call haptics every 150ms for frantic feedback

    const interval = setInterval(() => {
      setDisplayDigits((prev) => {
        return loadingFormattedAmount.split("").map((char, index) => {
          if (char === "," || char === ".") return char;
          // More aggressive random changes for electric effect
          if (Math.random() > 0.4) {
            return Math.floor(Math.random() * 10).toString();
          }
          return prev[index] || Math.floor(Math.random() * 10).toString();
        });
      });
    }, 80); // Faster interval for more electric feel

    return () => {
      clearInterval(interval);
      clearInterval(hapticInterval);
    };
  }, [loadingFormattedAmount, actualFormattedAmount, isLoading]);

  if (!isLoading) {
    return <>{actualFormattedAmount}</>;
  }

  return (
    <>
      {displayDigits.map((digit, index) => (
        <span
          key={`${index}-${digit}`}
          className={styles.electricDigit}
          style={{
            animationDelay: `${(index % 3) * 0.03}s`,
          }}
        >
          {digit}
        </span>
      ))}
    </>
  );
};

// Blurry loading numbers component for other stats
const BlurryLoadingNumber: React.FC<{
  value: string | number;
  isLoading: boolean;
  className?: string;
}> = ({ value, isLoading, className }) => {
  const stringValue =
    typeof value === "number" ? value.toLocaleString() : value;
  const [displayValue, setDisplayValue] = React.useState(stringValue);

  React.useEffect(() => {
    if (!isLoading) {
      setDisplayValue(stringValue);
      return;
    }

    const interval = setInterval(() => {
      // Generate random numbers that roughly match the original format
      const randomValue = stringValue
        .split("")
        .map((char) => {
          if (char === "," || char === "." || char === "#" || char === "X")
            return char;
          if (char === "—") return "—";
          return Math.floor(Math.random() * 10).toString();
        })
        .join("");

      setDisplayValue(randomValue);
    }, 100); // Update every 100ms for blurry effect

    return () => clearInterval(interval);
  }, [stringValue, isLoading]);

  return (
    <span
      className={`${className || ""} ${isLoading ? styles.blurryLoading : ""}`}
      style={{
        filter: isLoading ? "blur(1px)" : "none",
        transition: "filter 0.3s ease",
      }}
    >
      {displayValue}
    </span>
  );
};

function ClaimAirdrop({
  airdropData,
  onBack,
}: ClaimAirdropProps): React.ReactNode {
  const navigate = useNavigate();
  const {
    claimAirdrop,
    isClaiming,
    isConfirming,
    isConfirmed,
    transactionError: hookTransactionError,
  } = useAirdropClaim();
  const { data: authData, updateAuthData } = useAuth();
  const { address } = useAccount();
  const [isLoadingAmount, setIsLoadingAmount] = React.useState(true);
  const [finalAirdropData, setFinalAirdropData] = React.useState(airdropData);
  const [claimError, setClaimError] = React.useState<string | null>(null);
  const hasInitialized = useRef(false);

  // Update finalAirdropData when airdropData prop changes
  useEffect(() => {
    if (airdropData) {
      setFinalAirdropData(airdropData);
    }
  }, [airdropData]);

  // Use airdrop data from auth endpoint when available
  const authAirdropData = authData?.airdrop;
  const hasAuthAirdropData = !!authAirdropData;

  // Check if we have claim status from /me endpoint (most efficient - already loaded)
  const hasClaimedFromAuth = authAirdropData?.hasClaimed ?? false;

  // Fetch final airdrop data before claiming
  const { refetch: refetchAirdropData } = useAirdropCheck({
    enabled: false, // Only fetch when manually triggered
  });

  // Only check claim status if we don't have hasClaimed from /me endpoint
  // This avoids redundant API calls since /me already provides this data
  const { data: claimStatus, isLoading: isClaimStatusLoading } =
    useAirdropClaimStatus({
      enabled: !hasClaimedFromAuth && hasAuthAirdropData === false, // Only fetch if we don't have data from /me
    });

  // Check if user has already claimed (prioritize /me endpoint data, then claim status, then transaction confirmation)
  const hasAlreadyClaimed =
    isConfirmed ||
    hasClaimedFromAuth ||
    (claimStatus?.success && claimStatus.data.hasClaimed);

  // Preload background image on mount
  useEffect(() => {
    const img = new Image();
    img.src = airdropBackgroundImage;
  }, []);

  // Show loading animation for 2 seconds, skip API call if we have data from /me
  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) {
      return;
    }

    let timer: NodeJS.Timeout | null = null;
    hasInitialized.current = true;

    // If we already have data from /me endpoint, skip the API call
    // but still show the loading animation for the nice effect
    if (hasAuthAirdropData && authAirdropData?.tokenAllocation) {
      // Use data from /me endpoint directly
      if (airdropData) {
        setFinalAirdropData(airdropData);
      }

      // Show loading animation for 2 seconds
      timer = setTimeout(() => {
        setIsLoadingAmount(false);
      }, 2000);
    } else if (airdropData) {
      // Use prop data if available
      setFinalAirdropData(airdropData);

      // Show loading animation for 2 seconds
      timer = setTimeout(() => {
        setIsLoadingAmount(false);
      }, 2000);
    } else {
      // Only fetch if we don't have data from /me endpoint
      const fetchLatestData = async () => {
        try {
          // Fetch the most up-to-date airdrop information
          const result = await refetchAirdropData();
          if (result.data) {
            setFinalAirdropData(result.data as unknown as typeof airdropData);
          }
        } catch (error) {
          console.error("Failed to fetch latest airdrop data:", error);
        }

        // Show loading animation for 2 seconds after fetch completes
        timer = setTimeout(() => {
          setIsLoadingAmount(false);
        }, 2000);
      };

      fetchLatestData();
    }

    // Cleanup function to clear timer
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [hasAuthAirdropData, authAirdropData, airdropData, refetchAirdropData]);

  // Safety fallback: ensure loading always stops after max 3 seconds
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setIsLoadingAmount(false);
    }, 3000);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Sync transaction error from hook to local state for UI display
  useEffect(() => {
    if (hookTransactionError) {
      console.log(
        "🔔 [ClaimAirdrop] Transaction error detected:",
        hookTransactionError
      );
      setClaimError(hookTransactionError);
    }
  }, [hookTransactionError]);

  const handleClaim = async () => {
    sdk.haptics.selectionChanged();
    setClaimError(null); // Clear previous errors when starting new claim

    if (!address) {
      setClaimError("Please connect your wallet");
      sdk.haptics.notificationOccurred("error");
      return;
    }

    if (!authData?.fid) {
      setClaimError("Authentication required");
      sdk.haptics.notificationOccurred("error");
      return;
    }

    try {
      await claimAirdrop({
        fid: authData.fid,
        walletAddress: address,
      });
    } catch (error: any) {
      console.error("Airdrop claim failed:", error);

      // Handle specific error messages from backend
      let errorMessage = "Claim failed. Please try again.";

      if (error.message.includes("not enabled")) {
        errorMessage = "Claiming is not enabled yet. Please check back later.";
      } else if (error.message.includes("not set")) {
        errorMessage = "Airdrop is being prepared. Please check back soon.";
      } else if (error.message.includes("already claimed")) {
        errorMessage = "You have already claimed your airdrop.";
      } else if (error.message.includes("not verified")) {
        errorMessage = "Please verify your wallet address on Farcaster first.";
      } else if (error.message.includes("not eligible")) {
        errorMessage = "You are not eligible for this airdrop.";
      } else if (
        error.message.includes("revert") ||
        error.message.includes("Reverted")
      ) {
        // Use the error message directly if it contains revert information
        errorMessage = error.message;
      }

      setClaimError(errorMessage);
      sdk.haptics.notificationOccurred("error");
    }
  };

  // Optimistically update the hasClaimed status when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && authData?.airdrop) {
      console.log("🔄 [ClaimAirdrop] Transaction confirmed, updating hasClaimed optimistically");
      updateAuthData({
        airdrop: {
          ...authData.airdrop,
          hasClaimed: true,
        },
      });
    }
  }, [isConfirmed, authData?.airdrop, updateAuthData]);

  // Trigger haptics when transitioning to success state
  useEffect(() => {
    // Show haptics immediately if we have data from /me endpoint, otherwise wait for claim status
    if (hasClaimedFromAuth || (hasAlreadyClaimed && !isClaimStatusLoading)) {
      sdk.haptics.selectionChanged();
    }
  }, [hasAlreadyClaimed, hasClaimedFromAuth, isClaimStatusLoading]);

  // Show success screen immediately if we have claim status from /me endpoint,
  // otherwise wait for claim status check to complete
  const shouldShowSuccess =
    hasClaimedFromAuth || // Immediate if we have /me data
    isConfirmed || // Immediate if transaction confirmed
    (claimStatus?.success &&
      claimStatus.data.hasClaimed &&
      !isClaimStatusLoading); // Wait for claim status if needed

  if (shouldShowSuccess) {
    return (
      <div className={styles.body}>
        <Confetti
          mode="boom"
          particleCount={88}
          deg={270}
          effectInterval={888}
          effectCount={13}
          colors={["#fff100", "#ff0000", "#0c00ff", "#00ff00"]}
        />
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <IconButton
              variant="solid"
              icon={<GoBackIcon />}
              onClick={() => {
                sdk.haptics.selectionChanged();
                onBack();
              }}
              className={styles.backBtn}
            />
            <div className={styles.airdropTitle}>
              <AirdropSvg />
            </div>
          </div>

          {/* Success Card */}
          <div className={styles.successCard}>
            {/* Logo */}
            {/* Preload AirdropLogo image */}
            <UnicornStudioAnimation
              projectId="qAsC3joh26bv6jjqDmc6"
              width={120}
              height={120}
              className={styles.airdropLogo}
            />

            {/* Success Message */}
            <Typography
              size={16}
              lineHeight={20}
              weight="regular"
              variant="geist"
              className={styles.successText}
            >
              CONGRATULATIONS! YOU RECEIVED
            </Typography>

            {/* Claimed Amount */}
            <Typography
              size={111}
              weight="condensed"
              variant="druk"
              className={styles.claimedAmount}
            >
              {/* Prioritize /me endpoint data (most efficient), then claim status, then prop data */}
              {hasAuthAirdropData && authAirdropData.tokenAllocation
                ? Number(authAirdropData.tokenAllocation).toLocaleString()
                : claimStatus?.data?.eligibility?.amount
                ? Number(claimStatus.data.eligibility.amount).toLocaleString()
                : finalAirdropData?.calculation?.tokenAllocation
                ? Number(
                    finalAirdropData.calculation.tokenAllocation
                  ).toLocaleString()
                : "0"}
            </Typography>

            {/* Token Symbol */}
            <Typography
              size={44}
              weight="wide"
              variant="druk"
              className={styles.tokenSymbol}
            >
              $BRND
            </Typography>

            {/* Context Text */}
            <Typography
              size={14}
              lineHeight={18}
              weight="medium"
              className={styles.contextText}
            >
              ON THE BRND AIRDROP
            </Typography>

            {/* Share Button */}
            <Button
              variant="primary"
              onClick={() => {
                sdk.haptics.selectionChanged();
                sdk.actions.composeCast({
                  text: `I just claimed my $BRND airdrop for ${
                    // Prioritize /me endpoint data (most efficient), then claim status, then prop data
                    (hasAuthAirdropData && authAirdropData.tokenAllocation
                      ? Number(authAirdropData.tokenAllocation).toLocaleString()
                      : claimStatus?.data?.eligibility?.amount
                      ? Number(
                          claimStatus.data.eligibility.amount
                        ).toLocaleString()
                      : finalAirdropData?.calculation?.tokenAllocation) || "0"
                  } tokens\n\nClaim yours on this miniapp:`,
                  embeds: ["https://rebrnd.lat"],
                  channelKey: "brnd",
                });
                navigate("/");
              }}
              caption="Share"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <IconButton
            variant="solid"
            icon={<GoBackIcon />}
            onClick={() => {
              sdk.haptics.selectionChanged();
              onBack();
            }}
            className={styles.backBtn}
          />
          <div className={styles.airdropTitle}>
            {" "}
            <AirdropSvg />
          </div>
        </div>

        {/* Main Claim Card */}
        <div className={styles.claimCard}>
          {/* Leaderboard Section */}
          <div className={styles.leaderboardSection}>
            <div className={styles.pfpBox}>
              <div className={styles.userPfp}>
                <img
                  src={authData?.photoUrl}
                  alt="User Profile"
                  className={styles.pfpImage}
                />
              </div>
            </div>

            <div className={styles.leaderboardContent}>
              <div className={styles.leaderboardLabelContainer}>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={14}
                  lineHeight={18}
                  className={styles.leaderboardLabel}
                >
                  LEADERBOARD
                </Typography>
              </div>

              <div className={styles.pointsDisplay}>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={28}
                  lineHeight={32}
                  className={styles.pointsNumber}
                >
                  <BlurryLoadingNumber
                    value={
                      hasAuthAirdropData
                        ? authAirdropData.airdropScore
                        : finalAirdropData?.calculation?.finalScore || 0
                    }
                    isLoading={isLoadingAmount}
                  />
                </Typography>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={8}
                  lineHeight={12}
                  className={styles.pointsLabel}
                >
                  POINTS
                </Typography>
              </div>
              <div className={styles.pointsDisplay}>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={32}
                  lineHeight={32}
                  className={styles.rankNumber}
                >
                  <BlurryLoadingNumber
                    value={`#${
                      hasAuthAirdropData
                        ? authAirdropData.leaderboardPosition
                        : finalAirdropData?.calculation?.leaderboardPosition ||
                          "—"
                    }`}
                    isLoading={isLoadingAmount}
                  />
                </Typography>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={8}
                  lineHeight={12}
                  className={styles.pointsLabel}
                >
                  RANK
                </Typography>
              </div>
            </div>
          </div>

          {/* Multipliers */}
          <div
            className={styles.multipliersPill}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Typography
              className={styles.multipliersText}
              size={12}
              weight="medium"
              as="span"
            >
              TOTAL MULTIPLIERS&nbsp;
            </Typography>
            <Typography
              className={styles.multipliersValue}
              size={16}
              weight="wide"
              variant="druk"
              as="span"
            >
              <BlurryLoadingNumber
                value={`X${Number(
                  finalAirdropData?.calculation?.totalMultiplier
                ).toFixed(1)}`}
                isLoading={isLoadingAmount}
              />
            </Typography>
          </div>

          {/* Claimable Amount */}
          <div className={styles.claimableSection}>
            <Typography
              size={111}
              weight="condensed"
              variant="druk"
              className={`${styles.claimableAmount} ${
                isLoadingAmount ? styles.loading : ""
              }`}
            >
              <ElectricDigits
                amount={
                  // Prioritize /me endpoint data (most efficient), then claim status, then prop data
                  (hasAuthAirdropData && authAirdropData.tokenAllocation
                    ? authAirdropData.tokenAllocation.toString()
                    : claimStatus?.data?.eligibility?.amount
                    ? claimStatus.data.eligibility.amount
                    : finalAirdropData?.calculation?.tokenAllocation?.toString()) ||
                  "0"
                }
                isLoading={isLoadingAmount}
              />
            </Typography>
            <Typography
              size={44}
              weight="wide"
              variant="druk"
              className={styles.tokenSymbol}
            >
              $BRND
            </Typography>
          </div>

          {/* Error Message */}
          {(claimError || hookTransactionError) && (
            <div className={styles.errorMessage}>
              <Typography
                variant="geist"
                weight="medium"
                size={14}
                className={styles.errorText}
              >
                {hookTransactionError || claimError}
              </Typography>
              {(hookTransactionError || claimError) && (
                <Typography
                  variant="geist"
                  weight="regular"
                  size={12}
                  className={styles.errorText}
                >
                  {hookTransactionError
                    ? "This error occurred during the transaction. Please check the console for more details."
                    : "Please check the console for more details."}
                </Typography>
              )}
            </div>
          )}

          {/* Claim Button */}
          <Button
            variant="primary"
            onClick={handleClaim}
            disabled={
              isClaiming ||
              isConfirming ||
              hasClaimedFromAuth || // Use /me endpoint data first (most efficient)
              (isClaimStatusLoading && !hasClaimedFromAuth) || // Only show loading if we don't have /me data
              (claimStatus?.success && !claimStatus.data.canClaim) ||
              (claimStatus?.success && claimStatus.data.hasClaimed)
            }
            caption={
              hasClaimedFromAuth
                ? "Already Claimed"
                : isClaimStatusLoading && !hasClaimedFromAuth
                ? "Loading..."
                : claimStatus?.success && claimStatus.data.hasClaimed
                ? "Already Claimed"
                : claimStatus?.success && !claimStatus.data.canClaim
                ? claimStatus.data.reason
                : isClaiming
                ? "Claiming..."
                : isConfirming
                ? "Confirming..."
                : "Claim your $BRND"
            }
          />
        </div>
      </div>
    </div>
  );
}

export default ClaimAirdrop;
