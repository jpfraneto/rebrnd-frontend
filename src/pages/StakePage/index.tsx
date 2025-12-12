import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConnect } from "wagmi";
import { useContractWagmi } from "@/shared/hooks/contract/useContractWagmi";
import styles from "./StakePage.module.scss";
import Typography from "@/shared/components/Typography";
import Button from "@/shared/components/Button";
import sdk from "@farcaster/miniapp-sdk";

export default function StakePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"stake" | "withdraw">("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");

  // Optimistic balance updates
  const [optimisticBrndBalance, setOptimisticBrndBalance] = useState<
    string | null
  >(null);
  const [optimisticStakedAmount, setOptimisticStakedAmount] = useState<
    string | null
  >(null);

  // State for withdrawal delay countdown
  const [secondsUntilWithdrawable, setSecondsUntilWithdrawable] = useState(0);

  const { connect, connectors } = useConnect();

  const {
    isConnected,
    brndBalance,
    stakedBrndAmount,
    stakeBrnd,
    withdrawBrnd,
    isPending,
    isConfirming,
    error,
    isLoadingBrndBalances,
    // Withdrawal delay data
    withdrawDelayTimeSeconds,
    getSecondsUntilWithdrawable,
    isWithdrawAvailable,
    formatTimeRemaining,
    isLoadingWithdrawDelayInfo,
    refreshBrndBalances,
  } = useContractWagmi(
    // onStakeSuccess
    (txData) => {
      console.log("Stake successful!", txData);
      sdk.haptics.notificationOccurred("success");
      setTxHash(txData.txHash);
      setShowSuccess(true);
      setStakeAmount("");

      // Clear any existing optimistic updates immediately
      setOptimisticBrndBalance(null);
      setOptimisticStakedAmount(null);

      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    },
    // onWithdrawSuccess
    (txData) => {
      console.log("Withdraw successful!", txData);
      sdk.haptics.notificationOccurred("success");
      setTxHash(txData.txHash);
      setShowSuccess(true);
      setWithdrawAmount("");

      // Clear any existing optimistic updates immediately
      setOptimisticBrndBalance(null);
      setOptimisticStakedAmount(null);

      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    }
  );

  // Update withdrawal delay countdown every second
  useEffect(() => {
    if (!isConnected || !getSecondsUntilWithdrawable) return;

    const updateCountdown = () => {
      const remaining = getSecondsUntilWithdrawable();
      setSecondsUntilWithdrawable(remaining);
    };

    // Update immediately
    updateCountdown();

    // Set up interval only if there's time remaining
    const remaining = getSecondsUntilWithdrawable();
    if (remaining > 0) {
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [isConnected, getSecondsUntilWithdrawable, activeTab]);

  // Refresh balances when switching tabs to ensure latest data
  useEffect(() => {
    if (isConnected && refreshBrndBalances) {
      // Clear optimistic updates when switching tabs
      setOptimisticBrndBalance(null);
      setOptimisticStakedAmount(null);

      // Refresh balances
      refreshBrndBalances();
    }
  }, [activeTab, isConnected, refreshBrndBalances]);

  const handleStake = () => {
    console.log(
      "inside the handleStake function",
      stakeAmount,
      getDisplayBrndBalance()
    );
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    if (parseFloat(stakeAmount) > parseFloat(getDisplayBrndBalance())) {
      return;
    }
    stakeBrnd({ amount: stakeAmount });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;

    const withdrawAmountNum = parseFloat(withdrawAmount);
    const availableBrndAmount = parseFloat(getDisplayStakedAmount());

    // Validate against BRND amount, not vault shares
    if (withdrawAmountNum > availableBrndAmount) {
      return;
    }

    // Convert BRND amount to vault shares for the contract call
    // Since we're using ERC4626 redeem, we need to calculate the equivalent shares
    // For simplicity, we'll use a 1:1 approximation, but the hook will handle exact conversion
    const approximateShares = withdrawAmount;
    withdrawBrnd({ shares: approximateShares });
  };

  // Helper functions to get display balances (optimistic or real)
  const getDisplayBrndBalance = () => optimisticBrndBalance || brndBalance;
  const getDisplayStakedAmount = () =>
    optimisticStakedAmount || stakedBrndAmount;

  const setMaxStake = () => {
    sdk.haptics.selectionChanged();

    // Always use the real balance, not optimistic updates
    const balance = brndBalance;
    const balanceNum = parseFloat(balance);

    // Round down to whole number (no decimals)
    const maxAmount = Math.floor(balanceNum);

    if (maxAmount > 0) {
      setStakeAmount(maxAmount.toString());
    } else {
      setStakeAmount("0");
    }
  };

  const setMaxWithdraw = () => {
    sdk.haptics.selectionChanged();

    // Always use the real staked balance, not optimistic updates
    const stakedBalance = stakedBrndAmount;
    const stakedNum = parseFloat(stakedBalance);

    // Round down to whole number (no decimals)
    const maxAmount = Math.floor(stakedNum);

    if (maxAmount > 0) {
      setWithdrawAmount(maxAmount.toString());
    } else {
      setWithdrawAmount("0");
    }
  };

  const formatNumber = (num: string) => {
    const n = parseFloat(num);
    if (isNaN(n)) return "0";
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(2);
  };

  const handleConnectWallet = () => {
    const farcasterConnector = connectors[0];
    if (farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  };

  const handleBackClick = () => {
    sdk.haptics.selectionChanged();
    navigate(-1);
  };

  // Remove automatic redirect - let user stay on the page to see their updated balances

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Typography variant="druk" weight="wide" size={20} lineHeight={20}>
          BRND Staking Vault
        </Typography>
        <button
          onClick={handleBackClick}
          className={styles.closeButton}
          disabled={isPending || isConfirming}
          aria-label="Close"
        />
      </div>

      {isConnected ? (
        <>
          {/* Balance Cards */}
          <div className={styles.balanceSection}>
            <div className={styles.balanceGrid}>
              <div
                className={`${styles.balanceCard} ${styles.balanceCardLeft}`}
              >
                <Typography
                  variant="geist"
                  weight="medium"
                  size={14}
                  lineHeight={14}
                >
                  Your Balance:
                </Typography>
                <p className={styles.balanceAmount}>
                  {formatNumber(getDisplayBrndBalance())}
                </p>
                <p className={styles.balanceToken}>$BRND</p>
              </div>
              <div
                className={`${styles.balanceCard} ${styles.balanceCardRight}`}
              >
                <Typography
                  variant="geist"
                  weight="medium"
                  size={14}
                  lineHeight={14}
                >
                  Staked:
                </Typography>
                <p className={`${styles.balanceAmount} ${styles.staked}`}>
                  {formatNumber(getDisplayStakedAmount())}
                </p>
                <p className={styles.balanceToken}>$BRND</p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className={styles.infoContainer}>
            <div className={styles.infoBanner}>
              <div className={styles.infoBannerContent}>
                <Typography
                  variant="geist"
                  weight="medium"
                  size={14}
                  lineHeight={14}
                  className={styles.infoTitle}
                >
                  HOW IT WORKS
                </Typography>
                <ul
                  className={styles.infoList}
                  style={{ paddingLeft: 18, margin: 0 }}
                >
                  <li style={{ marginBottom: 4 }}>
                    <Typography variant="geist" size={14}>
                      Stake BRND to earn rewards via{" "}
                      <span
                        className={styles.tellerLink}
                        onClick={() => {
                          sdk.haptics.selectionChanged();
                          sdk.actions.viewProfile({ fid: 303158 });
                        }}
                      >
                        Teller Finance
                      </span>
                      .
                    </Typography>
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <Typography variant="geist" size={14}>
                      Get vault shares representing your stake.
                    </Typography>
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <Typography variant="geist" size={14}>
                      Unstake anytime to claim BRND + rewards.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="geist" size={14}>
                      Staking requires token approval.
                    </Typography>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabsContainer}>
            <button
              onClick={() => {
                sdk.haptics.selectionChanged();
                setActiveTab("stake");
                // Clear success message when switching tabs
                setShowSuccess(false);
              }}
              className={`${styles.tab} ${
                activeTab === "stake" ? styles.tabActive : ""
              }`}
              disabled={isPending || isConfirming}
            >
              STAKE
            </button>
            <button
              onClick={() => {
                sdk.haptics.selectionChanged();
                setActiveTab("withdraw");
                // Clear success message when switching tabs
                setShowSuccess(false);
              }}
              className={`${styles.tab} ${
                activeTab === "withdraw" ? styles.tabWithdrawActive : ""
              }`}
              disabled={isPending || isConfirming}
            >
              UNSTAKE
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeTab === "stake" ? (
              // Stake Tab
              <div className={styles.formContainer}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Amount to stake</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Remove decimals - only allow whole numbers
                        const wholeNumber = value.includes(".")
                          ? value.split(".")[0]
                          : value;
                        setStakeAmount(wholeNumber);
                      }}
                      placeholder="0"
                      step="1"
                      min="0"
                      className={styles.input}
                      disabled={
                        isPending ||
                        isConfirming ||
                        (isLoadingBrndBalances && !brndBalance)
                      }
                    />
                    <button
                      onClick={setMaxStake}
                      className={styles.maxButton}
                      disabled={
                        isPending ||
                        isConfirming ||
                        (isLoadingBrndBalances && !brndBalance)
                      }
                    >
                      MAX
                    </button>
                  </div>
                  {stakeAmount &&
                    parseFloat(stakeAmount) >
                      parseFloat(getDisplayBrndBalance()) && (
                      <p className={styles.errorText}>
                        ⚠️ INSUFFICIENT BALANCE
                      </p>
                    )}
                </div>

                <Button
                  variant="primary"
                  caption={
                    isPending
                      ? "CONFIRM IN WALLET..."
                      : isConfirming
                      ? "PROCESSING..."
                      : "Stake $BRND"
                  }
                  onClick={handleStake}
                  loading={isConfirming}
                />
              </div>
            ) : (
              // Withdraw Tab
              <div className={styles.formContainer}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>
                    BRND Amount to Withdraw:
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Remove decimals - only allow whole numbers
                        const wholeNumber = value.includes(".")
                          ? value.split(".")[0]
                          : value;
                        setWithdrawAmount(wholeNumber);
                      }}
                      placeholder="0"
                      step="1"
                      min="0"
                      className={`${styles.input} ${styles.inputWithdraw}`}
                      disabled={
                        isPending ||
                        isConfirming ||
                        (isLoadingBrndBalances && !stakedBrndAmount)
                      }
                      max={
                        activeTab === "withdraw"
                          ? parseFloat(getDisplayStakedAmount())
                          : parseFloat(getDisplayBrndBalance())
                      }
                    />
                    <button
                      onClick={setMaxWithdraw}
                      className={`${styles.maxButton} ${styles.maxButtonWithdraw}`}
                      disabled={
                        isPending ||
                        isConfirming ||
                        (isLoadingBrndBalances && !stakedBrndAmount)
                      }
                    >
                      MAX
                    </button>
                  </div>
                  {withdrawAmount &&
                    parseFloat(withdrawAmount) >
                      parseFloat(getDisplayStakedAmount()) && (
                      <p className={styles.errorText}>
                        ⚠️ INSUFFICIENT STAKED BALANCE
                      </p>
                    )}
                </div>

                {/* Withdrawal delay warning */}
                {!isLoadingWithdrawDelayInfo &&
                  secondsUntilWithdrawable > 0 && (
                    <div className={styles.withdrawalDelayWarning}>
                      <Typography variant="geist" weight="medium" size={14}>
                        ⏰ Withdrawal Delay Active
                      </Typography>
                      <Typography
                        variant="geist"
                        size={14}
                        className={styles.delayText}
                      >
                        You can withdraw again in{" "}
                        {formatTimeRemaining(secondsUntilWithdrawable)}
                      </Typography>
                      <Typography
                        variant="geist"
                        size={12}
                        className={styles.delaySubtext}
                      >
                        The vault has a{" "}
                        {Math.floor(withdrawDelayTimeSeconds / 60)} minute delay
                        between deposits and withdrawals for security.
                      </Typography>
                    </div>
                  )}

                <Button
                  variant="primary"
                  caption={
                    isPending
                      ? "CONFIRM IN WALLET..."
                      : isConfirming
                      ? "PROCESSING..."
                      : "Withdraw $BRND"
                  }
                  onClick={handleWithdraw}
                  disabled={
                    isPending ||
                    isConfirming ||
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) <= 0 ||
                    parseFloat(withdrawAmount) >
                      parseFloat(getDisplayStakedAmount()) ||
                    isLoadingBrndBalances ||
                    !isWithdrawAvailable() ||
                    isLoadingWithdrawDelayInfo
                  }
                  loading={isConfirming}
                />

                {isPending && (
                  <p className={styles.pendingText}>
                    ⏳ CONFIRM TRANSACTION IN YOUR WALLET
                  </p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className={styles.errorBanner}>
                <div>
                  <Typography variant="geist" weight="medium" size={14}>
                    {error.includes("execution reverted: SR")
                      ? "Withdrawal failed: You may need to wait before making another withdrawal. The vault has a cooldown period for consecutive withdrawals."
                      : error}
                  </Typography>
                </div>
              </div>
            )}

            {/* Success Message */}
            {showSuccess && txHash && (
              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <Typography
                  variant="geist"
                  weight="medium"
                  size={14}
                  lineHeight={16}
                  textAlign="center"
                >
                  Success, tx hash: {txHash}
                </Typography>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Not Connected State */
        <div className={styles.connectSection}>
          <div className={styles.connectCard}>
            <h3 className={styles.connectTitle}>Connect Your Wallet</h3>
            <p className={styles.connectSubtitle}>
              Connect your wallet to start staking BRND tokens
            </p>
            <button
              onClick={handleConnectWallet}
              className={styles.connectButton}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
