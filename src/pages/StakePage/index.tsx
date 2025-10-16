import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useConnect } from "wagmi";
import { useContractWagmi } from "@/shared/hooks/contract/useContractWagmi";
import styles from "./StakePage.module.scss";

export default function StakePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");

  const { connect, connectors } = useConnect();

  const {
    isConnected,
    brndBalance,
    stakedBrndAmount,
    vaultShares,
    stakeBrnd,
    unstakeBrnd,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    isLoadingBrndBalances,
    refreshBrndBalances,
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
    // onUnstakeSuccess
    (txData) => {
      console.log("Unstake successful!", txData);
      setTxHash(txData.txHash);
      setShowSuccess(true);
      setUnstakeAmount("");
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

  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    if (parseFloat(unstakeAmount) > parseFloat(vaultShares)) {
      return;
    }
    unstakeBrnd({ shares: unstakeAmount });
  };

  const setMaxStake = () => {
    setStakeAmount(brndBalance);
  };

  const setMaxUnstake = () => {
    setUnstakeAmount(vaultShares);
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
      {/* Header with gradient accent */}
      <div className={styles.gradientBorder}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2 className={styles.title}>BRND</h2>
            <p className={styles.subtitle}>STAKING VAULT</p>
          </div>
          <button
            onClick={handleBackClick}
            className={styles.closeButton}
            disabled={isPending || isConfirming}
          >
            ✕
          </button>
        </div>
      </div>

      {isConnected ? (
        <>
          {/* Balance Cards */}
          <div className={styles.balanceSection}>
            <div className={styles.balanceGrid}>
              <div className={styles.balanceCard}>
                <p className={styles.balanceLabel}>Balance</p>
                <p className={styles.balanceAmount}>
                  {formatNumber(brndBalance)}
                </p>
                <p className={styles.balanceToken}>$BRND</p>
              </div>
              <div className={styles.balanceCard}>
                <p className={styles.balanceLabel}>Staked</p>
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
              <span className={styles.infoIcon}>ℹ️</span>
              <div className={styles.infoContent}>
                <p className={styles.infoTitle}>HOW IT WORKS</p>
                <ul className={styles.infoList}>
                  <li>• Stake BRND to earn rewards via Teller Finance</li>
                  <li>• Get vault shares representing your stake</li>
                  <li>• Unstake anytime to claim BRND + rewards</li>
                  <li>• First-time stakers need token approval</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={styles.tabsContainer}>
            <button
              onClick={() => setActiveTab("stake")}
              className={`${styles.tab} ${
                activeTab === "stake" ? styles.tabActive : ""
              }`}
              disabled={isPending || isConfirming}
            >
              <span className={styles.tabIcon}>↗</span>
              STAKE
            </button>
            <button
              onClick={() => setActiveTab("unstake")}
              className={`${styles.tab} ${styles.tabUnstake} ${
                activeTab === "unstake" ? styles.tabUnstakeActive : ""
              }`}
              disabled={isPending || isConfirming}
            >
              <span className={styles.tabIcon}>↙</span>
              UNSTAKE
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeTab === "stake" ? (
              // Stake Tab
              <div className={styles.formContainer}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Amount to Stake</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.0"
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

                <button
                  onClick={handleStake}
                  disabled={
                    isPending ||
                    isConfirming ||
                    !stakeAmount ||
                    parseFloat(stakeAmount) <= 0 ||
                    parseFloat(stakeAmount) > parseFloat(brndBalance) ||
                    isLoadingBrndBalances
                  }
                  className={styles.submitButton}
                >
                  {isPending || isConfirming ? (
                    <>
                      <span className={styles.spinner}>⌛</span>
                      {isPending ? "CONFIRM IN WALLET..." : "PROCESSING..."}
                    </>
                  ) : (
                    "STAKE BRND"
                  )}
                </button>

                {isPending && (
                  <p className={styles.pendingText}>
                    ⏳ CONFIRM TRANSACTION IN YOUR WALLET
                  </p>
                )}
              </div>
            ) : (
              // Unstake Tab
              <div className={styles.formContainer}>
                <div className={styles.sharesCard}>
                  <p className={styles.balanceLabel}>Vault Shares</p>
                  <p className={styles.balanceAmount}>
                    {formatNumber(vaultShares)}
                  </p>
                  <p className={styles.balanceToken}>
                    ≈ {formatNumber(stakedBrndAmount)} BRND
                  </p>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>
                    Shares to Unstake
                  </label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="number"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      placeholder="0.0"
                      className={`${styles.input} ${styles.inputUnstake}`}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
                      }
                    />
                    <button
                      onClick={setMaxUnstake}
                      className={`${styles.maxButton} ${styles.maxButtonUnstake}`}
                      disabled={
                        isPending || isConfirming || isLoadingBrndBalances
                      }
                    >
                      MAX
                    </button>
                  </div>
                  {unstakeAmount &&
                    parseFloat(unstakeAmount) > parseFloat(vaultShares) && (
                      <p className={styles.errorText}>
                        ⚠️ INSUFFICIENT VAULT SHARES
                      </p>
                    )}
                </div>

                <button
                  onClick={handleUnstake}
                  disabled={
                    isPending ||
                    isConfirming ||
                    !unstakeAmount ||
                    parseFloat(unstakeAmount) <= 0 ||
                    parseFloat(unstakeAmount) > parseFloat(vaultShares) ||
                    isLoadingBrndBalances
                  }
                  className={`${styles.submitButton} ${styles.submitButtonUnstake}`}
                >
                  {isPending || isConfirming ? (
                    <>
                      <span className={styles.spinner}>⌛</span>
                      {isPending ? "CONFIRM IN WALLET..." : "PROCESSING..."}
                    </>
                  ) : (
                    "UNSTAKE BRND"
                  )}
                </button>

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
                <span className={styles.errorIcon}>⚠️</span>
                <div>
                  <p className={styles.errorTitle}>TRANSACTION FAILED</p>
                  <p className={styles.errorMessage}>{error}</p>
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

          {/* Footer */}
          <div className={styles.footer}>
            <a
              href="https://defi.teller.org/pool/0x19d1872d8328b23a219e11d3d6eeee1954a88f88"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              VIEW POOL →
            </a>
            <button
              onClick={refreshBrndBalances}
              className={styles.footerButton}
              disabled={isLoadingBrndBalances}
            >
              {isLoadingBrndBalances ? "REFRESHING..." : "REFRESH"}
            </button>
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