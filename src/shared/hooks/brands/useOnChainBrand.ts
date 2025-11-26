// src/shared/hooks/brands/useOnChainBrand.ts
import { useState, useCallback, useEffect } from "react";
import { useBlockchain } from "@/shared/contexts/BlockchainContext";
import { OnChainBrand } from "./types";
import { formatUnits } from "viem";

export const useOnChainBrand = (brandId: number) => {
  const [brandData, setBrandData] = useState<OnChainBrand | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { getBrand } = useBlockchain();

  const fetchBrandData = useCallback(async () => {
    if (!brandId || brandId <= 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rawBrandData = await getBrand(brandId);
      
      if (!rawBrandData) {
        throw new Error("Brand not found");
      }

      // Parse the contract response to OnChainBrand format
      const parsedBrand: OnChainBrand = {
        fid: Number(rawBrandData[0]),
        walletAddress: rawBrandData[1] as string,
        totalBrndAwarded: formatUnits(rawBrandData[2] as bigint, 18),
        availableBrnd: formatUnits(rawBrandData[3] as bigint, 18),
        handle: rawBrandData[4] as string,
        metadataHash: rawBrandData[5] as string,
        createdAt: Number(rawBrandData[6]),
      };

      setBrandData(parsedBrand);
    } catch (err: any) {
      console.error("Failed to fetch on-chain brand data:", err);
      setError(err.message || "Failed to fetch brand data");
    } finally {
      setIsLoading(false);
    }
  }, [brandId, getBrand]);

  // Fetch data when brandId changes
  useEffect(() => {
    fetchBrandData();
  }, [fetchBrandData]);

  return {
    brandData,
    isLoading,
    error,
    refetch: fetchBrandData,
  };
};

export default useOnChainBrand;