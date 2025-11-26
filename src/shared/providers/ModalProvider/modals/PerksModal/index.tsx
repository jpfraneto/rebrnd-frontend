import React from "react";
import { BaseModalProps } from "../../types";
import Typography from "@/shared/components/Typography";
import styles from "./PerksModal.module.scss";
import sdk from "@farcaster/miniapp-sdk";

export type PerksModalData = {};

export const PerksModal: React.FC<BaseModalProps<PerksModalData>> = ({
  handleClose,
}) => {
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Typography variant="druk" weight="wide" size={20} lineHeight={20}>
          Your BRND Power defines your influence
        </Typography>
        <button
          onClick={() => {
            sdk.haptics.selectionChanged();
            handleClose();
          }}
          className={styles.closeButton}
          aria-label="Close"
        />
      </div>

      {/* Subtitle */}
      <div className={styles.subtitle}>
        <Typography variant="geist" weight="regular" size={14} lineHeight={18}>
          Complete quests and stake $BRND to unlock higher multipliers and climb
          the leaderboard.
        </Typography>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Base Power */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                0
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              BASE POWER
            </Typography>
            <ul className={styles.perksList}>
              <li>Start your BRND journey → x1 Rewards.</li>
              <li>Get max 6 pts on user leaderboard.</li>
              <li>Spend 100 $BRND on your podium choice.</li>
              <li>Claim 1,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 1 - Follow @BRND */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                1
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              FOLLOW @BRND
            </Typography>
            <ul className={styles.perksList}>
              <li>Connect & boost your BRND signal → x1.5 Rewards</li>
              <li>Get max 10 pts on user leaderboard.</li>
              <li>Spend 150 $BRND on your podium choice.</li>
              <li>Claim 1,500 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 2 - Stake 2M $BRND */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                2
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              STAKE 2M $BRND
            </Typography>
            <ul className={styles.perksList}>
              <li>Commit & grow your power → x2 Rewards.</li>
              <li>Get max 12 pts on user leaderboard.</li>
              <li>Spend 200 $BRND on your podium choice.</li>
              <li>Claim 2,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 3 - 5-Day Podium Streak */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                3
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              5-DAY PODIUM STREAK
            </Typography>
            <ul className={styles.perksList}>
              <li>Show consistency & stay on top → x3 Rewards.</li>
              <li>Get max 18 pts on user leaderboard.</li>
              <li>Spend 300 $BRND on your podium choice.</li>
              <li>Claim 3,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 4 - Stake 4M $BRND */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                4
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              STAKE 4M $BRND
            </Typography>
            <ul className={styles.perksList}>
              <li>Increase your commitment & power → x4 Rewards.</li>
              <li>Get max 24 pts on user leaderboard.</li>
              <li>Spend 400 $BRND on your podium choice.</li>
              <li>Claim 4,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 5 - 100 Podiums Completed */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                5
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              100 PODIUMS COMPLETED
            </Typography>
            <ul className={styles.perksList}>
              <li>Prove your dedication → x5 Rewards.</li>
              <li>Get max 30 pts on user leaderboard.</li>
              <li>Spend 500 $BRND on your podium choice.</li>
              <li>Claim 5,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 6 - Stake 6M $BRND */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                6
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              STAKE 6M $BRND
            </Typography>
            <ul className={styles.perksList}>
              <li>Maximize your stake & influence → x6 Rewards.</li>
              <li>Get max 36 pts on user leaderboard.</li>
              <li>Spend 600 $BRND on your podium choice.</li>
              <li>Claim 6,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 7 - Collect 7 BRND Collectible Casts */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                7
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              COLLECT 7 BRND COLLECTIBLE CASTS
            </Typography>
            <ul className={styles.perksList}>
              <li>Curate rare collectibles → x7 Rewards.</li>
              <li>Get max 42 pts on user leaderboard.</li>
              <li>Spend 700 $BRND on your podium choice.</li>
              <li>Claim 7,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>

        {/* Level 8 - Stake 8M $BRND */}
        <div className={styles.levelCard}>
          <div className={styles.levelIcon}>
            <div className={styles.iconCircle}>
              <Typography
                variant="geist"
                weight="bold"
                size={14}
                lineHeight={14}
              >
                8
              </Typography>
            </div>
          </div>
          <div className={styles.levelInfo}>
            <Typography variant="geist" weight="bold" size={14} lineHeight={18}>
              STAKE 8M $BRND
            </Typography>
            <ul className={styles.perksList}>
              <li>Reach the pinnacle of power → x8 Rewards.</li>
              <li>Get max 48 pts on user leaderboard.</li>
              <li>Spend 800 $BRND on your podium choice.</li>
              <li>Claim 8,000 $BRND after sharing your daily podium.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
