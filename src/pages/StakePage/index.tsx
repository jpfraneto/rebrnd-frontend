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
    isConfirmed,
    error,
    isLoadingBrndBalances,
  } = useContractWagmi(
    // onStakeSuccess
    (txData) => {
      console.log("Stake successful!", txData);
      setTxHash(txData.txHash);
      setShowSuccess(true);
      setStakeAmount("");
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    },
    // onWithdrawSuccess
    (txData) => {
      console.log("Withdraw successful!", txData);
      setTxHash(txData.txHash);
      setShowSuccess(true);
      setWithdrawAmount("");
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    }
  );

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    if (parseFloat(stakeAmount) > parseFloat(brndBalance)) {
      return;
    }
    stakeBrnd({ amount: stakeAmount });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    if (parseFloat(withdrawAmount) > parseFloat(vaultShares)) {
      return;
    }
    withdrawBrnd({ shares: withdrawAmount });
  };

  const setMaxStake = () => {
    sdk.haptics.selectionChanged();
    setStakeAmount(Math.floor(parseFloat(brndBalance)).toString());
  };

  const setMaxWithdraw = () => {
    sdk.haptics.selectionChanged();
    setWithdrawAmount(vaultShares);
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

  // Close modal on successful transaction
  useEffect(() => {
    if (isConfirmed && showSuccess) {
      const timer = setTimeout(() => {
        navigate(-1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConfirmed, showSuccess, navigate]);

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
                  {formatNumber(brndBalance)}
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
                  {formatNumber(stakedBrndAmount)}
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
                    parseFloat(stakeAmount) > parseFloat(brndBalance) && (
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
                    parseFloat(stakeAmount) > parseFloat(brndBalance) ||
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
                    Amount to Withdraw:
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
                          ? parseFloat(vaultShares)
                          : parseFloat(brndBalance)
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
                    parseFloat(withdrawAmount) > parseFloat(vaultShares) && (
                      <p className={styles.errorText}>
                        ⚠️ INSUFFICIENT VAULT SHARES
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
                    parseFloat(withdrawAmount) > parseFloat(vaultShares) ||
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
                    {error}
                  </Typography>
                </div>
              </div>
            )}

            {/* Success Message */}
            {showSuccess && (
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>✓</span>
                <div className={styles.successContent}>
                  <p className={styles.successTitle}>SUCCESS!</p>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.txLink}
                    >
                      VIEW ON BASESCAN →
                    </a>
                  )}
                </div>
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
