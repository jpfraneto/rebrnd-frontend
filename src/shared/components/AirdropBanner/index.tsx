// Dependencies
import React from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./AirdropBanner.module.scss";
import Typography from "../Typography";
import AirdropSvg from "@/shared/assets/images/airdrop.svg?react";
import sdk from "@farcaster/frame-sdk";

function AirdropBanner(): React.ReactNode {
  const navigate = useNavigate();
  sdk.haptics.selectionChanged();

  const handleClick = () => {
    navigate("/airdrop");
  };

  return (
    <div className={styles.banner} onClick={handleClick}>
      <div className={styles.mainContent}>
        <AirdropSvg />
        <div className={styles.leaderboardTextContainer}>
          <Typography
            variant="geist"
            weight="bold"
            size={18}
            className={styles.leaderboardText}
          >
            LEADERBOARD
          </Typography>
          <Typography
            variant="geist"
            weight="bold"
            size={12}
            className={styles.seasonOneText}
          >
            SEASON 1
          </Typography>
        </div>
      </div>
      <div className={styles.arrowSection}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18L15 12L9 6"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default AirdropBanner;
