import React from 'react';
import { formatUnits } from 'viem';
import { useAuth } from '@/shared/hooks/auth/useAuth';
import { useContextualTransaction } from '@/shared/hooks/user/useContextualTransaction';
import Typography from '@/components/Typography';
import styles from './DailyStatus.module.scss';

interface DailyStatusProps {
  className?: string;
  showTransactionDetails?: boolean;
}

const DailyStatus: React.FC<DailyStatusProps> = ({
  className,
  showTransactionDetails = true,
}) => {
  const { data: user } = useAuth();
  const { transaction, isVoteTransaction, isClaimTransaction, hasRewardInfo, hasCastInfo } = useContextualTransaction();

  const voteStatus = user?.todaysVoteStatus;

  if (!voteStatus) {
    return null;
  }

  const getStatusIcon = () => {
    if (voteStatus.hasClaimed) return '✅';
    if (voteStatus.hasShared) return '🔄';
    if (voteStatus.hasVoted) return '📝';
    return '⏳';
  };

  const getStatusText = () => {
    if (voteStatus.hasClaimed) return 'Today\'s rewards claimed!';
    if (voteStatus.hasShared) return 'Vote shared - ready to claim';
    if (voteStatus.hasVoted) return 'Vote submitted - share to claim';
    return 'Ready to vote today';
  };

  const formatReward = (amountWei: string) => {
    try {
      return formatUnits(BigInt(amountWei), 18);
    } catch {
      return '0';
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.statusHeader}>
        <span className={styles.statusIcon}>{getStatusIcon()}</span>
        <Typography
          variant="geist"
          weight="medium"
          size={14}
          lineHeight={18}
          className={styles.statusText}
        >
          {getStatusText()}
        </Typography>
      </div>

      {showTransactionDetails && transaction && (
        <div className={styles.transactionDetails}>
          {isVoteTransaction && (
            <div className={styles.transactionItem}>
              <Typography
                variant="geist"
                weight="regular"
                size={12}
                lineHeight={16}
                className={styles.transactionLabel}
              >
                Vote: 
                <a
                  href={`https://basescan.org/tx/${transaction.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.transactionLink}
                >
                  {formatHash(transaction.transactionHash!)}
                </a>
              </Typography>
            </div>
          )}

          {isClaimTransaction && (
            <>
              {hasRewardInfo && (
                <div className={styles.transactionItem}>
                  <Typography
                    variant="geist"
                    weight="medium"
                    size={12}
                    lineHeight={16}
                    className={styles.rewardText}
                  >
                    Claimed: {formatReward(transaction.rewardAmount!)} BRND
                  </Typography>
                </div>
              )}
              <div className={styles.transactionItem}>
                <Typography
                  variant="geist"
                  weight="regular"
                  size={12}
                  lineHeight={16}
                  className={styles.transactionLabel}
                >
                  Claim:
                  <a
                    href={`https://basescan.org/tx/${transaction.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.transactionLink}
                  >
                    {formatHash(transaction.transactionHash!)}
                  </a>
                </Typography>
              </div>
              {hasCastInfo && (
                <div className={styles.transactionItem}>
                  <Typography
                    variant="geist"
                    weight="regular"
                    size={12}
                    lineHeight={16}
                    className={styles.transactionLabel}
                  >
                    Cast:
                    <a
                      href={`https://warpcast.com/~/conversations/${transaction.castHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.castLink}
                    >
                      {formatHash(transaction.castHash!)}
                    </a>
                  </Typography>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyStatus;