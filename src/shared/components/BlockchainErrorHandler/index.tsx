// src/shared/components/BlockchainErrorHandler/index.tsx
import React, { useEffect } from "react";
import { useBlockchain } from "../../contexts/BlockchainContext";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import styles from "./BlockchainErrorHandler.module.scss";

interface BlockchainErrorHandlerProps {
  children: React.ReactNode;
}

const BlockchainErrorHandler: React.FC<BlockchainErrorHandlerProps> = ({ children }) => {
  const { 
    transactionError, 
    isTransactionPending,
    isConnected,
    isWalletAuthorized,
    clearError,
    switchToBaseNetwork,
  } = useBlockchain();

  // Auto-clear errors after 10 seconds
  useEffect(() => {
    if (transactionError) {
      const timer = setTimeout(() => {
        clearError();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [transactionError, clearError]);

  const getErrorMessage = (error: string): { title: string; message: string; action?: () => void; actionLabel?: string } => {
    const lowerError = error.toLowerCase();

    // Network errors
    if (lowerError.includes("switch to base network") || lowerError.includes("wrong network")) {
      return {
        title: "Wrong Network",
        message: "Please switch to Base network to continue.",
        action: switchToBaseNetwork,
        actionLabel: "Switch Network"
      };
    }

    // Wallet connection errors
    if (lowerError.includes("wallet not connected")) {
      return {
        title: "Wallet Not Connected",
        message: "Please connect your wallet to continue.",
      };
    }

    // Authorization errors
    if (lowerError.includes("wallet not authorized") || lowerError.includes("unauthorized")) {
      return {
        title: "Wallet Not Authorized",
        message: "Please try your transaction again. Authorization will happen automatically.",
      };
    }

    // Balance errors
    if (lowerError.includes("insufficient") && lowerError.includes("brnd")) {
      return {
        title: "Insufficient BRND",
        message: "You don't have enough BRND tokens for this transaction.",
      };
    }

    if (lowerError.includes("insufficient funds")) {
      return {
        title: "Insufficient Gas",
        message: "You don't have enough ETH to pay for gas fees.",
      };
    }

    // Transaction errors
    if (lowerError.includes("user rejected") || lowerError.includes("user denied")) {
      return {
        title: "Transaction Cancelled",
        message: "You cancelled the transaction in your wallet.",
      };
    }

    if (lowerError.includes("already voted")) {
      return {
        title: "Already Voted",
        message: "You have already voted today. Come back tomorrow!",
      };
    }

    if (lowerError.includes("already used")) {
      return {
        title: "Already Claimed",
        message: "This reward has already been claimed.",
      };
    }

    // Contract errors
    if (lowerError.includes("invalid input")) {
      return {
        title: "Invalid Input",
        message: "Please check your input and try again.",
      };
    }

    if (lowerError.includes("expired")) {
      return {
        title: "Transaction Expired",
        message: "The transaction deadline has passed. Please try again.",
      };
    }

    // Generic RPC/Network errors
    if (lowerError.includes("rpc") || lowerError.includes("network")) {
      return {
        title: "Network Error",
        message: "There was a problem connecting to the blockchain. Please try again.",
      };
    }

    // Fallback for unknown errors
    return {
      title: "Transaction Failed",
      message: error.length > 100 ? "An unexpected error occurred. Please try again." : error,
    };
  };

  if (!transactionError) {
    return <>{children}</>;
  }

  const errorInfo = getErrorMessage(transactionError);

  return (
    <>
      {children}
      <div className={styles.errorOverlay}>
        <div className={styles.errorModal}>
          <div className={styles.errorIcon}>⚠️</div>
          
          <Typography variant="geist" weight="bold" size={18} className={styles.errorTitle}>
            {errorInfo.title}
          </Typography>
          
          <Typography variant="geist" weight="regular" size={14} className={styles.errorMessage}>
            {errorInfo.message}
          </Typography>

          <div className={styles.errorActions}>
            {errorInfo.action && errorInfo.actionLabel && (
              <Button
                onClick={errorInfo.action}
                variant="primary"
                className={styles.actionButton}
                disabled={isTransactionPending}
                caption={isTransactionPending ? "Processing..." : errorInfo.actionLabel}
              />
            )}
            
            <Button
              onClick={clearError}
              variant="secondary"
              className={styles.dismissButton}
              caption="Dismiss"
            />
          </div>

          {/* Connection Status Indicators */}
          <div className={styles.statusIndicators}>
            <div className={`${styles.statusItem} ${isConnected ? styles.connected : styles.disconnected}`}>
              <span className={styles.statusIcon}>
                {isConnected ? "🟢" : "🔴"}
              </span>
              <Typography variant="geist" weight="regular" size={12}>
                {isConnected ? "Wallet Connected" : "Wallet Disconnected"}
              </Typography>
            </div>
            
            {isConnected && (
              <div className={`${styles.statusItem} ${isWalletAuthorized ? styles.connected : styles.disconnected}`}>
                <span className={styles.statusIcon}>
                  {isWalletAuthorized ? "🟢" : "🟡"}
                </span>
                <Typography variant="geist" weight="regular" size={12}>
                  {isWalletAuthorized ? "Wallet Authorized" : "Authorization Needed"}
                </Typography>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BlockchainErrorHandler;