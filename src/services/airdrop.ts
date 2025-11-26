// Dependencies
import { request } from "./api";

// Types
export interface AirdropClaimStatusResponse {
  success: true;
  data: {
    fid: number;
    canClaim: boolean;
    reason: string;
    hasClaimed: boolean;
    contractStatus: {
      merkleRootSet: boolean;
      claimingEnabled: boolean;
      totalClaimed: string;
      escrowBalance: string;
      allowance: string;
    };
    eligibility: {
      inSnapshot: boolean;
      amount: string | null;
    };
  };
}

export interface AirdropSignatureResponse {
  success: true;
  data: {
    fid: number;
    walletAddress: string;
    amount: string;
    merkleRoot: string;
    proof: string[];
    signature: string;
    deadline: number;
    snapshotId: number;
    contractAddress: string;
    message: string;
  };
}

export interface AirdropErrorResponse {
  success: false;
  error: string;
}

export type AirdropApiResponse =
  | AirdropClaimStatusResponse
  | AirdropErrorResponse;
export type AirdropSignatureApiResponse =
  | AirdropSignatureResponse
  | AirdropErrorResponse;

/**
 * Check user's airdrop claim status and eligibility
 */
export const checkClaimStatus =
  async (): Promise<AirdropClaimStatusResponse> => {
    try {
      console.log("📊 [checkClaimStatus] Requesting claim status...");

      const response = await request<AirdropClaimStatusResponse>(
        "/airdrop-service/claim-status",
        {
          method: "GET",
        }
      );

      console.log("✅ [checkClaimStatus] Response received:", response);
      console.log("🔍 [checkClaimStatus] Response structure:", {
        hasSuccess: "success" in response,
        success: (response as any).success,
        hasData: "data" in response,
        dataKeys: (response as any).data
          ? Object.keys((response as any).data)
          : "no data",
        canClaim: (response as any).data?.canClaim,
        hasClaimed: (response as any).data?.hasClaimed,
        amount: (response as any).data?.eligibility?.amount,
      });

      return response;
    } catch (error: any) {
      console.error(
        "❌ [checkClaimStatus] Error checking claim status:",
        error
      );
      console.error("❌ [checkClaimStatus] Error details:", {
        message: error?.message,
        stack: error?.stack,
        response: error?.response,
      });
      throw error;
    }
  };

/**
 * Get claim signature and proof for user
 */
export const getClaimSignature = async (
  walletAddress: string,
  snapshotId?: number
): Promise<AirdropSignatureResponse> => {
  try {
    console.log("🔐 [getClaimSignature] Requesting claim signature...", {
      walletAddress,
      snapshotId,
    });

    const response = await request<AirdropSignatureResponse>(
      "/airdrop-service/claim-signature",
      {
        method: "POST",
        body: {
          walletAddress,
          ...(snapshotId && { snapshotId }),
        },
      }
    );

    console.log("✅ [getClaimSignature] Response received:", response);
    console.log("🔍 [getClaimSignature] Response structure:", {
      hasSuccess: "success" in response,
      success: (response as any).success,
      hasData: "data" in response,
      dataKeys: (response as any).data
        ? Object.keys((response as any).data)
        : "no data",
      directKeys: Object.keys(response),
      responseType: typeof response,
      isArray: Array.isArray(response),
    });

    // Handle case where response might be the data directly or wrapped
    if ((response as any).success === false) {
      const errorResponse = response as unknown as AirdropErrorResponse;
      console.error(
        "❌ [getClaimSignature] Error response:",
        errorResponse.error
      );
      throw new Error(errorResponse.error || "Failed to get claim signature");
    }

    // Check if response has the expected structure
    if (!(response as any).data && !(response as any).fid) {
      console.error(
        "❌ [getClaimSignature] Unexpected response structure:",
        response
      );
      throw new Error(
        "Invalid response structure from claim signature endpoint"
      );
    }

    // If response doesn't have data property but has the fields directly, wrap it
    if (!(response as any).data && (response as any).fid) {
      console.warn(
        "⚠️ [getClaimSignature] Response missing 'data' wrapper, wrapping..."
      );
      return {
        success: true,
        data: response as any,
      } as AirdropSignatureResponse;
    }

    return response;
  } catch (error: any) {
    console.error(
      "❌ [getClaimSignature] Error getting claim signature:",
      error
    );
    console.error("❌ [getClaimSignature] Error details:", {
      message: error?.message,
      stack: error?.stack,
      response: error?.response,
    });
    throw error;
  }
};
