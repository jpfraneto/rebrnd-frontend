import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Confetti from "react-confetti";
import useWindowSize from "react-use/lib/useWindowSize";

// Components
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

// Hooks
import { useAuth } from "@/hooks/auth";
import { useShareVerification } from "@/hooks/user/useShareVerification";
import { useContextualTransaction } from "@/shared/hooks/user/useContextualTransaction";

import CheersIcon from "@/shared/assets/icons/cheers.svg?react";
import VoteHashIcon from "@/shared/assets/icons/vote-hash.svg?react";
import ExternalLinkIconShare from "@/shared/assets/icons/external-link-icon-share.svg?react";

// Types
import { VotingViewProps } from "../../types";

// StyleSheet
import styles from "./CongratsView.module.scss";

// Assets
import Logo from "@/assets/images/logo.svg";

type VerificationState = "verifying" | "success" | "error" | "skipped";

interface CongratsViewProps extends Partial<VotingViewProps> {}

export default function CongratsView({
  transactionHash,
}: CongratsViewProps = {}) {
  const navigate = useNavigate();
  const { width, height } = useWindowSize();
  const { data: user } = useAuth();
  const shareVerification = useShareVerification();
  const { transaction, hasTransaction } = useContextualTransaction();

  const [verificationState, setVerificationState] =
    useState<VerificationState>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<string>("00:00:00");

  // Check if user has claimed rewards today
  const hasClaimed = user?.todaysVoteStatus?.hasClaimed ?? false;

  // Get BRND power level from user data (comes from /me endpoint)
  const brndPowerLevel = user?.brndPowerLevel ?? 0;

  // Calculate reward amount based on contract logic
  // getRewardAmount(uint8 brndPowerLevel) = getVoteCost(brndPowerLevel) * REWARD_MULTIPLIER (10)
  // getVoteCost logic:
  //   - Level 0: BASE_VOTE_COST (100e18)
  //   - Level 1: LEVEL_1_VOTE_COST (150e18)
  //   - Level 2+: BASE_VOTE_COST * brndPowerLevel (100 * level)
  const calculateRewardAmount = useCallback((level: number): number => {
    const REWARD_MULTIPLIER = 10;
    const BASE_VOTE_COST = 100;
    const LEVEL_1_VOTE_COST = 150;

    let voteCost: number;
    if (level === 0) {
      voteCost = BASE_VOTE_COST;
    } else if (level === 1) {
      voteCost = LEVEL_1_VOTE_COST;
    } else {
      voteCost = BASE_VOTE_COST * level;
    }

    return voteCost * REWARD_MULTIPLIER;
  }, []);

  // Calculate leaderboard points based on BRND power level
  // Level 0 -> 3, Level 1 -> 6, Level 2 -> 9, etc.
  // Formula: (level + 1) * 3
  const calculateLeaderboardPoints = useCallback((level: number): number => {
    return (level + 1) * 3;
  }, []);

  const rewardAmount = calculateRewardAmount(brndPowerLevel);
  const leaderboardPoints = calculateLeaderboardPoints(brndPowerLevel);

  // Calculate time until midnight UTC
  const getTimeUntilMidnightUTC = useCallback(() => {
    const now = new Date();

    // Get current UTC time components
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();

    // Get midnight UTC (start of next day)
    const midnightUTC = Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0);

    const diff = midnightUTC - now.getTime();

    if (diff <= 0) {
      return "00:00:00";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }, []);

  // Update countdown every second
  useEffect(() => {
    // Set initial countdown
    setCountdown(getTimeUntilMidnightUTC());

    // Update every second
    const interval = setInterval(() => {
      setCountdown(getTimeUntilMidnightUTC());
    }, 1000);

    return () => clearInterval(interval);
  }, [getTimeUntilMidnightUTC]);

  // Monitor share verification status
  useEffect(() => {
    if (shareVerification.isSuccess) {
      setVerificationState("success");
    } else if (shareVerification.isError) {
      setVerificationState("error");
      setErrorMessage(
        shareVerification.error?.message ||
          "Verification failed. Please try sharing again."
      );
    }
  }, [
    shareVerification.isSuccess,
    shareVerification.isError,
    shareVerification.error,
  ]);

  // If user has claimed, show claimed state immediately
  useEffect(() => {
    if (hasClaimed) {
      setVerificationState("success");
    }
  }, [hasClaimed]);

  /**
   * Handle navigation to home
   */
  const handleClickContinue = useCallback(() => {
    navigate("/");
  }, [navigate]);

  /**
   * Handle retry sharing - navigate back to share view
   */
  const handleRetryShare = useCallback(() => {
    // Navigate back to today's vote to show share screen
    const todayUnix = Math.floor(Date.now() / 1000);
    navigate(`/vote/${todayUnix}`, { replace: true });
  }, [navigate]);

  /**
   * Skip verification and mark as complete
   */
  const handleSkipVerification = useCallback(() => {
    setVerificationState("skipped");
  }, []);

  const renderContent = () => {
    switch (verificationState) {
      case "verifying":
        return (
          <>
            <div className={styles.successContent}>
              <Typography
                variant={"druk"}
                weight={"wide"}
                size={24}
                lineHeight={28}
                textAlign={"center"}
                className={styles.title}
              >
                🎉 Podium created!
              </Typography>
              <div className={styles.verifyingSection}>
                <LoaderIndicator size={24} />
                <Typography
                  variant={"geist"}
                  weight={"medium"}
                  size={14}
                  lineHeight={20}
                  textAlign={"center"}
                  className={styles.verifyingMessage}
                >
                  Verifying your share to unlock 10x BRND rewards...
                </Typography>
              </div>
            </div>
            <div className={styles.action}>
              <Button
                variant={"underline"}
                caption="Skip verification"
                onClick={handleSkipVerification}
              />
            </div>
          </>
        );

      case "success":
        return (
          <>
            <div className={styles.successContent}>
              <Typography
                variant={"druk"}
                weight={"wide"}
                size={24}
                lineHeight={35}
                textAlign={"center"}
                className={styles.title}
              >
                {hasClaimed
                  ? "All done for today!"
                  : "Amazing! 10x BRND claimed!"}
              </Typography>

              {/* Rewards Modal */}
              <div className={styles.rewardsModal}>
                <div className={styles.rewardsBlur}></div>
                <div className={styles.rewardsContent}>
                  <Typography
                    variant={"druk"}
                    weight={"wide"}
                    size={18}
                    lineHeight={23}
                    textAlign={"center"}
                    className={styles.rewardsTitle}
                  >
                    You got
                  </Typography>
                  <div className={styles.rewardsList}>
                    <Typography
                      variant={"geist"}
                      weight={"medium"}
                      size={18}
                      lineHeight={23}
                      textAlign={"center"}
                      className={styles.rewardItem}
                    >
                      {leaderboardPoints} Leaderboard points
                    </Typography>
                    <Typography
                      variant={"geist"}
                      weight={"medium"}
                      size={18}
                      lineHeight={23}
                      textAlign={"center"}
                      className={styles.rewardItem}
                    >
                      {rewardAmount} $BRND
                    </Typography>
                  </div>
                </div>
              </div>

              {/* Transaction chips */}
              <div className={styles.transactionsContainer}>
                {/* Show vote transaction if available */}
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

                {/* Show claim transaction if available */}
                {hasTransaction &&
                  transaction &&
                  transaction.transactionType === "claim" && (
                    <div className={styles.transactionChip}>
                      <div className={styles.transactionHeader}>
                        <span className={styles.transactionIcon}>
                          <CheersIcon />
                        </span>
                        <span className={styles.transactionText}>
                          Claim Txn: {transaction.transactionHash?.slice(0, 6)}
                          ...
                          {transaction.transactionHash?.slice(-4)}
                        </span>
                        <a
                          href={`https://basescan.org/tx/${transaction.transactionHash}`}
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

              {/* Next Vote Timer */}
              <div className={styles.nextVoteTimer}>Next Vote: {countdown}</div>
            </div>

            <div className={styles.action}>
              <Button
                variant={"primary"}
                caption="Continue"
                onClick={handleClickContinue}
              />
            </div>
          </>
        );

      case "error":
        return (
          <>
            <div className={styles.successContent}>
              <Typography
                variant={"druk"}
                weight={"wide"}
                size={24}
                lineHeight={28}
                textAlign={"center"}
                className={styles.title}
              >
                Podium created!
              </Typography>
              <Typography
                variant={"geist"}
                weight={"regular"}
                size={14}
                lineHeight={20}
                textAlign={"center"}
                className={styles.errorMessage}
              >
                Share verification failed. You can still claim your 10x rewards
                later: {errorMessage}
              </Typography>
            </div>
            <div className={styles.actionGroup}>
              <Button
                variant={"primary"}
                caption="Try sharing again"
                onClick={handleRetryShare}
              />
              <Button
                variant={"underline"}
                caption="Continue anyway"
                onClick={handleClickContinue}
              />
            </div>
          </>
        );

      case "skipped":
        return (
          <>
            <div className={styles.successContent}>
              <Typography
                variant={"druk"}
                weight={"wide"}
                size={24}
                lineHeight={28}
                textAlign={"center"}
                className={styles.title}
              >
                Podium created!
              </Typography>
              <Typography
                variant={"geist"}
                weight={"regular"}
                size={14}
                lineHeight={20}
                textAlign={"center"}
                className={styles.subtitle}
              >
                Share verification was skipped. Share your cast to unlock 10x
                BRND rewards!
              </Typography>
            </div>
            <div className={styles.actionGroup}>
              <Button
                variant={"primary"}
                caption="Try sharing"
                onClick={handleRetryShare}
              />
              <Button
                variant={"underline"}
                caption="Continue"
                onClick={handleClickContinue}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.body}>
      {/* Only show confetti on success */}
      {verificationState === "success" && (
        <div className={styles.effect}>
          <Confetti width={width} height={height} />
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.center}>
          <img src={Logo} className={styles.logo} alt="Logo" />
        </div>
      </div>

      <div className={styles.confirmation}>{renderContent()}</div>
    </div>
  );
}
