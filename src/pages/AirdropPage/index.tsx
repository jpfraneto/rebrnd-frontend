// Dependencies
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./AirdropPage.module.scss";

// Components
import Typography from "@/shared/components/Typography";
import LoaderIndicator from "@/shared/components/LoaderIndicator";
import Button from "@/shared/components/Button";

// Hooks
import { useAirdropCheck } from "@/shared/hooks/user/useAirdropCheck";
import { useAirdropLeaderboard } from "@/shared/hooks/user/useAirdropLeaderboard";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";
import sdk from "@farcaster/miniapp-sdk";
import CheckLabelIcon from "@/assets/icons/check-label-icon.svg?react";
import { useAuth } from "@/shared/hooks/auth/useAuth";
import AirdropSvg from "@/shared/assets/images/airdrop.svg?react";
import IncompleteTaskIcon from "@/shared/assets/icons/incomplete-task.svg?react";
import QuestionMarkIcon from "@/shared/assets/icons/question-mark.svg?react";

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

type PageView = "main" | "leaderboard" | "multipliers";

function AirdropPage(): React.ReactNode {
  const navigate = useNavigate();
  const [expandedQuest, setExpandedQuest] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<PageView>("main");
  const [storedData, setStoredData] = useState<any>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  const { data: authData } = useAuth();
  console.log("THE AUTH DATA IS", authData);

  const { data, isLoading, error, refetch } = useAirdropCheck({
    enabled: shouldFetch,
  });
  console.log("THE AIRDROP DATA IS", data);

  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useAirdropLeaderboard(100);

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

  // Save data to localStorage when new data arrives
  useEffect(() => {
    if (data) {
      localStorage.setItem(AIRDROP_STORAGE_KEY, JSON.stringify(data));
      setStoredData(data);
      setShouldFetch(false);
    }
  }, [data]);

  const handleCheckAirdrop = () => {
    sdk.haptics.selectionChanged();
    setShouldFetch(true);
    refetch();
  };

  const handleMultipliersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentView("multipliers");
  };

  const handleLeaderboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentView("leaderboard");
  };

  const handleBackToMain = () => {
    if (currentView !== "main") {
      setCurrentView("main");
    } else {
      navigate(-1);
    }
  };

  const toggleQuest = (questId: number) => {
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
            loading={isLoading}
          />
        </div>
      </div>
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
                  {currentData?.calculation.finalScore?.toLocaleString() || "—"}
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
                #{currentData?.calculation.leaderboardPosition || "—"}
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* Main View - Multipliers Section */}
      {currentView === "main" && currentData && (
        <div className={styles.multipliersSection}>
          <Typography
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={20}
            className={styles.multipliersLabel}
          >
            Multipliers for the airdrop
          </Typography>
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
              sdk.actions.composeCast({
                text: `Check out your points for the $BRND airdrop!\n\nMy stats:\nLeaderboard Position: #${
                  currentData?.calculation.leaderboardPosition || "—"
                }\nPoints: ${
                  currentData?.calculation.finalScore?.toLocaleString() || "—"
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
          <Button
            iconLeft={<CheckLabelIcon />}
            caption={currentData ? "Refresh Status" : "Check My Status"}
            onClick={handleCheckAirdrop}
            loading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

export default withProtectionRoute(React.memo(AirdropPage), "only-connected");
