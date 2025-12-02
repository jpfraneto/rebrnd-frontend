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

export interface WithdrawBrndParams {
  shares: string; // Amount in BRND equivalent (will be converted to vault shares)
}

export const useContractWagmi = (
  onStakeSuccess?: (txData: any) => void,
  onWithdrawSuccess?: (txData: any) => void
) => {
  const { address: userAddress, isConnected } = useAccount();
  const {
    writeContract,
    isPending: isWritePending,
    data: hash,
    error: writeError,
  } = useWriteContract({
    mutation: {
      onSuccess: (data) => {
        console.log("📝 [TELLER WAGMI DEBUG] writeContract onSuccess:", data);
      },
      onError: (error) => {
        console.error("❌ [TELLER WAGMI DEBUG] writeContract onError:", error);
        console.error("❌ [TELLER WAGMI DEBUG] Full error details:", {
          message: error?.message,
          shortMessage: (error as any)?.shortMessage,
          cause: (error as any)?.cause,
          code: (error as any)?.code,
          data: (error as any)?.data,
          metaMessages: (error as any)?.metaMessages,
          stack: error?.stack,
        });
      },
    },
  });
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [lastStakeParams, setLastStakeParams] =
    useState<StakeBrndParams | null>(null);
  const [lastWithdrawParams, setLastWithdrawParams] =
    useState<WithdrawBrndParams | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [pendingDepositAmount, setPendingDepositAmount] = useState<
    bigint | null
  >(null);
  const [lastOperation, setLastOperation] = useState<
    "approve" | "deposit" | "withdraw" | null
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

  // Convert vault shares to BRND amount
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

  // Function to convert BRND amount to vault shares
  const convertBrndToShares = useCallback((brndAmount: string): bigint => {
    try {
      const decimals = 18;
      const brndBigInt = parseUnits(brndAmount, decimals);
      
      // Calculate the ratio of requested BRND to total staked BRND
      if (stakedBrndAmount && vaultShares) {
        const totalStakedBigInt = stakedBrndAmount as bigint;
        const totalSharesBigInt = vaultShares as bigint;
        
        // Calculate proportional shares: (requestedBRND * totalShares) / totalStaked
        const requiredShares = (brndBigInt * totalSharesBigInt) / totalStakedBigInt;
        
        console.log("🔄 [TELLER CONVERSION DEBUG] BRND to Shares:", {
          requestedBrnd: brndAmount,
          brndBigInt: brndBigInt.toString(),
          totalStaked: totalStakedBigInt.toString(),
          totalShares: totalSharesBigInt.toString(),
          requiredShares: requiredShares.toString(),
        });
        
        return requiredShares;
      }
      
      // Fallback to 1:1 conversion if no vault data
      return brndBigInt;
    } catch (error) {
      console.error("Error converting BRND to shares:", error);
      return parseUnits(brndAmount, 18); // Fallback to 1:1 conversion
    }
  }, [stakedBrndAmount, vaultShares]);

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

  // Vault status checks for debugging
  const { data: vaultAsset } = useReadContract({
    address: BRND_STAKING_CONFIG.TELLER_VAULT,
    abi: ERC4626_ABI,
    functionName: "asset",
    query: {
      enabled: !!userAddress,
    },
  });

  // Log vault debugging info
  useEffect(() => {
    if (vaultAsset && userAddress) {
      console.log("🏦 [TELLER VAULT DEBUG] Vault info:", {
        vaultAddress: BRND_STAKING_CONFIG.TELLER_VAULT,
        expectedAsset: BRND_STAKING_CONFIG.BRND_TOKEN,
        actualAsset: vaultAsset,
        assetsMatch: vaultAsset?.toLowerCase() === BRND_STAKING_CONFIG.BRND_TOKEN.toLowerCase(),
      });
    }
  }, [vaultAsset, userAddress]);

  // Combined loading state
  const isPending = isWritePending;

  // Enhanced error handling
  const parseContractError = (error: any): string => {
    const errorMessage =
      error?.message || error?.shortMessage || "Unknown error";

    console.log("🔍 [TELLER ERROR DEBUG] Parsing error:", {
      fullError: error,
      message: error?.message,
      shortMessage: error?.shortMessage,
      cause: error?.cause,
      data: error?.data,
      code: error?.code,
      metaMessages: error?.metaMessages,
    });

    // Check for specific Teller contract errors
    if (errorMessage.includes("P")) {
      return "Pool is paused. Please try again later.";
    }
    if (errorMessage.includes("MMCT")) {
      return "Mismatched collateral token. Wrong token type.";
    }
    if (errorMessage.includes("LMP")) {
      return "Liquidity limit exceeded. Pool doesn't have enough liquidity.";
    }
    if (errorMessage.includes("FD")) {
      return "First deposit restriction. Only owner can make first deposit.";
    }
    if (errorMessage.includes("IS")) {
      return "Insufficient shares. Pool activation requirements not met.";
    }
    if (errorMessage.includes("TB")) {
      return "Token balance mismatch. Transfer verification failed.";
    }

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
    if (errorMessage.includes("execution reverted")) {
      return "Contract execution failed. The transaction was reverted by the smart contract. Check your inputs and try again.";
    }

    return `Transaction failed: ${errorMessage}`;
  };

  // Debug state changes
  useEffect(() => {
    console.log("🔄 [TELLER STATE DEBUG] State change:", {
      hash,
      isPending: isWritePending,
      isConfirming,
      isConfirmed,
      hasReceipt: !!receipt,
      hasWriteError: !!writeError,
      hasError: !!error,
    });
  }, [
    hash,
    isWritePending,
    isConfirming,
    isConfirmed,
    receipt,
    writeError,
    error,
  ]);

  // Clear operation state when user rejects transaction
  useEffect(() => {
    if (writeError) {
      const errorMessage =
        (writeError as any)?.message || (writeError as any)?.shortMessage || "";
      if (
        errorMessage.includes("rejected") ||
        errorMessage.includes("User rejected")
      ) {
        console.log(
          "🔄 [TELLER STATE DEBUG] User rejected transaction - clearing operation state"
        );
        setLastOperation(null);
        setNeedsDeposit(false);
        setPendingDepositAmount(null);
      }
    }
  }, [writeError]);

  // Clear error and operation state when user changes
  useEffect(() => {
    setError(null);
    setLastOperation(null);
    setNeedsDeposit(false);
    setPendingDepositAmount(null);
  }, [userAddress]);

  // Stake BRND tokens (approve + deposit flow)
  const stakeBrnd = useCallback(
    async (params: StakeBrndParams) => {
      console.log(
        "🚀 [TELLER STAKING DEBUG] stakeBrnd called with params:",
        params
      );
      setError(null);

      if (!userAddress) {
        console.log("❌ [TELLER STAKING DEBUG] No wallet connected");
        setError("Wallet not connected");
        return;
      }

      if (!params.amount || parseFloat(params.amount) <= 0) {
        console.log("❌ [TELLER STAKING DEBUG] Invalid amount:", params.amount);
        setError("Invalid amount");
        return;
      }

      // Check user balance with precision safety
      const userBalance = brndBalance ? parseFloat(formatUnits(brndBalance as bigint, 18)) : 0;
      const requestedAmount = parseFloat(params.amount);
      
      console.log("💰 [TELLER STAKING DEBUG] Balance check:", {
        userBalance,
        requestedAmount,
        hasEnoughBalance: userBalance >= requestedAmount,
        rawBalance: brndBalance?.toString(),
      });
      
      // Add small buffer for precision issues (0.000001 BRND)
      const balanceBuffer = 0.000001;
      if (userBalance < requestedAmount || (requestedAmount > userBalance - balanceBuffer && requestedAmount !== userBalance)) {
        console.log("❌ [TELLER STAKING DEBUG] Insufficient balance or precision issue");
        setError(`Insufficient balance. You have ${userBalance.toFixed(6)} BRND but trying to stake ${requestedAmount} BRND`);
        return;
      }

      try {
        const decimals = 18; // BRND has 18 decimals
        const rawAmount = parseFloat(params.amount);
        console.log("📊 [TELLER STAKING DEBUG] Raw amount:", rawAmount);

        // Use the exact amount for deposit - no rounding up needed
        const amountBigInt = parseUnits(params.amount, decimals);
        console.log(
          "📊 [TELLER STAKING DEBUG] Amount in BigInt:",
          amountBigInt.toString()
        );

        // Check allowance - refresh first to get latest data
        console.log("🔍 [TELLER STAKING DEBUG] Checking current allowance...");
        const { data: latestAllowance } = await refetchAllowance();
        const allowance = latestAllowance || currentAllowance;
        console.log(
          "🔍 [TELLER STAKING DEBUG] Current allowance:",
          allowance?.toString()
        );

        if (!allowance || (allowance as bigint) < amountBigInt) {
          // Need to approve first - approve exact amount needed
          console.log(
            "⏳ [TELLER STAKING DEBUG] Need approval - initiating approve transaction"
          );
          console.log("📋 [TELLER STAKING DEBUG] Approve params:", {
            token: BRND_STAKING_CONFIG.BRND_TOKEN,
            spender: BRND_STAKING_CONFIG.TELLER_VAULT,
            amount: amountBigInt.toString(),
            chainId: 8453,
          });

          setLastStakeParams(params);
          setPendingDepositAmount(amountBigInt);
          setNeedsDeposit(true);
          setLastOperation("approve");

          writeContract({
            address: BRND_STAKING_CONFIG.BRND_TOKEN,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BRND_STAKING_CONFIG.TELLER_VAULT, amountBigInt],
            chainId: 8453,
          });
        } else {
          // Already approved, deposit directly
          console.log(
            "✅ [TELLER STAKING DEBUG] Already approved - proceeding with deposit"
          );
          console.log("📋 [TELLER STAKING DEBUG] Deposit params:", {
            vault: BRND_STAKING_CONFIG.TELLER_VAULT,
            amount: amountBigInt.toString(),
            receiver: userAddress,
            chainId: 8453,
          });

          setLastStakeParams(params);
          setLastOperation("deposit");

          writeContract({
            address: BRND_STAKING_CONFIG.TELLER_VAULT,
            abi: ERC4626_ABI,
            functionName: "deposit",
            args: [amountBigInt, userAddress],
            chainId: 8453,
          });
        }
      } catch (error: any) {
        console.error("💥 [TELLER STAKING DEBUG] Error in stakeBrnd:", error);
        console.error("💥 [TELLER STAKING DEBUG] Error details:", {
          message: error?.message,
          shortMessage: error?.shortMessage,
          code: error?.code,
          data: error?.data,
          stack: error?.stack,
        });
        setError(parseContractError(error));
        // Clear operation state on error
        setLastOperation(null);
        setNeedsDeposit(false);
        setPendingDepositAmount(null);
      }
    },
    [userAddress, writeContract, currentAllowance, refetchAllowance]
  );

  // Withdraw BRND tokens (redeem shares from vault)
  const withdrawBrnd = useCallback(
    async (params: WithdrawBrndParams) => {
      console.log(
        "🔄 [TELLER WITHDRAW DEBUG] withdrawBrnd called with params:",
        params
      );
      setError(null);

      if (!userAddress) {
        console.log("❌ [TELLER WITHDRAW DEBUG] No wallet connected");
        setError("Wallet not connected");
        return;
      }

      if (!params.shares || parseFloat(params.shares) <= 0) {
        console.log(
          "❌ [TELLER WITHDRAW DEBUG] Invalid BRND amount:",
          params.shares
        );
        setError("Invalid withdrawal amount");
        return;
      }

      // Check if user has enough staked BRND with precision safety
      const userStakedAmount = stakedBrndAmount ? parseFloat(formatUnits(stakedBrndAmount as bigint, 18)) : 0;
      const requestedAmount = parseFloat(params.shares);
      
      console.log("💰 [TELLER WITHDRAW DEBUG] Balance check:", {
        userStakedAmount,
        requestedAmount,
        hasEnoughStaked: userStakedAmount >= requestedAmount,
        rawStakedAmount: stakedBrndAmount?.toString(),
      });
      
      // Add small buffer for precision issues (0.000001 BRND)
      const balanceBuffer = 0.000001;
      if (userStakedAmount < requestedAmount || (requestedAmount > userStakedAmount - balanceBuffer && requestedAmount !== userStakedAmount)) {
        console.log("❌ [TELLER WITHDRAW DEBUG] Insufficient staked balance or precision issue");
        setError(`Insufficient staked balance. You have ${userStakedAmount.toFixed(6)} BRND staked but trying to withdraw ${requestedAmount} BRND`);
        return;
      }

      try {
        // Convert BRND amount to vault shares
        const sharesBigInt = convertBrndToShares(params.shares);
        
        console.log(
          "📊 [TELLER WITHDRAW DEBUG] Converted to shares:",
          sharesBigInt.toString()
        );
        console.log("📋 [TELLER WITHDRAW DEBUG] Redeem params:", {
          vault: BRND_STAKING_CONFIG.TELLER_VAULT,
          shares: sharesBigInt.toString(),
          receiver: userAddress,
          owner: userAddress,
          chainId: 8453,
        });

        setLastWithdrawParams(params);
        setLastOperation("withdraw");

        writeContract({
          address: BRND_STAKING_CONFIG.TELLER_VAULT,
          abi: ERC4626_ABI,
          functionName: "redeem",
          args: [sharesBigInt, userAddress, userAddress],
          chainId: 8453,
        });
      } catch (error: any) {
        console.error(
          "💥 [TELLER WITHDRAW DEBUG] Error in withdrawBrnd:",
          error
        );
        console.error("💥 [TELLER WITHDRAW DEBUG] Error details:", {
          message: error?.message,
          shortMessage: error?.shortMessage,
          code: error?.code,
          data: error?.data,
          stack: error?.stack,
        });
        setError(parseContractError(error));
        // Clear operation state on error
        setLastOperation(null);
      }
    },
    [userAddress, writeContract, stakedBrndAmount, convertBrndToShares]
  );

  // Handle approval confirmation - then trigger deposit
  useEffect(() => {
    const handleApprovalSuccess = async () => {
      console.log(
        "🔄 [TELLER APPROVAL DEBUG] handleApprovalSuccess triggered",
        {
          isConfirmed,
          hasReceipt: !!receipt,
          needsDeposit,
          hasPendingAmount: !!pendingDepositAmount,
          hasUserAddress: !!userAddress,
          lastOperation,
        }
      );

      if (
        !isConfirmed ||
        !receipt ||
        !needsDeposit ||
        !pendingDepositAmount ||
        !userAddress ||
        lastOperation !== "approve"
      ) {
        console.log(
          "🚫 [TELLER APPROVAL DEBUG] Conditions not met - skipping deposit"
        );
        return;
      }

      try {
        console.log(
          "✅ [TELLER APPROVAL DEBUG] Approval confirmed - proceeding with deposit"
        );
        console.log(
          "📋 [TELLER APPROVAL DEBUG] Post-approval deposit params:",
          {
            vault: BRND_STAKING_CONFIG.TELLER_VAULT,
            amount: pendingDepositAmount.toString(),
            receiver: userAddress,
            chainId: 8453,
            txHash: receipt.transactionHash,
          }
        );

        // Approval confirmed, now deposit
        setNeedsDeposit(false);
        setLastOperation("deposit");

        writeContract({
          address: BRND_STAKING_CONFIG.TELLER_VAULT,
          abi: ERC4626_ABI,
          functionName: "deposit",
          args: [pendingDepositAmount, userAddress],
          chainId: 8453,
        });

        setPendingDepositAmount(null);
      } catch (error: any) {
        console.error(
          "💥 [TELLER APPROVAL DEBUG] Error depositing after approval:",
          error
        );
        console.error("💥 [TELLER APPROVAL DEBUG] Deposit error details:", {
          message: error?.message,
          shortMessage: error?.shortMessage,
          code: error?.code,
          data: error?.data,
        });
        setError("Failed to deposit after approval");
        setNeedsDeposit(false);
        setPendingDepositAmount(null);
        setLastOperation(null);
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
    lastOperation,
  ]);

  // Handle stake success
  useEffect(() => {
    const handleStakeSuccess = async () => {
      console.log("🎉 [TELLER SUCCESS DEBUG] handleStakeSuccess triggered", {
        isConfirmed,
        hasReceipt: !!receipt,
        hasLastStakeParams: !!lastStakeParams,
        needsDeposit,
        lastOperation,
      });

      // Only handle success for deposit operations, not approval operations
      if (
        !isConfirmed ||
        !receipt ||
        !lastStakeParams ||
        needsDeposit ||
        lastOperation !== "deposit"
      ) {
        console.log(
          "🚫 [TELLER SUCCESS DEBUG] Conditions not met - skipping success handler",
          {
            isConfirmed,
            hasReceipt: !!receipt,
            hasLastStakeParams: !!lastStakeParams,
            needsDeposit,
            lastOperation,
          }
        );
        return;
      }

      try {
        console.log(
          "✅ [TELLER SUCCESS DEBUG] Stake successful - refreshing balances"
        );
        console.log("📋 [TELLER SUCCESS DEBUG] Success details:", {
          amount: lastStakeParams.amount,
          txHash: receipt.transactionHash,
          blockNumber: Number(receipt.blockNumber),
          gasUsed: receipt.gasUsed?.toString(),
        });

        // Refresh balances
        await refetchBrndBalance();
        await refetchVaultShares();
        await refetchStakedAmount();
        await refetchAllowance();

        console.log(
          "🔄 [TELLER SUCCESS DEBUG] Balances refreshed successfully"
        );

        // Trigger callback
        if (onStakeSuccess) {
          onStakeSuccess({
            amount: lastStakeParams.amount,
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
          console.log("📞 [TELLER SUCCESS DEBUG] Success callback triggered");
        }

        setLastStakeParams(null);
        setLastOperation(null);
      } catch (error: any) {
        console.error(
          "💥 [TELLER SUCCESS DEBUG] Error in stake success handler:",
          error
        );
        console.error(
          "💥 [TELLER SUCCESS DEBUG] Success handler error details:",
          {
            message: error?.message,
            shortMessage: error?.shortMessage,
            code: error?.code,
            data: error?.data,
          }
        );
      }
    };

    handleStakeSuccess();
  }, [
    isConfirmed,
    receipt,
    lastStakeParams,
    needsDeposit,
    lastOperation,
    onStakeSuccess,
    refetchBrndBalance,
    refetchVaultShares,
    refetchStakedAmount,
    refetchAllowance,
  ]);

  // Handle withdraw success
  useEffect(() => {
    const handleWithdrawSuccess = async () => {
      console.log(
        "🎯 [TELLER WITHDRAW SUCCESS DEBUG] handleWithdrawSuccess triggered",
        {
          isConfirmed,
          hasReceipt: !!receipt,
          hasLastWithdrawParams: !!lastWithdrawParams,
          lastOperation,
        }
      );

      // Only handle success for withdraw operations
      if (
        !isConfirmed ||
        !receipt ||
        !lastWithdrawParams ||
        lastOperation !== "withdraw"
      ) {
        console.log(
          "🚫 [TELLER WITHDRAW SUCCESS DEBUG] Conditions not met - skipping success handler",
          {
            isConfirmed,
            hasReceipt: !!receipt,
            hasLastWithdrawParams: !!lastWithdrawParams,
            lastOperation,
          }
        );
        return;
      }

      try {
        console.log(
          "✅ [TELLER WITHDRAW SUCCESS DEBUG] Withdraw successful - refreshing balances"
        );
        console.log("📋 [TELLER WITHDRAW SUCCESS DEBUG] Success details:", {
          shares: lastWithdrawParams.shares,
          txHash: receipt.transactionHash,
          blockNumber: Number(receipt.blockNumber),
          gasUsed: receipt.gasUsed?.toString(),
        });

        // Refresh balances
        await refetchBrndBalance();
        await refetchVaultShares();
        await refetchStakedAmount();

        console.log(
          "🔄 [TELLER WITHDRAW SUCCESS DEBUG] Balances refreshed successfully"
        );

        // Trigger callback
        if (onWithdrawSuccess) {
          onWithdrawSuccess({
            shares: lastWithdrawParams.shares,
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
          console.log(
            "📞 [TELLER WITHDRAW SUCCESS DEBUG] Success callback triggered"
          );
        }

        setLastWithdrawParams(null);
        setLastOperation(null);
      } catch (error: any) {
        console.error(
          "💥 [TELLER WITHDRAW SUCCESS DEBUG] Error in withdraw success handler:",
          error
        );
        console.error(
          "💥 [TELLER WITHDRAW SUCCESS DEBUG] Success handler error details:",
          {
            message: error?.message,
            shortMessage: error?.shortMessage,
            code: error?.code,
            data: error?.data,
          }
        );
      }
    };

    handleWithdrawSuccess();
  }, [
    isConfirmed,
    receipt,
    lastWithdrawParams,
    lastOperation,
    onWithdrawSuccess,
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
    withdrawBrnd,

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
