import { useState } from "react";
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
  const [_optimisticVaultShares, setOptimisticVaultShares] = useState<
    string | null
  >(null);

  const { connect, connectors } = useConnect();

  const {
    isConnected,
    brndBalance,
    stakedBrndAmount,
    vaultShares,
    stakeBrnd,
    withdrawBrnd,
    isPending,
    isConfirming,
    error,
    isLoadingBrndBalances,
  } = useContractWagmi(
    // onStakeSuccess
    (txData) => {
      console.log("Stake successful!", txData);
      sdk.haptics.notificationOccurred("success");
      setTxHash(txData.txHash);
      setShowSuccess(true);

      // Optimistically update balances
      const stakedAmountValue = parseFloat(stakeAmount);
      if (stakedAmountValue > 0) {
        const newBrndBalance = (
          parseFloat(brndBalance) - stakedAmountValue
        ).toString();
        const newStakedAmount = (
          parseFloat(stakedBrndAmount) + stakedAmountValue
        ).toString();
        // Note: vault shares would need to be calculated based on exchange rate,
        // but for simplicity we'll let the contract data refresh handle it
        setOptimisticBrndBalance(newBrndBalance);
        setOptimisticStakedAmount(newStakedAmount);
      }

      setStakeAmount("");
      setTimeout(() => {
        setShowSuccess(false);
        // Clear optimistic updates after 10 seconds to let real data refresh
        setOptimisticBrndBalance(null);
        setOptimisticStakedAmount(null);
      }, 10000);
    },
    // onWithdrawSuccess
    (txData) => {
      console.log("Withdraw successful!", txData);
      sdk.haptics.notificationOccurred("success");
      setTxHash(txData.txHash);
      setShowSuccess(true);

      // Optimistically update balances for withdrawal
      const withdrawnShares = parseFloat(withdrawAmount);
      if (withdrawnShares > 0) {
        // For withdrawal, we're removing vault shares and adding back BRND
        // The exact BRND amount would depend on exchange rate, but we'll approximate
        const newVaultShares = (
          parseFloat(vaultShares) - withdrawnShares
        ).toString();
        const newStakedAmount = (
          parseFloat(stakedBrndAmount) - withdrawnShares
        ).toString();
        // Approximate BRND return (1:1 ratio for simplicity)
        const newBrndBalance = (
          parseFloat(brndBalance) + withdrawnShares
        ).toString();

        setOptimisticVaultShares(newVaultShares);
        setOptimisticStakedAmount(newStakedAmount);
        setOptimisticBrndBalance(newBrndBalance);
      }

      setWithdrawAmount("");
      setTimeout(() => {
        setShowSuccess(false);
        // Clear optimistic updates after 10 seconds to let real data refresh
        setOptimisticBrndBalance(null);
        setOptimisticStakedAmount(null);
        setOptimisticVaultShares(null);
      }, 10000);
    }
  );

  const handleStake = () => {
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
    const balance = getDisplayBrndBalance();
    const balanceNum = parseFloat(balance);
    
    // Ensure we don't exceed the actual balance - round down aggressively
    if (balanceNum > 0) {
      // Round down to whole number to ensure we never exceed balance
      const maxAmount = Math.floor(balanceNum);
      setStakeAmount(maxAmount.toString());
    } else {
      setStakeAmount("0");
    }
  };

  const setMaxWithdraw = () => {
    sdk.haptics.selectionChanged();
    const stakedBalance = getDisplayStakedAmount();
    const stakedNum = parseFloat(stakedBalance);
    
    // Ensure we don't exceed the actual staked amount - round down aggressively
    if (stakedNum > 0) {
      // Round down to whole number to ensure we never exceed staked balance
      const maxAmount = Math.floor(stakedNum);
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
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.00"
                      className={styles.input}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
                      }
                    />
                    <button
                      onClick={setMaxStake}
                      className={styles.maxButton}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
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
                  disabled={
                    isPending ||
                    isConfirming ||
                    !stakeAmount ||
                    parseFloat(stakeAmount) <= 0 ||
                    parseFloat(stakeAmount) >
                      parseFloat(getDisplayBrndBalance()) ||
                    isLoadingBrndBalances
                  }
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
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className={`${styles.input} ${styles.inputWithdraw}`}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
                      }
                      max={
                        activeTab === "withdraw"
                          ? parseFloat(getDisplayStakedAmount())
                          : parseFloat(getDisplayBrndBalance())
                      }
                      min={0}
                    />
                    <button
                      onClick={setMaxWithdraw}
                      className={`${styles.maxButton} ${styles.maxButtonWithdraw}`}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
                      }
                    >
                      MAX
                    </button>
                  </div>
                  {withdrawAmount &&
                    parseFloat(withdrawAmount) > parseFloat(getDisplayStakedAmount()) && (
                      <p className={styles.errorText}>
                        ⚠️ INSUFFICIENT STAKED BALANCE
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
                      : "Withdraw $BRND"
                  }
                  onClick={handleWithdraw}
                  disabled={
                    isPending ||
                    isConfirming ||
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) <= 0 ||
                    parseFloat(withdrawAmount) > parseFloat(getDisplayStakedAmount()) ||
                    isLoadingBrndBalances
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
