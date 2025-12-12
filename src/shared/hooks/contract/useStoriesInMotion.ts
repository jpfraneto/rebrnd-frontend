// src/shared/hooks/contract/useStoriesInMotion.ts
import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { readContract } from "wagmi/actions";
import { config } from "@/shared/config/wagmi";
import { parseUnits, formatUnits } from "viem";

import {
  BRND_SEASON_2_CONFIG,
  BRND_SEASON_2_CONFIG_ABI,
  ERC20_ABI,
} from "@/config/contracts";
import { request } from "@/services/api";
import { BLOCKCHAIN_SERVICE, BRAND_SERVICE } from "@/config/api";
import { useAuth } from "@/shared/hooks/auth";

// Types
export interface AuthorizeWalletParams {
  fid: number;
  deadline: number;
  signature: string;
}

export interface LevelUpParams {
  fid: number;
  newLevel: number;
  deadline: number;
  signature: string;
}

export interface VoteParams {
  brandIds: [number, number, number];
  authData?: string;
}

export interface ClaimRewardParams {
  amount: string;
  fid: number;
  day: number;
  deadline: number;
  signature: string;
}

export interface UserInfo {
  fid: number;
  brndPowerLevel: number;
  lastVoteDay: number;
  totalVotes: number;
}

export interface PowerLevelInfo {
  currentLevel: number;
  currentPowerLevel: any;
  nextLevel: any;
  allLevels: any[];
  progress: any;
}

export interface StakeInfo {
  walletBalance: string;
  vaultShares: string;
  stakedAmount: string;
  totalBalance: string;
  addresses: string[];
}

export const useStoriesInMotion = (
  _onAuthorizeSuccess?: (txData: any) => void, // Deprecated - authorization now happens automatically in vote() and levelUpBrndPower()
  onLevelUpSuccess?: (txData: any) => void,
  onVoteSuccess?: (txData: any) => void,
  onClaimSuccess?: (txData: any) => void,
  onBrandCreateSuccess?: (txData: any) => void
) => {
  const { address: userAddress, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
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
  const [isWalletAuthorized, setIsWalletAuthorized] = useState(false);
  const [lastOperation, setLastOperation] = useState<string | null>(null);
  const [pendingVoteBrandIds, setPendingVoteBrandIds] = useState<
    [number, number, number] | null
  >(null);
  const [pendingVoteAuthData, setPendingVoteAuthData] = useState<string | null>(
    null
  );
  const [pendingBrandCreateData, setPendingBrandCreateData] = useState<{
    handle: string;
    metadataHash: string;
    fid: number;
    walletAddress: string;
  } | null>(null);

  // Get FID from auth context
  const { data: authData } = useAuth();
  const userFid = authData?.fid ? Number(authData.fid) : null;

  // Check if user is on correct network
  const isCorrectNetwork = chainId === BRND_SEASON_2_CONFIG.CHAIN_ID;

  // Get user info from contract (V5 uses getUserInfoByWallet for backwards compatibility)
  const {
    data: userInfo,
    isLoading: isLoadingUserInfo,
    refetch: refetchUserInfo,
  } = useReadContract({
    address: BRND_SEASON_2_CONFIG.CONTRACT,
    abi: BRND_SEASON_2_CONFIG_ABI,
    functionName: "getUserInfoByWallet",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress && isCorrectNetwork,
    },
  });

  // Get BRND balance
  const {
    data: brndBalance,
    isLoading: isLoadingBrndBalance,
    refetch: refetchBrndBalance,
  } = useReadContract({
    address: BRND_SEASON_2_CONFIG.BRND_TOKEN,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress && isCorrectNetwork,
      // Refetch when address or network changes
      refetchOnMount: true,
      refetchOnWindowFocus: false, // Minimize RPC calls
    },
  });

  // Track previous address to only refetch when it actually changes
  const prevAddressRef = useRef<string | undefined>(undefined);

  // Explicitly refetch balance when wallet address actually changes (not on every render)
  useEffect(() => {
    // Only refetch if:
    // 1. We have an address
    // 2. We're on the correct network
    // 3. The address actually changed (not just a re-render)
    if (
      userAddress &&
      isCorrectNetwork &&
      isConnected &&
      userAddress !== prevAddressRef.current
    ) {
      prevAddressRef.current = userAddress;
      // Refetch balance when address changes
      refetchBrndBalance();
    } else if (!userAddress) {
      // Reset ref when disconnected
      prevAddressRef.current = undefined;
    }
  }, [userAddress, isConnected, isCorrectNetwork, refetchBrndBalance]);

  // Get BRND allowance for contract
  const { data: brndAllowance, refetch: refetchAllowance } = useReadContract({
    address: BRND_SEASON_2_CONFIG.BRND_TOKEN,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress
      ? [userAddress, BRND_SEASON_2_CONFIG.CONTRACT]
      : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Check if voted today (V5 uses FID instead of wallet address)
  const { data: hasVotedToday, refetch: refetchVotedToday } = useReadContract({
    address: BRND_SEASON_2_CONFIG.CONTRACT,
    abi: BRND_SEASON_2_CONFIG_ABI,
    functionName: "hasVotedToday",
    args: userFid ? [userFid, Math.floor(Date.now() / 86400000)] : undefined,
    query: {
      enabled: !!userFid && isCorrectNetwork,
    },
  });

  // Get vote cost based on power level (V5 contract logic)
  const getVoteCost = useCallback((powerLevel: number): bigint => {
    // V5 contract: getVoteCost(uint8 brndPowerLevel)
    // if powerLevel == 0, return BASE_VOTE_COST (100 BRND)
    // if powerLevel == 1, return LEVEL_1_VOTE_COST (150 BRND) - Special case!
    // else return BASE_VOTE_COST * powerLevel (Level 2+: 100 * level)
    if (powerLevel === 0) return parseUnits("100", 18); // BASE_VOTE_COST = 100 BRND
    if (powerLevel === 1) return parseUnits("150", 18); // LEVEL_1_VOTE_COST = 150 BRND
    return parseUnits((powerLevel * 100).toString(), 18); // Level 2+: 100 * level
  }, []);

  // Check if wallet is authorized (has FID linked)
  const { data: authorizedFid } = useReadContract({
    address: BRND_SEASON_2_CONFIG.CONTRACT,
    abi: BRND_SEASON_2_CONFIG_ABI,
    functionName: "authorizedFidOf",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress && isCorrectNetwork,
    },
  });

  // Switch to Base network
  const switchToBase = useCallback(async () => {
    if (!isCorrectNetwork) {
      try {
        await switchChain({ chainId: BRND_SEASON_2_CONFIG.CHAIN_ID });
      } catch (error) {
        console.error("Failed to switch network:", error);
        setError("Please switch to Base network");
        throw error;
      }
    }
  }, [isCorrectNetwork, switchChain]);

  // Backend API calls
  const getAuthorizationSignature = useCallback(
    async (deadline: number) => {
      return await request<{
        fid: number;
        authData?: string;
        signature?: string;
      }>(`${BLOCKCHAIN_SERVICE}/authorize-wallet`, {
        method: "POST",
        body: {
          walletAddress: userAddress,
          deadline,
        },
      });
    },
    [userAddress]
  );

  const getLevelUpSignature = useCallback(
    async (newLevel: number, deadline: number) => {
      // Verify token is available (request function will include it automatically)
      const { getFarcasterToken } = await import("@/shared/utils/auth");
      const token = getFarcasterToken();
      console.log("🔐 [LevelUp] Requesting level up signature", {
        newLevel,
        deadline,
        walletAddress: userAddress,
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });

      return await request<{
        validation: {
          eligible: boolean;
          reason?: string;
        };
        signature: string;
      }>(`${BLOCKCHAIN_SERVICE}/level-up`, {
        method: "POST",
        body: {
          newLevel,
          deadline,
          walletAddress: userAddress,
        },
      });
    },
    [userAddress]
  );

  const getVoteAuthorizationSignature = useCallback(
    async (brandIds: [number, number, number], deadline: number) => {
      // Verify token is available (request function will include it automatically)
      const { getFarcasterToken } = await import("@/shared/utils/auth");
      const token = getFarcasterToken();
      console.log("🔐 [VoteAuth] Requesting vote authorization signature", {
        brandIds,
        deadline,
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });

      return await request<{
        authData: string;
        fid: number;
        walletAddress: string;
        brandIds: [number, number, number];
        deadline: number;
        message: string;
      }>(`${BLOCKCHAIN_SERVICE}/authorize-vote`, {
        method: "POST",
        body: {
          walletAddress: userAddress,
          brandIds,
          deadline,
        },
      });
    },
    [userAddress]
  );

  const getClaimRewardSignature = useCallback(
    async (
      castHash: string,
      voteId: string,
      recipientAddress?: string,
      transactionHash?: string
    ) => {
      const { getFarcasterToken } = await import("@/shared/utils/auth");
      const token = getFarcasterToken();
      console.log(
        "🔐 [ClaimReward] Requesting claim signature via verify-share",
        {
          castHash,
          voteId,
          recipientAddress,
          transactionHash,
          hasToken: !!token,
          tokenLength: token?.length || 0,
        }
      );

      const response = await request<{
        verified: boolean;
        pointsAwarded: number;
        newTotalPoints: number;
        message: string;
        day: number;
        claimSignature: {
          signature: string;
          amount: string;
          deadline: number;
          nonce: number;
          canClaim: boolean;
        } | null;
        note?: string;
      }>(`${BRAND_SERVICE}/verify-share`, {
        method: "POST",
        body: {
          castHash,
          voteId,
          recipientAddress: recipientAddress || userAddress,
          transactionHash,
        },
      });

      console.log("📥 [ClaimReward] RAW Response received:", {
        verified: response.verified,
        day: response.day,
        hasClaimSignature: !!response.claimSignature,
        rawClaimSignature: response.claimSignature,
      });

      if (response.claimSignature) {
        console.log("🔍 [ClaimReward] Claim signature details:", {
          amount: response.claimSignature.amount,
          amountType: typeof response.claimSignature.amount,
          amountLength: String(response.claimSignature.amount).length,
          amountValue: response.claimSignature.amount,
        });
      }

      return response;
    },
    [userAddress]
  );

  // Get claim signature for already shared vote (without requiring castHash)
  const getClaimSignatureForSharedVote = useCallback(
    async (
      voteId: string,
      recipientAddress?: string,
      transactionHash?: string
    ) => {
      const { getFarcasterToken } = await import("@/shared/utils/auth");
      const token = getFarcasterToken();
      console.log(
        "🔐 [ClaimReward] Requesting claim signature for already shared vote",
        {
          voteId,
          recipientAddress,
          transactionHash,
          hasToken: !!token,
          tokenLength: token?.length || 0,
        }
      );

      // Call verify-share with empty castHash - backend should handle already shared votes
      const response = await request<{
        verified: boolean;
        pointsAwarded: number;
        newTotalPoints: number;
        message: string;
        day: number;
        claimSignature: {
          signature: string;
          amount: string;
          deadline: number;
          nonce: number;
          canClaim: boolean;
        } | null;
        castHash?: string; // Backend may return the castHash for already shared votes
        note?: string;
      }>(`${BRAND_SERVICE}/verify-share`, {
        method: "POST",
        body: {
          castHash: "", // Empty castHash indicates we want claim signature for already shared vote
          voteId,
          recipientAddress: recipientAddress || userAddress,
          transactionHash,
        },
      });

      console.log("📥 [ClaimReward] RAW Response received for shared vote:", {
        verified: response.verified,
        day: response.day,
        hasClaimSignature: !!response.claimSignature,
        hasCastHash: !!response.castHash,
        rawClaimSignature: response.claimSignature,
      });

      if (response.claimSignature) {
        console.log("🔍 [ClaimReward] Claim signature details:", {
          amount: response.claimSignature.amount,
          amountType: typeof response.claimSignature.amount,
          amountLength: String(response.claimSignature.amount).length,
          amountValue: response.claimSignature.amount,
        });
      }

      return response;
    },
    [userAddress]
  );

  const getPowerLevelInfo = useCallback(
    async (fid: number): Promise<PowerLevelInfo> => {
      return await request<PowerLevelInfo>(
        `${BLOCKCHAIN_SERVICE}/power-level/${fid}`,
        {
          method: "GET",
        }
      );
    },
    []
  );

  const getStakeInfo = useCallback(async (fid: number): Promise<StakeInfo> => {
    return await request<StakeInfo>(`${BLOCKCHAIN_SERVICE}/user-stake/${fid}`, {
      method: "GET",
    });
  }, []);

  // Note: authorizeWallet function removed - the contract doesn't have a public authorizeWallet function.
  // Authorization happens automatically inside vote() and levelUpBrndPower() via the internal _authorizeWallet function.

  // Level up power
  const levelUpBrndPower = useCallback(
    async (targetLevel: number) => {
      setError(null);
      await switchToBase();

      if (!userAddress || !userFid) {
        setError("Wallet not authorized");
        return;
      }

      try {
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const levelUpData = await getLevelUpSignature(targetLevel, deadline);

        if (!levelUpData.validation.eligible) {
          throw new Error(
            `Cannot level up: ${
              levelUpData.validation.reason || "Requirements not met"
            }`
          );
        }

        setLastOperation("levelup");

        // Get authorization data - this is ALREADY encoded by backend
        const authDeadline = Math.floor(Date.now() / 1000) + 3600;
        const authResponse = await getAuthorizationSignature(authDeadline);

        // Use the authData directly (it's already encoded as bytes)
        const authData =
          authResponse.authData || authResponse.signature || "0x";

        // Just call the contract with the already-encoded authData
        await writeContract({
          address: BRND_SEASON_2_CONFIG.CONTRACT,
          abi: BRND_SEASON_2_CONFIG_ABI,
          functionName: "levelUpBrndPower",
          args: [
            userFid,
            targetLevel,
            deadline,
            levelUpData.signature,
            authData, // ← Use directly, don't encode again
          ],
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });
      } catch (error: any) {
        console.error("Level up failed:", error);
        setError(error.message || "Level up failed");
      }
    },
    [
      userAddress,
      userFid,
      switchToBase,
      getLevelUpSignature,
      getAuthorizationSignature,
      writeContract,
    ]
  );

  // Vote function - Updated for V4 contract
  const vote = useCallback(
    async (brandIds: [number, number, number]) => {
      console.log("🗳️ [Vote] Starting vote flow", { brandIds });
      setError(null);

      console.log("🔄 [Vote] Switching to Base network...");
      await switchToBase();

      if (!userAddress) {
        console.error("❌ [Vote] Wallet not connected");
        setError("Wallet not connected");
        return;
      }
      console.log("✅ [Vote] Wallet connected", { userAddress });

      try {
        const currentUserInfo = userInfo as any;
        const powerLevel = currentUserInfo ? Number(currentUserInfo[1]) : 1;
        const voteCost = getVoteCost(powerLevel);
        console.log("📊 [Vote] Vote cost calculated", {
          powerLevel,
          voteCost: formatUnits(voteCost, 18),
        });

        // Check BRND balance
        const balance = (brndBalance as bigint) || 0n;
        console.log("💰 [Vote] Checking BRND balance", {
          balance: formatUnits(balance, 18),
          required: formatUnits(voteCost, 18),
        });
        if (balance < voteCost) {
          const errorMsg = `Insufficient BRND balance. Need ${formatUnits(
            voteCost,
            18
          )} BRND, have ${formatUnits(balance, 18)} BRND`;
          console.error("❌ [Vote]", errorMsg);
          throw new Error(errorMsg);
        }
        console.log("✅ [Vote] BRND balance sufficient");

        // Prepare vote-specific authorization data (if needed)
        let authData = "0x";
        if (!isWalletAuthorized) {
          console.log(
            "🔐 [Vote] Wallet not authorized, preparing vote-specific authData..."
          );
          if (!userFid) {
            console.error("❌ [Vote] User not authenticated");
            throw new Error("User not authenticated");
          }

          const deadline = Math.floor(Date.now() / 1000) + 3600;
          console.log(
            "📝 [Vote] Requesting vote authorization signature from backend",
            {
              userFid,
              brandIds,
              deadline,
            }
          );

          try {
            const voteAuth = await getVoteAuthorizationSignature(
              brandIds,
              deadline
            );
            console.log("📥 [Vote] Received vote authorization response", {
              hasAuthData: !!voteAuth.authData,
              authDataPreview: voteAuth.authData?.substring(0, 20) + "...",
              message: voteAuth.message,
            });

            if (!voteAuth.authData) {
              console.error(
                "❌ [Vote] Failed to get vote authorization signature from backend - no authData in response"
              );
              throw new Error(
                "Failed to get vote authorization signature from backend"
              );
            }

            // Use the authData directly (it's already properly encoded by backend)
            authData = voteAuth.authData;
            console.log("✅ [Vote] Vote authorization data prepared", {
              authDataLength: authData.length,
              authDataPreview: authData.substring(0, 20) + "...",
            });
          } catch (authError: any) {
            console.error("❌ [Vote] Authorization request failed:", authError);
            console.error("❌ [Vote] Auth error details:", {
              message: authError.message,
              response: authError.response,
              status: authError.status,
            });
            throw new Error(`Authorization failed: ${authError.message}`);
          }
        } else {
          console.log(
            "✅ [Vote] Wallet already authorized, skipping authData preparation"
          );
        }

        // Check and handle BRND approval
        const allowance = (brndAllowance as bigint) || 0n;
        console.log("🔍 [Vote] Checking BRND allowance", {
          allowance: formatUnits(allowance, 18),
          required: formatUnits(voteCost, 18),
        });
        if (allowance < voteCost) {
          console.log("⚠️ [Vote] Insufficient allowance, approval needed");
          setPendingVoteBrandIds(brandIds);
          setPendingVoteAuthData(authData);
          setLastOperation("approve");
          console.log("💾 [Vote] Stored pending vote data", {
            brandIds,
            hasAuthData: authData !== "0x",
          });
          console.log("📤 [Vote] Initiating approval transaction...");
          await writeContract({
            address: BRND_SEASON_2_CONFIG.BRND_TOKEN,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BRND_SEASON_2_CONFIG.CONTRACT, 11111000000000000000000n],
          });
          console.log(
            "✅ [Vote] Approval transaction submitted, waiting for confirmation..."
          );
          return;
        }

        // Approval is sufficient, proceed with vote
        console.log("✅ [Vote] Allowance sufficient, proceeding with vote");
        console.log("🔍 [Vote] Final transaction details:", {
          contract: BRND_SEASON_2_CONFIG.CONTRACT,
          brandIds,
          authData: authData.substring(0, 20) + "...",
          authDataLength: authData.length,
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });

        setLastOperation("vote");

        await writeContract({
          address: BRND_SEASON_2_CONFIG.CONTRACT,
          abi: BRND_SEASON_2_CONFIG_ABI,
          functionName: "vote",
          args: [brandIds, authData],
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });
        console.log(
          "✅ [Vote] Vote transaction submitted, waiting for confirmation..."
        );
      } catch (error: any) {
        console.error("❌ [Vote] Vote failed:", error);
        console.error("❌ [Vote] Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
        setError(error.message || "Vote failed");
      }
    },
    [
      userAddress,
      userInfo,
      brndBalance,
      brndAllowance,
      isWalletAuthorized,
      userFid,
      switchToBase,
      getVoteCost,
      getAuthorizationSignature,
      getVoteAuthorizationSignature,
      writeContract,
    ]
  );

  // Get reward amount for a power level
  const getRewardAmount = useCallback(
    async (powerLevel: number): Promise<string> => {
      try {
        const rewardAmount = await readContract(config, {
          address: BRND_SEASON_2_CONFIG.CONTRACT,
          abi: BRND_SEASON_2_CONFIG_ABI,
          functionName: "getRewardAmount",
          args: [powerLevel],
        });
        return formatUnits(rewardAmount as bigint, 18);
      } catch (error) {
        console.error("Failed to get reward amount:", error);
        return "0";
      }
    },
    []
  );

  // Get brand information
  const getBrand = useCallback(async (brandId: number) => {
    try {
      const brandInfo = await readContract(config, {
        address: BRND_SEASON_2_CONFIG.CONTRACT,
        abi: BRND_SEASON_2_CONFIG_ABI,
        functionName: "getBrand",
        args: [brandId],
      });
      return brandInfo;
    } catch (error) {
      console.error("Failed to get brand info:", error);
      return null;
    }
  }, []);

  // Create brand on-chain
  const createBrandOnChain = useCallback(
    async (
      handle: string,
      metadataHash: string,
      fid: number,
      walletAddress: string
    ) => {
      console.log("🏭 [CreateBrand] Starting brand creation on-chain", {
        handle,
        metadataHash,
        fid,
        walletAddress,
      });
      setError(null);
      await switchToBase();

      if (!userAddress) {
        setError("Wallet not connected");
        throw new Error("Wallet not connected");
      }

      // Validate inputs
      if (!handle || handle.trim() === "") {
        setError("Brand handle is required");
        throw new Error("Brand handle is required");
      }

      if (!metadataHash || metadataHash.trim() === "") {
        setError("Metadata hash (IPFS) is required");
        throw new Error("Metadata hash (IPFS) is required");
      }

      if (!fid || fid <= 0) {
        setError("Valid FID is required");
        throw new Error("Valid FID is required");
      }

      // Validate wallet address format
      if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setError("Invalid wallet address format");
        throw new Error("Invalid wallet address format");
      }

      try {
        setLastOperation("createBrand");
        setPendingBrandCreateData({
          handle,
          metadataHash,
          fid,
          walletAddress,
        });

        console.log("📤 [CreateBrand] Sending transaction to contract", {
          contract: BRND_SEASON_2_CONFIG.CONTRACT,
          handle,
          metadataHash,
          fid,
          walletAddress,
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });

        // Ensure proper type casting
        const result = await writeContract({
          address: BRND_SEASON_2_CONFIG.CONTRACT as `0x${string}`,
          abi: BRND_SEASON_2_CONFIG_ABI,
          functionName: "createBrand",
          args: [
            handle,
            metadataHash,
            BigInt(fid),
            walletAddress as `0x${string}`,
          ],
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });

        console.log(
          "✅ [CreateBrand] Brand creation transaction submitted successfully",
          { result }
        );

        return result;
      } catch (error: any) {
        console.error("❌ [CreateBrand] Transaction failed:", error);
        console.error("❌ [CreateBrand] Error details:", {
          message: error.message,
          cause: error.cause,
          stack: error.stack,
        });
        setError(error.message || "Brand creation failed");
        setPendingBrandCreateData(null);
        throw error;
      }
    },
    [userAddress, switchToBase, writeContract]
  );

  // Verify share and get claim signature (does not execute transaction)
  const verifyShareAndGetClaimSignature = useCallback(
    async (castHash: string, voteId: string, transactionHash?: string) => {
      setError(null);

      if (!userAddress || !userFid) {
        throw new Error("Wallet not authorized");
      }

      if (!castHash || castHash.trim() === "") {
        throw new Error("Cast hash is required to claim reward");
      }

      if (!voteId || voteId.trim() === "") {
        throw new Error("Vote ID is required to claim reward");
      }

      console.log(
        "🔐 [ClaimReward] Verifying share and getting claim signature",
        {
          castHash,
          voteId,
          recipientAddress: userAddress,
          transactionHash,
        }
      );

      const verifyData = await getClaimRewardSignature(
        castHash,
        voteId,
        userAddress,
        transactionHash
      );

      console.log("📥 [ClaimReward] Received verify-share response", {
        verified: verifyData.verified,
        hasClaimSignature: !!verifyData.claimSignature,
        day: verifyData.day,
        amount: verifyData.claimSignature?.amount,
      });

      if (!verifyData.verified) {
        throw new Error("Share verification failed");
      }

      if (!verifyData.claimSignature) {
        throw new Error(
          "Claim signature not generated. Please ensure recipientAddress was provided."
        );
      }

      return {
        claimSignature: verifyData.claimSignature,
        day: verifyData.day,
        amount: verifyData.claimSignature.amount,
      };
    },
    [userAddress, userFid, getClaimRewardSignature]
  );

  // Get claim signature for already shared vote (without castHash)
  // Note: voteId is always a UUID string from the vote data
  const getClaimSignatureForSharedVoteWrapper = useCallback(
    async (voteId: string, transactionHash?: string) => {
      setError(null);

      if (!userAddress || !userFid) {
        throw new Error("Wallet not authorized");
      }

      if (!voteId || voteId.trim() === "") {
        throw new Error("Vote ID is required to claim reward");
      }

      console.log(
        "🔐 [ClaimReward] Getting claim signature for already shared vote",
        {
          voteId, // UUID string (e.g., "6f8ab718-a65d-4f12-aee5-c3e8ce74f8b7")
          recipientAddress: userAddress,
          transactionHash,
        }
      );

      const verifyData = await getClaimSignatureForSharedVote(
        voteId,
        userAddress,
        transactionHash
      );

      console.log("📥 [ClaimReward] Received claim signature for shared vote", {
        verified: verifyData.verified,
        hasClaimSignature: !!verifyData.claimSignature,
        day: verifyData.day,
        amount: verifyData.claimSignature?.amount,
        castHash: verifyData.castHash,
      });

      if (!verifyData.claimSignature) {
        throw new Error(
          "Claim signature not available. Please ensure the vote was shared and verified."
        );
      }

      return {
        claimSignature: verifyData.claimSignature,
        day: verifyData.day,
        amount: verifyData.claimSignature.amount,
        castHash: verifyData.castHash || "", // Backend may return castHash for already shared votes
      };
    },
    [userAddress, userFid, getClaimSignatureForSharedVote]
  );

  // Execute claim reward transaction (after verification)
  const executeClaimReward = useCallback(
    async (
      castHash: string,
      claimSignature: {
        signature: string;
        amount: string;
        deadline: number;
        nonce: number;
        canClaim: boolean;
      },
      day: number
    ) => {
      console.log(
        `🔐 [ClaimReward] ===== STARTING CLAIM REWARD EXECUTION =====`
      );
      console.log(`💰 [ClaimReward] Input Parameters:`);
      console.log(`   - castHash: ${castHash}`);
      console.log(`   - signature: ${claimSignature.signature}`);
      console.log(`   - signature length: ${claimSignature.signature.length}`);
      console.log(`   - amount: ${claimSignature.amount}`);
      console.log(`   - amount type: ${typeof claimSignature.amount}`);
      console.log(`   - deadline: ${claimSignature.deadline}`);
      console.log(
        `   - deadline (readable): ${new Date(
          claimSignature.deadline * 1000
        ).toISOString()}`
      );
      console.log(`   - nonce: ${claimSignature.nonce}`);
      console.log(`   - day: ${day}`);
      console.log(`   - recipient (userAddress): ${userAddress}`);
      console.log(`   - fid: ${userFid}`);

      setError(null);
      await switchToBase();

      if (!userAddress || !userFid) {
        setError("Wallet not authorized");
        return;
      }

      // Log current block timestamp to check if deadline has passed
      console.log(
        `⏰ [ClaimReward] Current timestamp: ${Math.floor(Date.now() / 1000)}`
      );
      console.log(
        `⏰ [ClaimReward] Deadline timestamp: ${claimSignature.deadline}`
      );
      console.log(
        `⏰ [ClaimReward] Time until deadline: ${
          claimSignature.deadline - Math.floor(Date.now() / 1000)
        }s`
      );

      try {
        setLastOperation("claimReward");

        console.log("📝 [ClaimReward] Contract call arguments:");
        const args = [
          userAddress, // recipient
          claimSignature.amount, // amount
          userFid, // fid
          day, // day
          castHash, // castHash
          claimSignature.deadline, // deadline
          claimSignature.signature, // signature
        ];

        args.forEach((arg, index) => {
          const paramNames = [
            "recipient",
            "amount",
            "fid",
            "day",
            "castHash",
            "deadline",
            "signature",
          ];
          console.log(
            `   [${index}] ${paramNames[index]}: ${arg} (${typeof arg})`
          );
        });

        console.log(
          `📤 [ClaimReward] Sending transaction to contract: ${BRND_SEASON_2_CONFIG.CONTRACT}`
        );
        console.log(
          `📤 [ClaimReward] Chain ID: ${BRND_SEASON_2_CONFIG.CHAIN_ID}`
        );

        await writeContract({
          address: BRND_SEASON_2_CONFIG.CONTRACT,
          abi: BRND_SEASON_2_CONFIG_ABI,
          functionName: "claimReward",
          args,
          chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
        });

        console.log("✅ [ClaimReward] Transaction submitted successfully");
        console.log(
          `🔐 [ClaimReward] ===== CLAIM REWARD EXECUTION COMPLETE =====`
        );
      } catch (error: any) {
        console.error("❌ [ClaimReward] Transaction failed");
        console.error("❌ [ClaimReward] Error:", error);
        console.error("❌ [ClaimReward] Error message:", error.message);
        console.error(
          "❌ [ClaimReward] Error details:",
          JSON.stringify(error, null, 2)
        );

        // Try to parse revert reason if available
        if (error.message) {
          const revertMatch = error.message.match(/revert reason: (.+)/i);
          if (revertMatch) {
            console.error("❌ [ClaimReward] Revert reason:", revertMatch[1]);
          }
        }

        setError(error.message || "Claim reward failed");
        throw error;
      }
    },
    [userAddress, userFid, switchToBase, writeContract]
  );

  // Claim reward with signature (legacy - combines verification and execution)
  // Contract signature: claimReward(address recipient, uint256 amount, uint256 fid, uint256 day, string castHash, uint256 deadline, bytes signature)
  const claimReward = useCallback(
    async (castHash: string, voteId: string, transactionHash?: string) => {
      try {
        const { claimSignature, day } = await verifyShareAndGetClaimSignature(
          castHash,
          voteId,
          transactionHash
        );
        await executeClaimReward(castHash, claimSignature, day);
      } catch (error: any) {
        console.error("❌ [ClaimReward] Claim reward failed:", error);
        setError(error.message || "Claim reward failed");
        throw error;
      }
    },
    [verifyShareAndGetClaimSignature, executeClaimReward]
  );

  // Handle transaction errors - clear operation state on error
  useEffect(() => {
    if (writeError && lastOperation) {
      console.error("❌ [Transaction] Transaction failed", {
        operation: lastOperation,
        error: writeError.message,
      });
      // Clear the operation state so isApproving/isVoting become false
      // This allows the UI to show error state instead of "Approval Complete"
      setLastOperation(null);
      setError(writeError.message || "Transaction failed");
      // Clear pending vote data on error
      setPendingVoteBrandIds(null);
      setPendingVoteAuthData(null);
    }
  }, [writeError, lastOperation]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && receipt && lastOperation) {
      console.log("🎉 [Transaction] Transaction confirmed", {
        operation: lastOperation,
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
      });
      const txData = {
        txHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        operation: lastOperation,
      };

      // Refresh data
      refetchUserInfo();
      refetchBrndBalance();
      refetchAllowance();
      refetchVotedToday();

      // Call appropriate success callback
      switch (lastOperation) {
        // Note: "authorize" case removed - authorization now happens automatically inside vote() and levelUpBrndPower()
        case "levelup":
          onLevelUpSuccess?.(txData);
          break;
        case "approve":
          console.log("✅ [Approve] Approval transaction confirmed", {
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
          // After approval, automatically retry voting if brand IDs are available
          if (pendingVoteBrandIds) {
            console.log("🔄 [Approve] Auto-retrying vote after approval", {
              brandIds: pendingVoteBrandIds,
              hasPendingAuthData: !!pendingVoteAuthData,
            });
            // Wait a bit for allowance to update, then retry vote
            setTimeout(async () => {
              try {
                console.log("🔄 [Approve] Refreshing allowance...");
                // Refresh allowance first
                await refetchAllowance();
                console.log("✅ [Approve] Allowance refreshed");

                // Use stored authData or prepare new one if needed
                let authDataToUse = pendingVoteAuthData || "0x";
                console.log("🔍 [Approve] Checking authData", {
                  hasStoredAuthData: !!pendingVoteAuthData,
                  isWalletAuthorized,
                  authDataToUse: authDataToUse !== "0x" ? "present" : "empty",
                });

                // If wallet is not authorized and we don't have authData, prepare it
                if (
                  !isWalletAuthorized &&
                  (!authDataToUse || authDataToUse === "0x")
                ) {
                  console.log(
                    "🔐 [Approve] Wallet not authorized, preparing vote-specific authData..."
                  );
                  if (userFid && pendingVoteBrandIds) {
                    const deadline = Math.floor(Date.now() / 1000) + 3600;
                    console.log(
                      "📝 [Approve] Requesting vote authorization signature",
                      {
                        userFid,
                        brandIds: pendingVoteBrandIds,
                        deadline,
                      }
                    );
                    const voteAuth = await getVoteAuthorizationSignature(
                      pendingVoteBrandIds,
                      deadline
                    );
                    console.log(
                      "📥 [Approve] Received vote authorization response",
                      {
                        hasAuthData: !!voteAuth.authData,
                        message: voteAuth.message,
                      }
                    );

                    if (!voteAuth.authData) {
                      console.error(
                        "❌ [Approve] Failed to get vote authorization signature from backend"
                      );
                      throw new Error(
                        "Failed to get vote authorization signature from backend"
                      );
                    }

                    // Use the authData directly (it's already properly encoded)
                    authDataToUse = voteAuth.authData;
                    console.log(
                      "✅ [Approve] Vote authorization data prepared",
                      {
                        authDataLength: authDataToUse.length,
                      }
                    );
                  }
                }

                // Retry vote with stored brand IDs and authData
                console.log("📤 [Approve] Initiating vote transaction...", {
                  brandIds: pendingVoteBrandIds,
                  hasAuthData: authDataToUse !== "0x",
                });
                setLastOperation("vote");
                await writeContract({
                  address: BRND_SEASON_2_CONFIG.CONTRACT,
                  abi: BRND_SEASON_2_CONFIG_ABI,
                  functionName: "vote",
                  args: [pendingVoteBrandIds, authDataToUse],
                  chainId: BRND_SEASON_2_CONFIG.CHAIN_ID,
                });
                console.log(
                  "✅ [Approve] Vote transaction submitted after approval"
                );

                setPendingVoteBrandIds(null);
                setPendingVoteAuthData(null);
                console.log("🧹 [Approve] Cleared pending vote data");
              } catch (error) {
                console.error(
                  "❌ [Approve] Auto-retry vote after approval failed:",
                  error
                );
                console.error("❌ [Approve] Error details:", {
                  message: (error as any).message,
                  stack: (error as any).stack,
                });
                setPendingVoteBrandIds(null);
                setPendingVoteAuthData(null);
              }
            }, 1000);
          } else {
            console.log(
              "⚠️ [Approve] No pending vote brand IDs, skipping auto-retry"
            );
          }
          break;
        case "vote":
          console.log("✅ [Vote] Vote transaction confirmed", {
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
          });
          // Clear pending vote data on successful vote
          setPendingVoteBrandIds(null);
          setPendingVoteAuthData(null);
          console.log("🧹 [Vote] Cleared pending vote data");
          onVoteSuccess?.(txData);
          break;
        case "claimReward":
          onClaimSuccess?.(txData);
          break;
        case "createBrand":
          console.log("✅ [CreateBrand] Brand creation transaction confirmed", {
            txHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
            brandData: pendingBrandCreateData,
          });
          // Extract brandId from event logs if available
          const brandCreatedEvent = receipt.logs?.find((log: any) => {
            // Try to decode BrandCreated event
            try {
              // Event signature: BrandCreated(uint16 indexed brandId, string handle, uint256 fid, address walletAddress, uint256 createdAt)
              return log.topics && log.topics.length > 0;
            } catch {
              return false;
            }
          });
          const brandCreateTxData = {
            ...txData,
            brandData: pendingBrandCreateData,
            event: brandCreatedEvent,
          };
          setPendingBrandCreateData(null);
          onBrandCreateSuccess?.(brandCreateTxData);
          break;
      }

      setLastOperation(null);
    }
  }, [
    isConfirmed,
    receipt,
    lastOperation,
    pendingVoteBrandIds,
    pendingVoteAuthData,
    isWalletAuthorized,
    userFid,
    getAuthorizationSignature,
    getVoteAuthorizationSignature,
    writeContract,
    onLevelUpSuccess,
    onVoteSuccess,
    onClaimSuccess,
    onBrandCreateSuccess,
    pendingBrandCreateData,
    refetchUserInfo,
    refetchBrndBalance,
    refetchAllowance,
    refetchVotedToday,
  ]);

  // Parse user info
  const parsedUserInfo: UserInfo | null = userInfo
    ? {
        fid: Number((userInfo as any)[0]),
        brndPowerLevel: Number((userInfo as any)[1]),
        lastVoteDay: Number((userInfo as any)[2]),
        totalVotes: Number((userInfo as any)[3]),
      }
    : null;

  // Update authorization status based on contract data
  // Check if the wallet is authorized by comparing FID from auth context with contract
  useEffect(() => {
    const fidFromContract = authorizedFid ? Number(authorizedFid) : 0;
    const fidFromUserInfo = parsedUserInfo?.fid || 0;
    const fidFromAuth = userFid || 0;

    // Wallet is authorized if contract has a FID that matches the auth context FID
    if (fidFromContract > 0 && fidFromContract === fidFromAuth) {
      setIsWalletAuthorized(true);
    } else if (fidFromUserInfo > 0 && fidFromUserInfo === fidFromAuth) {
      setIsWalletAuthorized(true);
    } else if (fidFromAuth > 0) {
      // User is authenticated but wallet not yet authorized
      setIsWalletAuthorized(false);
    } else {
      setIsWalletAuthorized(false);
    }
  }, [authorizedFid, parsedUserInfo, userFid]);

  return {
    // Connection state
    userAddress,
    isConnected,
    isCorrectNetwork,
    isWalletAuthorized,
    userFid,

    // Contract state
    userInfo: parsedUserInfo,
    brndBalance: brndBalance ? formatUnits(brndBalance as bigint, 18) : "0",
    brndAllowance: brndAllowance
      ? formatUnits(brndAllowance as bigint, 18)
      : "0",
    hasVotedToday: Boolean(hasVotedToday),

    // Transaction state
    isPending: isWritePending,
    isConfirming,
    isConfirmed,
    hash,
    receipt,
    error: error || (writeError ? writeError.message : null),
    isApproving: lastOperation === "approve",
    isVoting: lastOperation === "vote",
    isCreatingBrand: lastOperation === "createBrand",

    // Loading states
    isLoadingUserInfo,
    isLoadingBrndBalance,

    // Actions
    switchToBase,
    // Note: authorizeWallet removed - authorization happens automatically in vote() and levelUpBrndPower()
    levelUpBrndPower,
    vote,
    claimReward,
    verifyShareAndGetClaimSignature,
    getClaimSignatureForSharedVote: getClaimSignatureForSharedVoteWrapper,
    executeClaimReward,
    getVoteCost,
    getRewardAmount,
    getBrand,
    createBrandOnChain,

    // Backend integration
    getPowerLevelInfo,
    getStakeInfo,
    getVoteAuthorizationSignature,

    // Refresh functions
    refreshData: () => {
      refetchUserInfo();
      refetchBrndBalance();
      refetchAllowance();
      refetchVotedToday();
    },
  };
};
