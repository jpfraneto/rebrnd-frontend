// Dependencies
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// StyleSheet
import styles from "./AirdropPage.module.scss";

// Components
import Typography from "@/shared/components/Typography";
import LoaderIndicator from "@/shared/components/LoaderIndicator";
import Button from "@/shared/components/Button";

// Hooks
import { useAirdropCheck } from "@/shared/hooks/user/useAirdropCheck";
import { useAirdropLeaderboard } from "@/shared/hooks/user/useAirdropLeaderboard";
import { useAirdropClaimStatus } from "@/shared/hooks/user/useAirdropClaimStatus";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";
import sdk from "@farcaster/miniapp-sdk";
import CheckLabelIcon from "@/assets/icons/check-label-icon.svg?react";
import { useAuth } from "@/shared/hooks/auth/useAuth";
import AirdropSvg from "@/shared/assets/images/airdrop.svg?react";
import IncompleteTaskIcon from "@/shared/assets/icons/incomplete-task.svg?react";
import QuestionMarkIcon from "@/shared/assets/icons/question-mark.svg?react";

// Assets
import airdropBackgroundImage from "@/shared/assets/images/airdrop-background.png";

// Partials
import ClaimAirdrop from "./partials/ClaimAirdrop";

const AIRDROP_STORAGE_KEY = "airdrop_data";

// Challenge name mapping from API to display titles
const challengeMapping: Record<string, string> = {
  "Follow Accounts": "FOLLOW @BRND + @FLOC",
  "Channel Interaction /brnd": "INTERACT WITH /BRND CHANNEL",
  "Holding $BRND": "HOLDING $BRND",
  "Collect @brndbot casts": "COLLECT BRND CAST COLLECTIBLES",
  "# of different brands voted": "VOTING FOR DIFFERENT BRANDS",
  "Podiums Shared": "SHARING PODIUMS",
  "Neynar Score": "NEYNAR SCORE",
  "Pro User": "FARCASTER PRO",
};

type PageView = "main" | "leaderboard" | "multipliers" | "claim";

function AirdropPage(): React.ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedQuest, setExpandedQuest] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<PageView>("main");
  const [storedData, setStoredData] = useState<any>(null);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [airdropState, setAirdropState] = useState<{
    canClaim: boolean;
    reason: string;
    hasClaimed: boolean;
    eligibleAmount: string | null;
    isReady: boolean;
  } | null>(null);

  const AIRDROP_TIMESTAMP_ENV = import.meta.env.VITE_AIRDROP_TIMESTAMP;
  const AIRDROP_TIMESTAMP = Number(AIRDROP_TIMESTAMP_ENV);

  const { data: authData } = useAuth();

  // Use airdrop data from auth endpoint for fast rendering
  const airdropData = authData?.airdrop;
  const hasAirdropData = !!airdropData;
  const isEligibleForAirdrop = airdropData?.isEligible || false;
  const snapshotExists = airdropData?.snapshotExists || false;
  const hasAllocation = !!(
    airdropData?.tokenAllocation && airdropData.tokenAllocation > 0
  );

  // Check claim status
  const {
    data: claimStatusData,
    isLoading: isClaimStatusLoading,
    error: claimStatusError,
  } = useAirdropClaimStatus({ enabled: true });

  // Memoize options to prevent unnecessary re-renders and recursive calls
  const airdropCheckOptions = useMemo(
    () => ({ enabled: shouldFetch }),
    [shouldFetch]
  );

  const { data, isLoading, isFetching, error, refetch } =
    useAirdropCheck(airdropCheckOptions);

  // Use isFetching for refetches, isLoading for initial load
  const isCheckingAirdrop = isLoading || isFetching;

  // Countdown to midnight UTC (same as CongratsView)
  const [countdown, setCountdown] = useState<string>("00:00:00");

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

  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useAirdropLeaderboard(100);

  // Preload background image on mount
  useEffect(() => {
    const img = new Image();
    img.src = airdropBackgroundImage;
  }, []);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(AIRDROP_STORAGE_KEY);
    if (savedData) {
      try {
        setStoredData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to parse stored airdrop data:", e);
      }
    }
  }, []);

  // Tick every second to update countdown
  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Handle route changes
  useEffect(() => {
    if (location.pathname === "/claim-airdrop") {
      setCurrentView("claim");
    } else {
      setCurrentView("main");
    }
  }, [location.pathname]);

  // Save data to localStorage when new data arrives
  useEffect(() => {
    if (data) {
      localStorage.setItem(AIRDROP_STORAGE_KEY, JSON.stringify(data));
      setStoredData(data);
      setShouldFetch(false);
    }
  }, [data]);

  // Update airdrop state based on claim status
  useEffect(() => {
    if (claimStatusData?.success) {
      const { canClaim, reason, hasClaimed, contractStatus, eligibility } =
        claimStatusData.data;
      setAirdropState({
        canClaim,
        reason,
        hasClaimed,
        eligibleAmount: eligibility.amount,
        isReady: contractStatus.claimingEnabled && contractStatus.merkleRootSet,
      });
    }
  }, [claimStatusData]);

  const handleCheckAirdrop = () => {
    sdk.haptics.selectionChanged();
    setShouldFetch(true);
    refetch();
  };

  const handleMultipliersClick = (e: React.MouseEvent) => {
    sdk.haptics.selectionChanged();
    e.preventDefault();
    e.stopPropagation();
    setCurrentView("multipliers");
  };

  const handleLeaderboardClick = (e: React.MouseEvent) => {
    sdk.haptics.selectionChanged();
    e.preventDefault();
    e.stopPropagation();
    setCurrentView("leaderboard");
  };

  const handleClaimAirdrop = () => {
    sdk.haptics.selectionChanged();
    setCurrentView("claim");
  };

  const handleBackToMain = () => {
    sdk.haptics.selectionChanged();
    if (currentView !== "main") {
      setCurrentView("main");
    } else {
      navigate(-1);
    }
  };

  const toggleQuest = (questId: number) => {
    sdk.haptics.selectionChanged();
    setExpandedQuest(expandedQuest === questId ? null : questId);
  };

  // Use stored data or fetched data
  const currentData = data || storedData;

  // Transform API challenges to quest format
  const questsData =
    currentData?.calculation.challenges.map((challenge: any, index: number) => {
      const completedTiers = challenge.tiers.filter(
        (tier: any) => tier.achieved
      ).length;
      const totalTiers = challenge.tiers.length;
      const progress = `${completedTiers}/${totalTiers}`;

      // Calculate progress percentage
      const progressPercentage = Math.min(
        (challenge.progress.current / challenge.progress.required) * 100,
        100
      );

      // Find next tier requirement
      const nextTier = challenge.tiers.find(
        (tier: any) =>
          !tier.achieved && tier.requirement > challenge.progress.current
      );

      const tasks = challenge.tiers.map((tier: any) => ({
        name: `${tier.requirement} ${challenge.progress.unit}`,
        multiplier: `${tier.multiplier}X`,
        completed: tier.achieved,
        requirement: tier.requirement,
        isCurrentTier: tier.requirement === challenge.progress.required,
      }));

      return {
        id: index + 1,
        title: challengeMapping[challenge.name] || challenge.name,
        progress,
        isCompleted: challenge.completed,
        tasks,
        currentMultiplier: challenge.currentMultiplier,
        maxMultiplier: challenge.maxMultiplier,
        // Enhanced progress data
        currentValue: challenge.currentValue,
        progressData: challenge.progress,
        progressPercentage,
        nextTier,
        description: challenge.description,
        details: challenge.details,
      };
    }) || [];

  // Show loading state only for initial data fetch (not for refresh)
  if (isLoading && !currentData) {
    return (
      <div className={styles.container}>
        <LoaderIndicator size={30} variant={"fullscreen"} />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.airdropTitle}>
          <Typography
            variant="druk"
            weight="wide"
            size={48}
            lineHeight={48}
            className={styles.airdropTitleText}
          >
            AIRDROP
          </Typography>
        </div>

        <div className={styles.headerSection}>
          <button className={styles.backButton} onClick={handleBackToMain}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18L9 12L15 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.emptyState}>
          <Typography variant="geist" weight="medium" size={16}>
            Failed to load airdrop data
          </Typography>
        </div>

        <div className={styles.claimSection}>
          <Button
            caption={"Try Again"}
            onClick={handleCheckAirdrop}
            loading={isCheckingAirdrop}
          />
        </div>
      </div>
    );
  }

  // Show not eligible screen if snapshot exists but user is not eligible
  if (hasAirdropData && snapshotExists && !isEligibleForAirdrop) {
    return (
      <div className={styles.container}>
        <div className={styles.airdropTitle}>
          <AirdropSvg />
        </div>

        <div className={styles.notEligibleContainer}>
          <div className={styles.notEligibleMessages}>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              We are sorry, but you are out of the 1111 top users on our
              leaderboard.
            </Typography>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              (Your rank is {authData?.leaderboardPosition})
            </Typography>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              You are not eligible for the BRND airdrop.
            </Typography>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              This updates in: {countdown}
            </Typography>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              And the airdrop week starts in 7 days.
            </Typography>
            <Typography
              variant="geist"
              weight="medium"
              size={16}
              lineHeight={20}
              textAlign="center"
              className={styles.notEligibleText}
            >
              You can still get in! Start voting and sharing podiums now to add
              points.
            </Typography>
          </div>
        </div>

        <div className={styles.notEligibleButtonSection}>
          <Button
            caption="Back Home"
            onClick={handleBackToMain}
            variant="primary"
          />
        </div>
      </div>
    );
  }

  // Show claim view if user is eligible, snapshot exists, and has allocation
  // OR if current view is explicitly set to claim
  if (
    (hasAirdropData &&
      snapshotExists &&
      isEligibleForAirdrop &&
      hasAllocation) ||
    currentView === "claim"
  ) {
    // Prepare airdrop data for ClaimAirdrop component
    // Use data from /me endpoint if available, otherwise fallback to fetched data
    const claimAirdropData =
      hasAirdropData && airdropData
        ? {
            calculation: {
              finalScore: airdropData.airdropScore || 0,
              leaderboardPosition: airdropData.leaderboardPosition || 0,
              tokenAllocation: airdropData.tokenAllocation || 0,
              totalMultiplier: 0, // Not available in /me endpoint, but ClaimAirdrop can handle it
            },
          }
        : currentData;

    return (
      <ClaimAirdrop airdropData={claimAirdropData} onBack={handleBackToMain} />
    );
  }

  // Main component with data
  return (
    <div className={styles.container}>
      <div className={styles.airdropTitle}>
        <AirdropSvg />
      </div>

      <div className={styles.airdropHeader}>
        <button className={styles.backButton} onClick={handleBackToMain}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18L9 12L15 6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {currentView === "multipliers" ? (
          <div className={`${styles.leaderboardCard} ${styles.nonClickable}`}>
            <div className={styles.leaderboardContent}>
              <div className={styles.leaderboardLabelContainer}>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={14}
                  lineHeight={18}
                  className={styles.leaderboardLabel}
                >
                  HOW MULTIPLIERS WORK
                </Typography>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`${styles.leaderboardCard} ${
              currentView === "main" ? "" : styles.nonClickable
            }`}
            onClick={
              currentView === "main" ? handleLeaderboardClick : undefined
            }
          >
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
              {currentView === "main" && (
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
              )}

              <div className={styles.pointsDisplay}>
                <Typography
                  variant="druk"
                  weight="wide"
                  size={28}
                  lineHeight={32}
                  className={styles.pointsNumber}
                >
                  {(hasAirdropData
                    ? airdropData?.airdropScore
                    : currentData?.calculation.finalScore
                  )?.toLocaleString() || "—"}
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
              <Typography
                variant="druk"
                weight="wide"
                size={32}
                lineHeight={32}
                className={styles.rankNumber}
              >
                #
                {(hasAirdropData
                  ? airdropData?.leaderboardPosition
                  : currentData?.calculation.leaderboardPosition) || "—"}
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* Main View - Multipliers Section */}
      {currentView === "main" && currentData && (
        <div className={styles.multipliersSection}>
          <div className={styles.multipliersTextButton}>
            <Typography
              variant="geist"
              weight="medium"
              size={12}
              lineHeight={16}
            >
              Updates in: {countdown}
            </Typography>
          </div>
          <span onClick={handleMultipliersClick}>
            {" "}
            <Typography
              variant="geist"
              weight="medium"
              size={12}
              lineHeight={16}
              className={styles.howMultipliersWork}
            >
              How Multipliers work <QuestionMarkIcon />
            </Typography>
          </span>
        </div>
      )}

      {/* Leaderboard View - Share Button */}
      {currentView === "leaderboard" && currentData && (
        <div className={styles.shareButton}>
          <Button
            caption="Share"
            onClick={() => {
              sdk.haptics.selectionChanged();
              sdk.actions.composeCast({
                text: `Check out your points for the $BRND airdrop!\n\nMy stats:\n\nLeaderboard Position: #${
                  (hasAirdropData
                    ? airdropData?.leaderboardPosition
                    : currentData?.calculation.leaderboardPosition) || "—"
                }\nPoints: ${
                  (hasAirdropData
                    ? airdropData?.airdropScore
                    : currentData?.calculation.finalScore
                  )?.toLocaleString() || "—"
                }`,
                embeds: ["https://rebrnd.lat"],
              });
            }}
            variant="primary"
          />
        </div>
      )}

      {/* Main View - Quests List */}
      {currentView === "main" && currentData ? (
        <div className={styles.questsList}>
          {questsData.map((quest: any) => (
            <div key={quest.id} className={styles.questItem}>
              <div
                className={`${styles.questHeader} ${
                  quest.isCompleted ? styles.completed : ""
                }`}
                onClick={() => toggleQuest(quest.id)}
              >
                <Typography
                  variant="druk"
                  weight="bold"
                  size={21}
                  lineHeight={16}
                  className={styles.questNumber}
                >
                  {quest.id}
                </Typography>
                <div className={styles.questContent}>
                  <Typography
                    variant="geist"
                    weight="medium"
                    size={14}
                    lineHeight={16}
                    className={styles.questTitle}
                  >
                    {quest.title}
                  </Typography>
                  <div className={styles.questProgressInfo}>
                    <Typography
                      variant="geist"
                      weight="medium"
                      size={12}
                      lineHeight={14}
                      className={styles.questProgress}
                    >
                      {quest.progressData.unit === "$BRND"
                        ? `${Math.round(
                            quest.progressData.current
                          ).toLocaleString()} / ${Math.round(
                            quest.progressData.required
                          ).toLocaleString()} ${quest.progressData.unit}`
                        : `${quest.progressData.current.toLocaleString()} / ${quest.progressData.required.toLocaleString()} ${
                            quest.progressData.unit
                          }`}
                    </Typography>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${quest.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                  {quest.nextTier && (
                    <Typography
                      variant="geist"
                      weight="medium"
                      size={10}
                      lineHeight={12}
                      className={styles.nextTierInfo}
                    >
                      Next: {quest.nextTier.requirement.toLocaleString()}{" "}
                      {quest.progressData.unit} ({quest.nextTier.multiplier}X)
                    </Typography>
                  )}
                </div>
                <div className={styles.questToggle} aria-hidden>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={
                      expandedQuest === quest.id
                        ? styles.chevronUp
                        : styles.chevronDown
                    }
                  >
                    <path
                      d="M15 18L9 12L15 6"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {expandedQuest === quest.id && (
                <div className={styles.questDetails}>
                  <div className={styles.tiersSection}>
                    {quest.tasks.map((task: any, index: number) => (
                      <div key={index} className={`${styles.taskItem}`}>
                        <Typography
                          variant="geist"
                          weight="medium"
                          size={14}
                          lineHeight={18}
                          className={styles.taskName}
                        >
                          {task.name}
                        </Typography>
                        <Typography
                          variant="druk"
                          weight="condensed"
                          size={20}
                          lineHeight={14}
                          className={styles.taskMultiplier}
                        >
                          {task.multiplier}
                        </Typography>
                        <div
                          className={`${styles.taskStatus} ${
                            task.completed ? styles.taskCompleted : ""
                          }`}
                          aria-hidden
                        >
                          {task.completed ? (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              className={styles.statusIcon}
                            >
                              <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
                              <path
                                d="M7.5 12.5L10.5 15.5L16.5 9.5"
                                stroke="#6A45FF"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <IncompleteTaskIcon
                              width={24}
                              height={24}
                              className={styles.statusIcon}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : currentView === "main" && !currentData ? (
        <div className={styles.emptyState}>
          <Typography
            variant="geist"
            weight="medium"
            size={16}
            className={styles.emptyStateText}
          >
            Check your airdrop eligibility and multipliers
          </Typography>
        </div>
      ) : null}

      {/* Leaderboard View - Leaderboard List */}
      {currentView === "leaderboard" && (
        <div className={styles.leaderboardList}>
          {leaderboardLoading ? (
            <div className={styles.leaderboardLoading}>
              <LoaderIndicator size={24} />
            </div>
          ) : (
            leaderboardData?.leaderboard.map((entry) => {
              const isCurrentUser = entry.fid === authData?.fid;
              return (
                <div
                  key={entry.fid}
                  className={`${styles.leaderboardItem} ${
                    isCurrentUser ? styles.highlighted : ""
                  }`}
                  onClick={() => {
                    sdk.actions.viewProfile({ fid: entry.fid });
                  }}
                >
                  <Typography
                    variant="geist"
                    weight="medium"
                    size={14}
                    lineHeight={18}
                  >
                    {String(entry.rank).padStart(2, "0")}
                  </Typography>

                  <div className={styles.leaderboardUser}>
                    <div className={styles.smallPfp}>
                      <img
                        src={entry.photoUrl!}
                        alt={entry.username}
                        className={styles.pfpImage}
                      />
                    </div>
                    <Typography
                      variant="geist"
                      weight="bold"
                      size={14}
                      className={styles.leaderboardName}
                    >
                      {entry.username}
                    </Typography>
                  </div>
                  <Typography
                    variant="geist"
                    weight="bold"
                    size={16}
                    className={styles.leaderboardPoints}
                  >
                    {Math.round(entry.finalScore)}
                  </Typography>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Multipliers View - Multipliers Info */}
      {currentView === "multipliers" && (
        <div className={styles.multipliersContent}>
          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={20}
            className={styles.multiplierText}
          >
            Multipliers boost your airdrop points! Complete different activities
            to earn higher multipliers:
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Follow @BRND + @FLOC accounts (up to 1.4x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Interact with /brnd channel and share podiums (up to 1.4x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Hold $BRND tokens - more tokens = higher multiplier (up to 1.8x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Collect @brndbot cast collectibles (up to 1.8x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Vote for different brands - more variety = higher rewards (up to
            1.8x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Share your voting results as podiums (up to 1.8x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Have a high Neynar reputation score (up to 1.8x)
          </Typography>

          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.multiplierText}
          >
            • Be a Farcaster Pro user (up to 1.4x)
          </Typography>

          <Typography
            variant="geist"
            weight="bold"
            size={14}
            lineHeight={20}
            className={styles.multiplierText}
          >
            All multipliers stack together! Your final score = Base Points × All
            Multipliers
          </Typography>
        </div>
      )}

      {/* Main View - Claim/Check Button */}
      {currentView === "main" && (
        <div className={styles.claimSection}>
          {(() => {
            // Show loading while checking claim status
            if (isClaimStatusLoading && !airdropState) {
              return (
                <Button
                  iconLeft={<CheckLabelIcon />}
                  caption="Checking Eligibility..."
                  loading={true}
                  disabled={true}
                  onClick={() => {}}
                />
              );
            }

            // Show error state
            if (claimStatusError) {
              return (
                <Button
                  iconLeft={<CheckLabelIcon />}
                  caption="Check Eligibility"
                  onClick={handleCheckAirdrop}
                  loading={isCheckingAirdrop}
                />
              );
            }

            // Priority 1: Use new airdrop data from /me endpoint when available
            if (hasAirdropData && snapshotExists) {
              if (isEligibleForAirdrop) {
                // Check if already claimed via claim status
                if (airdropState?.hasClaimed) {
                  return (
                    <Button
                      iconLeft={<CheckLabelIcon />}
                      caption="Already Claimed!"
                      disabled={true}
                      onClick={() => {}}
                    />
                  );
                }

                // Eligible and can claim
                return (
                  <Button
                    iconLeft={<CheckLabelIcon />}
                    caption="Claim Airdrop"
                    onClick={handleClaimAirdrop}
                    loading={isLoading}
                  />
                );
              } else {
                // Not eligible
                return (
                  <Button
                    iconLeft={<CheckLabelIcon />}
                    caption="Not Eligible"
                    disabled={true}
                    onClick={() => {}}
                  />
                );
              }
            }

            // Priority 2: Snapshot doesn't exist yet, show eligibility check
            if (hasAirdropData && !snapshotExists) {
              return (
                <Button
                  iconLeft={<CheckLabelIcon />}
                  caption="Check Eligibility"
                  onClick={handleCheckAirdrop}
                  loading={isCheckingAirdrop}
                />
              );
            }

            // Priority 3: Fallback to original airdrop state logic for backward compatibility
            if (airdropState) {
              // Already claimed
              if (airdropState.hasClaimed) {
                return (
                  <Button
                    iconLeft={<CheckLabelIcon />}
                    caption="Already Claimed!"
                    disabled={true}
                    onClick={() => {}}
                  />
                );
              }

              // Not eligible
              if (!airdropState.canClaim && !airdropState.isReady) {
                return (
                  <Button
                    iconLeft={<CheckLabelIcon />}
                    caption={airdropState.reason}
                    disabled={true}
                    onClick={() => {}}
                  />
                );
              }

              // Eligible and can claim
              if (airdropState.canClaim && airdropState.isReady) {
                return (
                  <Button
                    iconLeft={<CheckLabelIcon />}
                    caption="Claim Airdrop"
                    onClick={handleClaimAirdrop}
                    loading={isLoading}
                  />
                );
              }
            }

            // Priority 4: Fallback to countdown/eligibility check
            const nowSeconds = Math.floor(nowMs / 1000);
            const isLive =
              AIRDROP_TIMESTAMP > 0 && nowSeconds >= AIRDROP_TIMESTAMP;
            const remaining = Math.max(AIRDROP_TIMESTAMP - nowSeconds, 0);

            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;

            const countdownLabel = `${days}d ${String(hours).padStart(
              2,
              "0"
            )}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
              2,
              "0"
            )}s`;

            return (
              <Button
                iconLeft={<CheckLabelIcon />}
                caption={
                  isLive ? "Check Eligibility" : `Claim In ${countdownLabel}`
                }
                onClick={isLive ? handleCheckAirdrop : handleCheckAirdrop}
                loading={isCheckingAirdrop}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default withProtectionRoute(React.memo(AirdropPage), "only-connected");
