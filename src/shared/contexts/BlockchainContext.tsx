// src/shared/contexts/BlockchainContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useStoriesInMotion } from "../hooks/contract/useStoriesInMotion";
import { useContractWagmi, StakeBrndParams, WithdrawBrndParams } from "../hooks/contract/useContractWagmi";

interface BlockchainState {
  // Wallet connection
  isConnected: boolean;
  isWalletAuthorized: boolean;
  userFid: number | null;
  userAddress: string | undefined;

  // Balances
  brndBalance: string;
  stakedBrndAmount: string;
  vaultShares: string;

  // Power levels
  brndPowerLevel: number;
  canLevelUp: boolean;

  // Transaction states
  isTransactionPending: boolean;
  transactionError: string | null;
  lastTransactionHash: string | null;

  // Loading states
  isLoading: boolean;
}

interface BlockchainActions {
  // Wallet actions
  switchToBaseNetwork: () => Promise<void>;

  // Staking actions
  stakeBrnd: (params: StakeBrndParams) => Promise<void>;
  withdrawBrnd: (params: WithdrawBrndParams) => Promise<void>;

  // Power level actions
  levelUpBrndPower: (targetLevel: number) => Promise<void>;

  // Voting actions
  vote: (brandIds: [number, number, number]) => Promise<void>;

  // Reward actions
  claimReward: (castHash: string, voteId: string, transactionHash?: string) => Promise<void>;
  getRewardAmount: (powerLevel: number) => Promise<string>;

  // Brand actions
  getBrand: (brandId: number) => Promise<any>;

  // Utility actions
  refreshData: () => void;
  clearError: () => void;
}

interface BlockchainContextType extends BlockchainState, BlockchainActions {}

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

export const useBlockchain = () => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error("useBlockchain must be used within a BlockchainProvider");
  }
  return context;
};

interface BlockchainProviderProps {
  children: React.ReactNode;
}

export const BlockchainProvider: React.FC<BlockchainProviderProps> = ({ children }) => {
  const [lastTransactionHash, setLastTransactionHash] = useState<string | null>(null);
  const [combinedError, setCombinedError] = useState<string | null>(null);

  // StoriesInMotion hook for blockchain features
  const storiesInMotion = useStoriesInMotion(
    // onAuthorizeSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    },
    // onLevelUpSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    },
    // onVoteSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    },
    // onClaimSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    }
  );

  // Wagmi hook for Teller staking
  const tellerStaking = useContractWagmi(
    // onStakeSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    },
    // onWithdrawSuccess
    (txData) => {
      setLastTransactionHash(txData.txHash);
      setCombinedError(null);
    }
  );

  // Combine errors from both hooks
  useEffect(() => {
    const error = storiesInMotion.error || tellerStaking.error;
    setCombinedError(error);
  }, [storiesInMotion.error, tellerStaking.error]);

  // Combined state
  const state: BlockchainState = {
    // Wallet connection
    isConnected: storiesInMotion.isConnected,
    isWalletAuthorized: storiesInMotion.isWalletAuthorized,
    userFid: storiesInMotion.userFid,
    userAddress: storiesInMotion.userAddress,

    // Balances
    brndBalance: storiesInMotion.brndBalance || tellerStaking.brndBalance,
    stakedBrndAmount: tellerStaking.stakedBrndAmount,
    vaultShares: tellerStaking.vaultShares,

    // Power levels
    brndPowerLevel: storiesInMotion.userInfo?.brndPowerLevel || 0,
    canLevelUp: false, // This would be calculated based on requirements

    // Transaction states
    isTransactionPending: storiesInMotion.isPending || tellerStaking.isPending,
    transactionError: combinedError,
    lastTransactionHash,

    // Loading states
    isLoading: 
      storiesInMotion.isLoadingUserInfo || 
      tellerStaking.isLoadingBrndBalances ||
      storiesInMotion.isConfirming ||
      tellerStaking.isConfirming,
  };

  // Combined actions
  const actions: BlockchainActions = {
    // Wallet actions
    switchToBaseNetwork: storiesInMotion.switchToBase,

    // Staking actions
    stakeBrnd: tellerStaking.stakeBrnd,
    withdrawBrnd: tellerStaking.withdrawBrnd,

    // Power level actions
    levelUpBrndPower: storiesInMotion.levelUpBrndPower,

    // Voting actions
    vote: storiesInMotion.vote,

    // Reward actions
    claimReward: storiesInMotion.claimReward,
    getRewardAmount: storiesInMotion.getRewardAmount,

    // Brand actions
    getBrand: storiesInMotion.getBrand,

    // Utility actions
    refreshData: () => {
      storiesInMotion.refreshData();
      tellerStaking.refreshBrndBalances();
    },
    clearError: () => setCombinedError(null),
  };

  const contextValue: BlockchainContextType = {
    ...state,
    ...actions,
  };

  return (
    <BlockchainContext.Provider value={contextValue}>
      {children}
    </BlockchainContext.Provider>
  );
};

export default BlockchainContext;