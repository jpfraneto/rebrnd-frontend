// Dependencies
import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

// StyleSheet
import styles from "./Power.module.scss";

// Hooks
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { usePowerLevel } from "@/shared/contexts/PowerLevelContext";

// Components
import Typography from "@/components/Typography";
import QuestionMarkIcon from "@/shared/assets/icons/question-mark.svg?react";
import IncompleteTaskIcon from "@/shared/assets/icons/incomplete-task.svg?react";
import LoaderIndicator from "@/shared/components/LoaderIndicator";
import sdk from "@farcaster/miniapp-sdk";

// Modal
import { useModal, ModalsIds } from "@/shared/hooks/ui/useModal";
import { useAuth } from "@/shared/hooks/auth";
import { useNavigate } from "react-router-dom";

interface Level {
  id: number;
  title: string;
  description: string;
  multiplier: number;
  leaderboardPoints: number;
  podiumPoints: number;
  shareReward: number;
  isCompleted: boolean;
  isActive: boolean;
  actionType: "follow" | "stake" | "streak" | "podiums" | "collectibles";
  actionValue?: string;
  progress?: { current: number; total: number; maxStreak?: number };
  showButton: boolean;
  clickFunction?: () => void;
  requirement?: {
    type: string;
    value: number;
    unit: string;
  };
}

const Power: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null); // Track level we're leveling up to

  const { openModal } = useModal();
  const queryClient = useQueryClient();

  const { data: authData } = useAuth();
  const userFid = authData?.fid;

  const navigate = useNavigate();

  // Use shared power level context
  const { setOptimisticLevel, getDisplayLevel } = usePowerLevel();

  const {
    isConnected,
    levelUpBrndPower,
    getPowerLevelInfo,
    isPending,
    isConfirming,
    error,
  } = useStoriesInMotion(
    // onAuthorizeSuccess
    () => {
      console.log("Wallet authorized successfully!");
      // Only reload levels list, not current level (that comes from /me)
      if (userFid) {
        loadLevelsList();
      }
    },
    // onLevelUpSuccess
    async (txData) => {
      console.log("Level up successful!", txData);
      const targetLevel = pendingLevelUp;

      if (targetLevel !== null) {
        // Optimistically update the shared level context immediately
        console.log("Optimistically updating shared level to:", targetLevel);
        setOptimisticLevel(targetLevel);
        setPendingLevelUp(null);
      }

      setIsLevelingUp(false);

      // Invalidate auth queries to refresh backend data (including brndPowerLevel)
      queryClient.invalidateQueries({ queryKey: ["auth"] });

      // Show success feedback immediately
      sdk.haptics.notificationOccurred("success");

      // Reload levels list to update completion status
      if (userFid) {
        await loadLevelsList();
      }
    }
  );

  // Load levels list from backend (current level comes from /me endpoint via authData)
  const loadLevelsList = async () => {
    if (!userFid) return;

    setIsLoading(true);
    try {
      const info = await getPowerLevelInfo(userFid);

      // Convert backend levels to component format
      const convertedLevels =
        info.allLevels?.map((level: any) => {
          const progress = level.progress
            ? {
                current: level.progress.current,
                total: level.progress.total,
                // Extract maxStreak from level progress first, then fallback to top-level progress
                maxStreak:
                  level.progress.maxStreak ||
                  info.progress?.maxStreak ||
                  info.progress?.maxDailyStreak ||
                  undefined,
              }
            : undefined;

          // For streak levels, check completion based on maxStreak if available
          // If maxStreak >= total, the user has completed this mission before
          let isCompleted = level.isCompleted;
          if (
            level.actionType === "streak" &&
            progress?.maxStreak !== undefined &&
            progress?.total !== undefined
          ) {
            isCompleted = progress.maxStreak >= progress.total;
          }

          return {
            id: level.id,
            title: level.title,
            description: level.description,
            multiplier: level.multiplier,
            leaderboardPoints: level.id * 6, // Calculated
            podiumPoints: level.id * 100, // Calculated
            shareReward: level.id * 1000, // Calculated
            isCompleted,
            isActive: level.isActive,
            actionType: level.actionType,
            actionValue: level.requirement?.value.toString(),
            requirement: level.requirement,
            progress,
            showButton:
              level.actionType === "follow" || level.actionType === "stake",
            clickFunction: level.clickFunction,
          };
        }) || [];

      setLevels(convertedLevels);
    } catch (error) {
      console.error("Failed to load levels list:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Default levels when no backend data is available (Level 0 users)
  const getDefaultLevels = (): Level[] => [
    {
      id: 1,
      title: "FOLLOW @BRND",
      description:
        "x1.5 rewards → 10 puntos al usuario en Leaderboard / 150 podium points $BRND / Claim por Share podium → 1500 $BRND",
      multiplier: 1.5,
      leaderboardPoints: 10,
      podiumPoints: 150,
      shareReward: 1500,
      isCompleted: false, // Can't check follow status without FID
      isActive: true, // Always active for level 0 users
      actionType: "follow",
      actionValue: "@BRND",
      clickFunction: () => {
        console.log("IN HEREEEE");
        sdk.actions.viewProfile({ fid: 1108951 });
      },
      showButton: true,
      requirement: { type: "follow", value: 1, unit: "user" },
    },
    {
      id: 2,
      title: "STAKE 2M $BRND",
      description:
        "x2 rewards → 12 puntos al usuario en Leaderboard / 200 podium points $BRND / Claim por Share podium → 2000 $BRND",
      multiplier: 2,
      leaderboardPoints: 12,
      podiumPoints: 200,
      shareReward: 2000,
      isCompleted: false,
      isActive: false, // Only level 1 is active for level 0 users
      actionType: "stake",
      actionValue: "2000000",
      showButton: false,
      requirement: { type: "stake", value: 2000000, unit: "BRND" },
    },
    {
      id: 3,
      title: "Podium streak: 5 days",
      description:
        "x3 rewards → 18 puntos al usuario en Leaderboard / 300 podium points $BRND / Claim por Share podium → 3000 $BRND",
      multiplier: 3,
      leaderboardPoints: 18,
      podiumPoints: 300,
      shareReward: 3000,
      isCompleted: false,
      isActive: false,
      actionType: "streak",
      actionValue: "5",
      showButton: false,
      requirement: { type: "streak", value: 5, unit: "days" },
    },
    {
      id: 4,
      title: "STAKE 4M $BRND",
      description:
        "x4 rewards → 24 puntos al usuario en Leaderboard / 400 podium points $BRND / Claim por Share podium → 4000 $BRND",
      multiplier: 4,
      leaderboardPoints: 24,
      podiumPoints: 400,
      shareReward: 4000,
      isCompleted: false,
      isActive: false,
      actionType: "stake",
      actionValue: "4000000",
      showButton: false,
      requirement: { type: "stake", value: 4000000, unit: "BRND" },
    },
    {
      id: 5,
      title: "100 podiums completed",
      description:
        "x5 rewards → 30 puntos al usuario en Leaderboard / 500 podium points $BRND / Claim por Share podium → 5000 $BRND",
      multiplier: 5,
      leaderboardPoints: 30,
      podiumPoints: 500,
      shareReward: 5000,
      isCompleted: false,
      isActive: false,
      actionType: "podiums",
      actionValue: "100",
      showButton: false,
      requirement: { type: "podiums", value: 100, unit: "completed" },
    },
    {
      id: 6,
      title: "STAKE 6M $BRND",
      description:
        "x6 rewards → 36 puntos al usuario en Leaderboard / 600 podium points $BRND / Claim por Share podium → 6000 $BRND",
      multiplier: 6,
      leaderboardPoints: 36,
      podiumPoints: 600,
      shareReward: 6000,
      isCompleted: false,
      isActive: false,
      actionType: "stake",
      actionValue: "6000000",
      showButton: false,
      requirement: { type: "stake", value: 6000000, unit: "BRND" },
    },
    {
      id: 7,
      title: "Collect 7 BRND Collectible Casts",
      description:
        "x7 rewards → 42 puntos al usuario en Leaderboard / 700 podium points $BRND / Claim por Share podium → 7000 $BRND",
      multiplier: 7,
      leaderboardPoints: 42,
      podiumPoints: 700,
      shareReward: 7000,
      isCompleted: false,
      isActive: false,
      actionType: "collectibles",
      actionValue: "7",
      showButton: false,
      requirement: { type: "collectibles", value: 7, unit: "casts" },
    },
    {
      id: 8,
      title: "STAKE 8M $BRND",
      description:
        "x8 rewards → 48 puntos al usuario en Leaderboard / 800 podium points $BRND / Claim por Share podium → 8000 $BRND",
      multiplier: 8,
      leaderboardPoints: 48,
      podiumPoints: 800,
      shareReward: 8000,
      isCompleted: false,
      isActive: false,
      actionType: "stake",
      actionValue: "8000000",
      showButton: false,
      requirement: { type: "stake", value: 8000000, unit: "BRND" },
    },
  ];

  // Load levels list when component mounts or userFid changes
  // Current level comes from authData?.brndPowerLevel (via /me endpoint)
  useEffect(() => {
    if (userFid) {
      loadLevelsList();
    } else {
      // Show default levels when no user data
      setLevels(getDefaultLevels());
    }
  }, [userFid]);

  const handleLevelAction = async (level: Level) => {
    if (!isConnected) {
      console.log("Wallet not connected");
      return;
    }
    // Use shared context level (includes optimistic updates)
    const userCurrentLevel = getDisplayLevel();
    const isNextLevel = level.id === userCurrentLevel + 1;

    if (!isNextLevel) {
      return; // Only allow action on next level
    }

    // For Level 0 users trying to level up to Level 1 (Follow @BRND)
    if (
      userCurrentLevel === 0 &&
      level.id === 1 &&
      level.actionType === "follow"
    ) {
      console.log(
        "the current level is 0 and the level is 1 and the action type is follow"
      );
      sdk.actions.viewProfile({ fid: 1108951 });
      if (!userFid) {
        // Need to authorize wallet first to check follow status
        console.log("Need to authorize wallet to check follow status");
        return;
      }
    }

    if (level.isCompleted) {
      console.log("the level is completed");
      // Requirements met, can level up - directly trigger level up
      await handleLevelUp(level.id);
    } else {
      // Requirements not met, perform action
      if (level.actionType === "follow") {
        // Handle follow action - opens profile in miniapp
        if (level.clickFunction) {
          console.log("the click function is: ", level.clickFunction);
          level.clickFunction();
        }
      } else if (level.actionType === "stake") {
        // Navigate to stake page
        console.log("Navigate to stake page");
        // This could open a modal or navigate to /stake
        sdk.haptics.selectionChanged();
        navigate("/stake");
      }
    }
  };

  const handleLevelUp = async (targetLevel: number) => {
    if (!targetLevel) return;

    // Store the target level so we can optimistically update on success
    setPendingLevelUp(targetLevel);
    setIsLevelingUp(true);
    try {
      // This will call the backend API and then the smart contract
      await levelUpBrndPower(targetLevel);
      // Success is handled by the onLevelUpSuccess callback
    } catch (error: any) {
      console.error("Level up failed:", error);
      // Error is handled by useStoriesInMotion hook
      setPendingLevelUp(null);
      setIsLevelingUp(false);
    }
  };

  const renderActionButton = (level: Level) => {
    // Use shared context level (includes optimistic updates)
    const userCurrentLevel = getDisplayLevel();
    const isNextLevel = level.id === userCurrentLevel + 1;
    // For streak levels, isCompleted is based on maxStreak >= total (not just current >= total)
    const canLevelUp = level.isCompleted && isNextLevel;

    // Only show button for the next available level
    if (!isNextLevel) {
      return null;
    }

    if (canLevelUp) {
      return (
        <button
          className={`${styles.actionButton} ${styles.levelUpButton}`}
          onClick={() => handleLevelUp(level.id)}
          disabled={isPending || isConfirming || isLevelingUp}
        >
          {isPending || isConfirming || isLevelingUp ? (
            <LoaderIndicator size={16} />
          ) : (
            <Typography variant="geist" weight="bold" size={14} lineHeight={24}>
              LEVEL UP
            </Typography>
          )}
        </button>
      );
    }

    // Only show action buttons for follow/stake actions when requirements aren't met
    // Don't show "Complete" button for streak/podiums/collectibles - they need to be completed first
    if (level.actionType === "follow" || level.actionType === "stake") {
      const buttonText = level.actionType === "follow" ? "Follow" : "Stake";

      return (
        <button
          className={`${styles.actionButton} ${styles.actionButton}`}
          onClick={() => handleLevelAction(level)}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? (
            <LoaderIndicator size={16} />
          ) : (
            <Typography variant="geist" weight="bold" size={14} lineHeight={24}>
              {buttonText}
            </Typography>
          )}
        </button>
      );
    }

    // For streak/podiums/collectibles, don't show button if not completed
    // They need to complete the mission first, then they'll see the LEVEL UP button
    return null;
  };

  const renderProgressBar = (progress: { current: number; total: number }) => {
    const percentage = (progress.current / progress.total) * 100;
    return (
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  const handlePerksClick = () => {
    sdk.haptics.selectionChanged();
    openModal(ModalsIds.PERKS, {});
  };

  // Render skeleton loading state
  const renderSkeletonLevels = () => {
    const defaultLevels = getDefaultLevels();
    return (
      <div className={styles.upcomingSection}>
        <div className={styles.levelsList}>
          {defaultLevels.map((level) => (
            <div
              key={level.id}
              className={`${styles.levelItem} ${styles.skeletonItem}`}
            >
              <div className={styles.skeletonLevelNumber}>
                <Typography variant="druk" weight="regular" size={20}>
                  {level.id}
                </Typography>
              </div>

              <div className={styles.levelContent}>
                <div className={styles.levelTitle}>
                  <div className={styles.skeletonTitle}>
                    <Typography
                      variant="geist"
                      weight="medium"
                      size={14}
                      lineHeight={18}
                      className={styles.titleText}
                    >
                      {level.title}
                    </Typography>
                  </div>
                </div>
              </div>

              <div className={styles.levelAction}>
                <div className={styles.skeletonSpinner}>
                  <LoaderIndicator size={20} />
                </div>
              </div>

              <div className={styles.levelStatus}>
                <IncompleteTaskIcon width={18} height={18} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Always show levels, regardless of connection/authorization status
  // If not connected or authorized, show default levels with appropriate buttons

  const handleRefresh = async () => {
    sdk.haptics.selectionChanged();
    if (userFid) {
      // Reload levels list and invalidate auth to refresh brndPowerLevel
      await loadLevelsList();
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div
          className={`${styles.refreshButton} ${
            isLoading ? styles.refreshing : ""
          }`}
          onClick={() => {
            if (!isLoading && userFid) handleRefresh();
          }}
        >
          {isLoading ? (
            <LoaderIndicator size={14} />
          ) : (
            <Typography
              variant="geist"
              weight="medium"
              size={14}
              className={styles.refreshLabel}
            >
              Refresh
            </Typography>
          )}
        </div>

        <div className={styles.perksInfo} onClick={handlePerksClick}>
          <Typography
            as="span"
            variant="geist"
            weight="medium"
            size={14}
            lineHeight={18}
            className={styles.perksLabel}
          >
            Perks by level
          </Typography>
          <QuestionMarkIcon />
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <Typography
            variant="geist"
            weight="medium"
            size={12}
            className={styles.errorText}
          >
            {error}
          </Typography>
        </div>
      )}

      {isLoading ? (
        renderSkeletonLevels()
      ) : levels.length === 0 ? (
        <div className={styles.loadingState}>
          <Typography variant="geist" weight="medium" size={14}>
            Loading power levels...
          </Typography>
        </div>
      ) : (
        <>
          {/* All Levels Section */}
          <div className={styles.upcomingSection}>
            <div className={styles.levelsList}>
              {levels.map((level) => {
                // Use shared context level (includes optimistic updates)
                const userCurrentLevel = getDisplayLevel();
                const isNextLevel = level.id === userCurrentLevel + 1;
                const isCompleted = level.id <= userCurrentLevel;

                return (
                  <div
                    key={level.id}
                    className={`${styles.levelItem} ${
                      isNextLevel ? styles.active : styles.locked
                    }`}
                    onClick={level.clickFunction}
                  >
                    <Typography variant="druk" weight="regular" size={20}>
                      {level.id}
                    </Typography>

                    <div className={styles.levelContent}>
                      <div className={styles.levelTitle}>
                        <Typography
                          variant="geist"
                          weight="medium"
                          size={14}
                          lineHeight={18}
                          className={styles.titleText}
                        >
                          {level.title}
                        </Typography>
                        {level.progress && (
                          <Typography
                            variant="geist"
                            weight="regular"
                            size={12}
                            className={styles.progressText}
                          >
                            {level.actionType === "streak" &&
                            level.progress.maxStreak !== undefined
                              ? `Current: ${level.progress.current} days | Max: ${level.progress.maxStreak} days`
                              : level.actionType === "streak"
                              ? `Current: ${level.progress.current} days`
                              : `${level.progress.current}/${level.progress.total}`}
                          </Typography>
                        )}
                      </div>

                      {level.progress && renderProgressBar(level.progress)}
                    </div>

                    <div className={styles.levelAction}>
                      {renderActionButton(level)}
                    </div>

                    <div className={styles.levelStatus}>
                      {isCompleted ? (
                        <span className={styles.checkmark}>✓</span>
                      ) : (
                        <IncompleteTaskIcon width={18} height={18} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Power;
