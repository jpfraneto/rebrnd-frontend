import React, { useState } from "react";
import { ContextualTransaction } from "@/shared/hooks/user/types";
import styles from "./TransactionInfo.module.scss";
import sdk from "@farcaster/miniapp-sdk";

interface TransactionInfoProps {
  transaction: ContextualTransaction;
  className?: string;
}

const TransactionInfo: React.FC<TransactionInfoProps> = ({
  transaction,
  className,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!transaction.transactionHash || !transaction.transactionType) {
    return null;
  }

  const formatTransactionHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getBaseExplorerUrl = (hash: string) => {
    return `https://basescan.org/tx/${hash}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(label);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const renderVoteTransaction = () => (
    <div className={styles.transactionItem}>
      <div className={styles.transactionLabel}>Vote Transaction:</div>
      <div className={styles.transactionValue}>
        <span
          className={styles.transactionHash}
          onClick={() => copyToClipboard(transaction.transactionHash!, "vote")}
          title={`Copy transaction hash: ${transaction.transactionHash}`}
        >
          {formatTransactionHash(transaction.transactionHash!)}
          {copiedHash === "vote" && (
            <span className={styles.copied}>Copied!</span>
          )}
        </span>
        <a
          href={getBaseExplorerUrl(transaction.transactionHash!)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.explorerLink}
          title="View on Base Explorer"
        >
          ↗
        </a>
      </div>
    </div>
  );

  const renderClaimTransaction = () => (
    <div className={styles.transactionGroup}>
      <div className={styles.transactionItem}>
        <div className={styles.transactionLabel}>Claim Transaction:</div>
        <div className={styles.transactionValue}>
          <span
            className={styles.transactionHash}
            onClick={() =>
              copyToClipboard(transaction.transactionHash!, "claim")
            }
            title={`Copy transaction hash: ${transaction.transactionHash}`}
          >
            {formatTransactionHash(transaction.transactionHash!)}
            {copiedHash === "claim" && (
              <span className={styles.copied}>Copied!</span>
            )}
          </span>
          <a
            href={getBaseExplorerUrl(transaction.transactionHash!)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.explorerLink}
            title="View on Base Explorer"
          >
            ↗
          </a>
        </div>
      </div>

      {transaction.castHash && (
        <div className={styles.transactionItem}>
          <div className={styles.transactionLabel}>Shared Cast:</div>
          <div className={styles.transactionValue}>
            <span
              className={styles.transactionHash}
              onClick={() =>
                sdk.actions.viewCast({ hash: transaction.castHash! })
              }
              title={`View cast: ${transaction.castHash}`}
            >
              {formatTransactionHash(transaction.castHash!)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.transactionInfo}>
        {transaction.transactionType === "vote" && renderVoteTransaction()}
        {transaction.transactionType === "claim" && renderClaimTransaction()}
      </div>
    </div>
  );
};

export default TransactionInfo;
