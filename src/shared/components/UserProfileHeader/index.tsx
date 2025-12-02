// src/shared/components/UserProfileHeader/index.tsx

import React, { useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./UserProfileHeader.module.scss";

// Components
import Typography from "@/components/Typography";

// Hooks
import { useAuth } from "@/hooks/auth";
import { useContractWagmi } from "@/shared/hooks/contract/useContractWagmi";
import { usePowerLevel } from "@/shared/contexts/PowerLevelContext";
import sdk from "@farcaster/miniapp-sdk";
import { AuthContext } from "@/shared/providers/AppProvider";

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
  const { miniappContext } = useContext(AuthContext);
  const isAdmin = [16098, 8109, 5431, 1108951].includes(
    miniappContext?.user?.fid!
  );

  // Get blockchain data for BRND balance and staking info
  const { brndBalance, stakedBrndAmount, isLoadingBrndBalances } =
    useContractWagmi();

  // Get BRND power level information from shared context
  const { getDisplayLevel } = usePowerLevel();

  // Helper function to format large numbers
  const formatBrndAmount = useCallback((amount: string): string => {
    if (!amount || amount === "0") return "0";

    const numAmount = parseFloat(amount);
    if (numAmount >= 1000000) {
      return `${(numAmount / 1000000).toFixed(1)}M`;
    } else if (numAmount >= 1000) {
      return `${(numAmount / 1000).toFixed(1)}K`;
    }
    return numAmount.toFixed(1);
  }, []);

  // Get display values with loading states
  const brndPowerLevel = getDisplayLevel();
  const displayBalance = isLoadingBrndBalances ? (
    <>
      Balance: <span className={styles.loadingBlur}>0.0</span> $BRND
    </>
  ) : (
    `Balance: ${formatBrndAmount(brndBalance)} $BRND`
  );
  const displayStaked = isLoadingBrndBalances ? (
    <>
      Stake: <span className={styles.loadingBlur}>0.0</span> $BRND
    </>
  ) : (
    `Stake: ${formatBrndAmount(stakedBrndAmount)} $BRND`
  );

  const handleBackClick = useCallback(() => {
    sdk.haptics.selectionChanged();
    navigate(-1);
  }, [onBackClick, navigate]);

  const handleAdmin = useCallback(() => {
    sdk.haptics.selectionChanged();
    navigate("/admin");
  }, [navigate]);

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
            LEVEL {brndPowerLevel}
          </Typography>
        </div>

        <div className={styles.infoSection}>
          <Typography variant="geist" weight="medium" size={14} lineHeight={22}>
            {displayBalance}
          </Typography>
          <Typography variant="geist" weight="medium" size={14} lineHeight={22}>
            {displayStaked}
          </Typography>

          <div className={styles.actions}>
            {/* Stake Button */}
            <button
              onClick={() => {
                sdk.haptics.selectionChanged();
                navigate("/stake");
              }}
              className={styles.stakeButton}
            >
              Stake
            </button>
            <button className={styles.swapBtn} onClick={handleSwap}>
              Swap
            </button>
            {isAdmin && (
              <button className={styles.adminBtn} onClick={handleAdmin}>
                Adm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileHeader;
