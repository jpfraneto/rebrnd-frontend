// src/shared/components/UserProfileHeader/index.tsx

import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./UserProfileHeader.module.scss";

// Components
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import IconButton from "@/components/IconButton";

// Assets
import GoBackIcon from "@/assets/icons/go-back-icon.svg?react";

// Hooks
import { useAuth } from "@/hooks/auth";
import sdk from "@farcaster/frame-sdk";

interface UserProfileHeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  showBackButton = true,
  onBackClick,
}) => {
  const navigate = useNavigate();
  const { data } = useAuth();

  const handleBackClick = useCallback(() => {
    sdk.haptics.selectionChanged();
    navigate(-1);
  }, [onBackClick, navigate]);

  const handleStake = useCallback(() => {
    sdk.haptics.selectionChanged();
  }, []);

  const handleSwap = useCallback(() => {
    sdk.haptics.selectionChanged();
    sdk.actions.swapToken({
      sellToken: "eip155:8453/erc20:0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      /**
       * CAIP-19 token ID. For example, OP ETH:
       * eip155:10/native
       */
      buyToken: "eip155:8453/erc20:0x41Ed0311640A5e489A90940b1c33433501a21B07",
      /**
       * Sell token amount, as numeric string.
       * For example, 1 USDC: 1000000
       */
      sellAmount: "10000000",
    });
  }, []);

  return (
    <div className={styles.wrapper}>
      {showBackButton && (
        <div onClick={handleBackClick} className={styles.backButton}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18L9 12L15 6"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.avatarSection}>
          <div className={styles.avatarRing}>
            <img src={data?.photoUrl} alt={data?.username} />
          </div>
          <Typography variant="druk" weight="wide" size={12} lineHeight={12}>
            LEVEL 0
          </Typography>
        </div>

        <div className={styles.infoSection}>
          <Typography variant="geist" weight="medium" size={14} lineHeight={22}>
            Balance: 10M $BRND
          </Typography>
          <Typography variant="geist" weight="medium" size={14} lineHeight={22}>
            Stake: 0M $BRND
          </Typography>

          <div className={styles.actions}>
            <button className={styles.stakeBtn} onClick={handleStake}>
              Stake
            </button>
            <button className={styles.swapBtn} onClick={handleSwap}>
              Swap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileHeader;
