// src/shared/hooks/contract/useContractWagmi.ts
import { useCallback, useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";

import {
  BRND_STAKING_CONFIG,
  ERC20_ABI,
  ERC4626_ABI,
} from "@/config/contracts";

// BRND Staking parameters
export interface StakeBrndParams {
  amount: string; // Human-readable amount like "100" or "100.5"
}

export interface UnstakeBrndParams {
  shares: string; // Amount of vault shares to redeem
}

export const useContractWagmi = (
  onStakeSuccess?: (txData: any) => void,
  onUnstakeSuccess?: (txData: any) => void
) => {
  const { address: userAddress, isConnected } = useAccount();
  const {
    writeContract,
    isPending: isWritePending,
    data: hash,
    error: writeError,
  } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash });

  const [error, setError] = useState<string | null>(null);
  const [lastStakeParams, setLastStakeParams] =
    useState<StakeBrndParams | null>(null);
  const [lastUnstakeParams, setLastUnstakeParams] =
    useState<UnstakeBrndParams | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [pendingDepositAmount, setPendingDepositAmount] = useState<
    bigint | null
  >(null);

  // BRND wallet balance
  const {
    data: brndBalance,
    isLoading: isLoadingBrndBalance,
    refetch: refetchBrndBalance,
  } = useReadContract({
    address: BRND_STAKING_CONFIG.BRND_TOKEN,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Vault shares balance
  const {
    data: vaultShares,
    isLoading: isLoadingVaultShares,
    refetch: refetchVaultShares,
  } = useReadContract({
    address: BRND_STAKING_CONFIG.TELLER_VAULT,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Convert shares to BRND amount
  const {
    data: stakedBrndAmount,
    isLoading: isLoadingStakedAmount,
    refetch: refetchStakedAmount,
  } = useReadContract({
    address: BRND_STAKING_CONFIG.TELLER_VAULT,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: vaultShares ? [vaultShares as bigint] : undefined,
    query: {
      enabled: !!vaultShares,
    },
  });

  // Current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: BRND_STAKING_CONFIG.BRND_TOKEN,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: userAddress
        ? [userAddress, BRND_STAKING_CONFIG.TELLER_VAULT]
        : undefined,
      query: {
        enabled: !!userAddress,
      },
    }
  );

  // Combined loading state
  const isPending = isWritePending;

  // Enhanced error handling
  const parseContractError = (error: any): string => {
    const errorMessage =
      error?.message || error?.shortMessage || "Unknown error";

    // Generic wallet/transaction errors
    if (
      errorMessage.includes("User rejected") ||
      errorMessage.includes("user rejected")
    ) {
      return "Transaction was cancelled by user.";
    }
    if (errorMessage.includes("insufficient funds")) {
      return "Insufficient funds for transaction gas fees.";
    }
    if (errorMessage.includes("exceeds balance")) {
      return "Insufficient token balance for this transaction.";
    }

    return `Transaction failed: ${errorMessage}`;
  };

  // Clear error when user changes
  useEffect(() => {
    setError(null);
  }, [userAddress]);

  // Stake BRND tokens (approve + deposit flow)
  const stakeBrnd = useCallback(
    async (params: StakeBrndParams) => {
      setError(null);

      if (!userAddress) {
        setError("Wallet not connected");
        return;
      }

      if (!params.amount || parseFloat(params.amount) <= 0) {
        setError("Invalid amount");
        return;
      }

      try {
        const decimals = 18; // BRND has 18 decimals
        const amountBigInt = parseUnits(params.amount, decimals);

        // Check allowance
        await refetchAllowance();

        if (!currentAllowance || (currentAllowance as bigint) < amountBigInt) {
          // Need to approve first
          setLastStakeParams(params);
          setPendingDepositAmount(amountBigInt);
          setNeedsDeposit(true);

          writeContract({
            address: BRND_STAKING_CONFIG.BRND_TOKEN,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BRND_STAKING_CONFIG.TELLER_VAULT, amountBigInt],
            chainId: 8453,
          });
        } else {
          // Already approved, deposit directly
          setLastStakeParams(params);

          writeContract({
            address: BRND_STAKING_CONFIG.TELLER_VAULT,
            abi: ERC4626_ABI,
            functionName: "deposit",
            args: [amountBigInt, userAddress],
            chainId: 8453,
          });
        }
      } catch (error: any) {
        console.error("Error in stakeBrnd:", error);
        setError(parseContractError(error));
      }
    },
    [userAddress, writeContract, currentAllowance, refetchAllowance]
  );

  // Unstake BRND tokens (redeem shares)
  const unstakeBrnd = useCallback(
    async (params: UnstakeBrndParams) => {
      setError(null);

      if (!userAddress) {
        setError("Wallet not connected");
        return;
      }

      if (!params.shares || parseFloat(params.shares) <= 0) {
        setError("Invalid shares amount");
        return;
      }

      try {
        const decimals = 18; // Vault shares have 18 decimals
        const sharesBigInt = parseUnits(params.shares, decimals);

        setLastUnstakeParams(params);

        writeContract({
          address: BRND_STAKING_CONFIG.TELLER_VAULT,
          abi: ERC4626_ABI,
          functionName: "redeem",
          args: [sharesBigInt, userAddress, userAddress],
          chainId: 8453,
        });
      } catch (error: any) {
        console.error("Error in unstakeBrnd:", error);
        setError(parseContractError(error));
      }
    },
    [userAddress, writeContract]
  );

  // Handle approval confirmation - then trigger deposit
  useEffect(() => {
    const handleApprovalSuccess = async () => {
      if (
        !isConfirmed ||
        !receipt ||
        !needsDeposit ||
        !pendingDepositAmount ||
        !userAddress
      )
        return;

      try {
        // Approval confirmed, now deposit
        setNeedsDeposit(false);

        writeContract({
          address: BRND_STAKING_CONFIG.TELLER_VAULT,
          abi: ERC4626_ABI,
          functionName: "deposit",
          args: [pendingDepositAmount, userAddress],
          chainId: 8453,
        });

        setPendingDepositAmount(null);
      } catch (error) {
        console.error("Error depositing after approval:", error);
        setError("Failed to deposit after approval");
        setNeedsDeposit(false);
        setPendingDepositAmount(null);
      }
    };

    handleApprovalSuccess();
  }, [
    isConfirmed,
    receipt,
    needsDeposit,
    pendingDepositAmount,
    userAddress,
    writeContract,
  ]);

  // Handle stake success
  useEffect(() => {
    const handleStakeSuccess = async () => {
      if (!isConfirmed || !receipt || !lastStakeParams || needsDeposit) return;

      try {
        // Refresh balances
        await refetchBrndBalance();
        await refetchVaultShares();
        await refetchStakedAmount();
        await refetchAllowance();

        // Trigger callback
        if (onStakeSuccess) {
          onStakeSuccess({
            amount: lastStakeParams.amount,
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
        }

        setLastStakeParams(null);
      } catch (error) {
        console.error("Error in stake success handler:", error);
      }
    };

    handleStakeSuccess();
  }, [
    isConfirmed,
    receipt,
    lastStakeParams,
    needsDeposit,
    onStakeSuccess,
    refetchBrndBalance,
    refetchVaultShares,
    refetchStakedAmount,
    refetchAllowance,
  ]);

  // Handle unstake success
  useEffect(() => {
    const handleUnstakeSuccess = async () => {
      if (!isConfirmed || !receipt || !lastUnstakeParams) return;

      try {
        // Refresh balances
        await refetchBrndBalance();
        await refetchVaultShares();
        await refetchStakedAmount();

        // Trigger callback
        if (onUnstakeSuccess) {
          onUnstakeSuccess({
            shares: lastUnstakeParams.shares,
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
        }

        setLastUnstakeParams(null);
      } catch (error) {
        console.error("Error in unstake success handler:", error);
      }
    };

    handleUnstakeSuccess();
  }, [
    isConfirmed,
    receipt,
    lastUnstakeParams,
    onUnstakeSuccess,
    refetchBrndBalance,
    refetchVaultShares,
    refetchStakedAmount,
  ]);

  return {
    userAddress,
    isConnected,

    // Write contract states
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    receipt,
    error: error || (writeError ? parseContractError(writeError) : null),
    writeError,

    // BRND Staking functions
    stakeBrnd,
    unstakeBrnd,

    // BRND Balances
    brndBalance: brndBalance ? formatUnits(brndBalance as bigint, 18) : "0",
    vaultShares: vaultShares ? formatUnits(vaultShares as bigint, 18) : "0",
    stakedBrndAmount: stakedBrndAmount
      ? formatUnits(stakedBrndAmount as bigint, 18)
      : "0",

    // BRND Loading states
    isLoadingBrndBalances:
      isLoadingBrndBalance || isLoadingVaultShares || isLoadingStakedAmount,

    // BRND Refresh function
    refreshBrndBalances: () => {
      refetchBrndBalance();
      refetchVaultShares();
      refetchStakedAmount();
      refetchAllowance();
    },
  };
};
