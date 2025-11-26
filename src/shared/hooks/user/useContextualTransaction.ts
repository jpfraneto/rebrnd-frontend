import { useAuth } from '../auth/useAuth';
import { ContextualTransaction } from './types';

interface UseContextualTransactionResult {
  transaction: ContextualTransaction | null;
  hasTransaction: boolean;
  isVoteTransaction: boolean;
  isClaimTransaction: boolean;
  hasRewardInfo: boolean;
  hasCastInfo: boolean;
}

export const useContextualTransaction = (): UseContextualTransactionResult => {
  const { data: user } = useAuth();
  
  const transaction = user?.contextualTransaction || null;
  
  return {
    transaction,
    hasTransaction: !!(transaction?.transactionHash && transaction?.transactionType),
    isVoteTransaction: transaction?.transactionType === 'vote',
    isClaimTransaction: transaction?.transactionType === 'claim',
    hasRewardInfo: !!(transaction?.transactionType === 'claim' && transaction?.rewardAmount),
    hasCastInfo: !!(transaction?.transactionType === 'claim' && transaction?.castHash),
  };
};