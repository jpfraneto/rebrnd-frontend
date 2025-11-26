// src/pages/AdminPage/index.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// StyleSheet
import styles from "./AdminPage.module.scss";

// Components
import AppLayout from "@/shared/layouts/AppLayout";
import Typography from "@/components/Typography";
import Button from "@/shared/components/Button";

import {
  fixWeeklyScores,
  prepareBrandMetadata,
  takeAirdropSnapshotAndCreateMerkleRoot,
} from "@/services/admin";

// Hooks
import { useAuth } from "@/hooks/auth";
import { Brand, useBrandList } from "@/hooks/brands";
import { useStoriesInMotion } from "@/shared/hooks/contract/useStoriesInMotion";
import { useAccount } from "wagmi";

// Services
import { updateBrand } from "@/services/admin";

// Simple Admin Brand List Component
interface AdminBrandsListProps {
  onBrandSelect: (brand: Brand) => void;
}

function AdminBrandsList({ onBrandSelect }: AdminBrandsListProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pageId, setPageId] = useState<number>(1);

  const { data, isLoading, isFetching, refetch } = useBrandList(
    "all",
    searchQuery,
    pageId,
    50,
    "all"
  );

  useEffect(() => {
    refetch();
  }, [pageId, searchQuery, refetch]);

  useEffect(() => {
    setPageId(1);
  }, [searchQuery]);

  const handleScrollList = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const calc = scrollTop + clientHeight + 50;
    if (calc >= scrollHeight && !isFetching && data) {
      if (data.brands.length < data.count) {
        setPageId((prev) => prev + 1);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Typography size={16} variant="druk" weight="wide">
          Loading brands...
        </Typography>
      </div>
    );
  }

  if (!data || data.brands.length === 0) {
    return (
      <div className={styles.loadingState}>
        <Typography size={16} variant="druk" weight="wide">
          No brands found
        </Typography>
      </div>
    );
  }

  return (
    <div className={styles.adminBrandsContainer}>
      {/* Search Input */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search brands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Brands List */}
      <div className={styles.adminBrandsList} onScroll={handleScrollList}>
        {data.brands.map((brand: Brand) => (
          <div
            key={brand.id}
            className={styles.adminBrandItem}
            onClick={() => onBrandSelect(brand)}
          >
            <div className={styles.brandImage}>
              {brand.imageUrl ? (
                <img src={brand.imageUrl} alt={brand.name} />
              ) : (
                <div className={styles.placeholderImage}>
                  {brand.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className={styles.brandInfo}>
              <Typography size={16} weight="bold">
                {brand.name}
              </Typography>
              <Typography size={12} className={styles.brandUrl}>
                {brand.url}
              </Typography>
              <Typography size={12} className={styles.brandMeta}>
                Score: {brand.score} | Type:{" "}
                {brand.queryType === 0 ? "Channel" : "Profile"}
                {brand.queryType === 0 &&
                  brand.channel &&
                  ` | ${brand.channel}`}
                {brand.queryType === 1 &&
                  brand.profile &&
                  ` | ${brand.profile}`}
              </Typography>
            </div>
            <div className={styles.editIndicator}>
              <Typography size={12} variant="druk" weight="wide">
                ✏️ Edit
              </Typography>
            </div>
          </div>
        ))}

        {/* Loading more indicator */}
        {isFetching && pageId > 1 && (
          <div className={styles.loadingMore}>
            <Typography size={12} variant="druk" weight="wide">
              Loading more...
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}

// Types
interface BrandFormData {
  name: string;
  url: string;
  description: string;
  imageUrl: string;
  queryType: number;
  channelOrProfile: string;
  categoryId: number;
  followerCount: number;
  profile: string;
  channel: string;
  warpcastUrl?: string;
  handle?: string; // Brand handle (derived from channelOrProfile or custom)
  fid?: number; // FID of the brand owner
  walletAddress?: string; // Wallet address of the brand owner
}

type AdminStep = "menu" | "form" | "confirm" | "success";

function AdminPage(): React.ReactNode {
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { address: walletAddress, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState<AdminStep>("menu");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [successBrandId, setSuccessBrandId] = useState<number | null>(null);
  const [isFixingScores, setIsFixingScores] = useState<boolean>(false);
  const [isPreparingMetadata, setIsPreparingMetadata] =
    useState<boolean>(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState<boolean>(false);

  // Use StoriesInMotion hook for on-chain brand creation
  const {
    createBrandOnChain,
    isCreatingBrand,
    isPending,
    isConfirming,
    error: contractError,
  } = useStoriesInMotion(
    undefined, // onAuthorizeSuccess
    undefined, // onLevelUpSuccess
    undefined, // onVoteSuccess
    undefined, // onClaimSuccess
    (txData) => {
      // onBrandCreateSuccess
      console.log("✅ Brand created on-chain successfully!", txData);
      // Extract brandId from transaction if possible
      // For now, we'll show success and let user navigate
      setCurrentStep("success");
    }
  );

  const [formData, setFormData] = useState<BrandFormData>({
    name: "",
    url: "",
    description: "",
    imageUrl: "",
    queryType: 0, // 0 = Channel, 1 = Profile
    channelOrProfile: "",
    categoryId: 1,
    followerCount: 0,
    profile: "",
    channel: "",
    warpcastUrl: "",
    handle: "", // Will be derived from channelOrProfile
    fid: user?.fid ? Number(user.fid) : undefined, // Default to current user's FID
    walletAddress: walletAddress || undefined, // Default to connected wallet
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Update formData when user or walletAddress becomes available
  useEffect(() => {
    if (user?.fid && !formData.fid) {
      setFormData((prev) => ({
        ...prev,
        fid: Number(user.fid),
      }));
    }
    if (walletAddress && !formData.walletAddress) {
      setFormData((prev) => ({
        ...prev,
        walletAddress: walletAddress,
      }));
    }
  }, [user?.fid, walletAddress]);

  // Check admin permissions
  const adminFids = [5431, 16098];
  const isAdmin = user?.fid && adminFids.includes(Number(user.fid));

  if (!isAdmin) {
    navigate("/profile");
    return null;
  }

  const handleTakeAirdropSnapshot = async () => {
    setIsTakingSnapshot(true);
    try {
      const result = await takeAirdropSnapshotAndCreateMerkleRoot();
      alert(
        `Airdrop snapshot created successfully! ${
          result.message || JSON.stringify(result)
        }`
      );
    } catch (error: any) {
      console.error("Error taking airdrop snapshot:", error);
      alert(
        `Failed to take airdrop snapshot: ${
          error.message || "Please try again."
        }`
      );
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const handleFixWeeklyScores = async () => {
    setIsFixingScores(true);
    try {
      const result = await fixWeeklyScores();
      alert(
        `Weekly scores fixed successfully! Updated ${
          result.updatedBrands || "all"
        } brands.`
      );
    } catch (error) {
      console.error("Error fixing weekly scores:", error);
      alert("Failed to fix weekly scores. Please try again.");
    } finally {
      setIsFixingScores(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      url: "",
      description: "",
      imageUrl: "",
      queryType: 0,
      channelOrProfile: "",
      categoryId: 1,
      followerCount: 0,
      profile: "",
      channel: "",
      warpcastUrl: "",
      handle: "",
      fid: user?.fid ? Number(user.fid) : undefined,
      walletAddress: walletAddress || undefined,
    });
    setSelectedBrand(null);
    setIsEditing(false);
    setErrors({});
    setSuccessBrandId(null);
  };

  const goToMenu = () => {
    setCurrentStep("menu");
    resetForm();
  };

  const goToBrand = () => {
    if (successBrandId && successBrandId > 0) {
      navigate(`/brand/${successBrandId}`);
    } else {
      alert(
        "Brand ID not available. Please go back to the admin panel and search for the brand."
      );
    }
  };

  // Start adding a new brand
  const startAddBrand = () => {
    resetForm();
    setIsEditing(false);
    setCurrentStep("form");
  };

  // Start editing an existing brand
  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    setIsEditing(true);

    // Pre-populate fields from the existing brand data
    setFormData({
      name: brand.name || "",
      url: brand.url || "",
      description: brand.description || "",
      imageUrl: brand.imageUrl || "",
      queryType: brand.queryType ?? 0,
      channelOrProfile:
        brand.queryType === 0 ? brand.channel || "" : brand.profile || "",
      categoryId: 1,
      followerCount: 0,
      profile: "",
      channel: "",
      warpcastUrl: "",
    });
    setErrors({});
    setCurrentStep("form");
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]:
          name === "queryType" || name === "fid" || name === "categoryId"
            ? parseInt(value) || 0
            : value,
      };

      // Auto-update handle when channelOrProfile changes
      if (name === "channelOrProfile") {
        updated.handle = value.trim().toLowerCase();
      }

      return updated;
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: false,
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};

    if (!formData.name.trim()) {
      newErrors.name = true;
    }
    if (!formData.url.trim()) {
      newErrors.url = true;
    }
    if (!formData.description.trim()) {
      newErrors.description = true;
    }
    if (!formData.channelOrProfile.trim()) {
      newErrors.channelOrProfile = true;
    }

    // Only validate on-chain fields when creating new brand (not editing)
    if (!isEditing) {
      if (!formData.handle || !formData.handle.trim()) {
        newErrors.handle = true;
      }
      if (!formData.fid || formData.fid <= 0) {
        newErrors.fid = true;
      }
      if (!formData.walletAddress) {
        newErrors.walletAddress = true;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const proceedToConfirm = () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setCurrentStep("confirm");
  };

  const handleFinalSubmit = async () => {
    if (!isConnected || !walletAddress) {
      alert("Please connect your wallet to create a brand on-chain.");
      return;
    }

    try {
      if (isEditing && selectedBrand) {
        // For editing, use the legacy update flow
        const submitData: BrandFormData = {
          name: formData.name,
          url: formData.url,
          warpcastUrl: formData.url,
          description: formData.description,
          imageUrl: formData.imageUrl,
          categoryId: 1,
          followerCount: 0,
          queryType: formData.queryType,
          channelOrProfile: formData.channelOrProfile,
          profile: formData.profile,
          channel: formData.channel,
        };

        await updateBrand(selectedBrand.id, submitData);
        setSuccessBrandId(selectedBrand.id);
        setCurrentStep("success");
      } else {
        // For new brands, use the on-chain flow
        setIsPreparingMetadata(true);

        // Step 1: Prepare metadata and upload to IPFS via backend
        const submitData: BrandFormData = {
          name: formData.name,
          url: formData.url,
          warpcastUrl: formData.url,
          description: formData.description,
          imageUrl: formData.imageUrl,
          categoryId: 1,
          followerCount: 0,
          queryType: formData.queryType,
          channelOrProfile: formData.channelOrProfile,
          profile: formData.profile,
          channel: formData.channel,
          handle:
            formData.handle || formData.channelOrProfile.trim().toLowerCase(),
          fid: formData.fid || (user?.fid ? Number(user.fid) : 0),
          walletAddress: formData.walletAddress || walletAddress,
        };

        console.log("📤 [Admin] Preparing brand metadata...", submitData);
        const metadataResult = await prepareBrandMetadata(submitData);
        console.log("✅ [Admin] Metadata prepared:", metadataResult);

        setIsPreparingMetadata(false);

        // Step 2: Create brand on-chain with IPFS hash
        if (!metadataResult.metadataHash) {
          throw new Error("Failed to get IPFS hash from backend");
        }

        const handle =
          metadataResult.handle ||
          submitData.handle ||
          submitData.channelOrProfile.trim().toLowerCase();
        const fid =
          metadataResult.fid ||
          submitData.fid ||
          (user?.fid ? Number(user.fid) : 0);
        const brandWalletAddress =
          metadataResult.walletAddress ||
          submitData.walletAddress ||
          walletAddress;

        console.log("📤 [Admin] Creating brand on-chain...", {
          handle,
          metadataHash: metadataResult.metadataHash,
          fid,
          walletAddress: brandWalletAddress,
        });

        await createBrandOnChain(
          handle,
          metadataResult.metadataHash,
          fid,
          brandWalletAddress
        );

        // Success will be handled by onBrandCreateSuccess callback
        // which will set currentStep to "success"
      }
    } catch (error: any) {
      console.error("❌ [Admin] Error:", error);
      setIsPreparingMetadata(false);
      alert(error.message || "Something went wrong. Please try again.");
    }
  };

  // MENU SCREEN
  if (currentStep === "menu") {
    return (
      <AppLayout>
        <div className={styles.screen}>
          <div className={styles.header}>
            <Typography size={24} weight="bold">
              Admin Panel
            </Typography>
            <Button
              caption="← Profile"
              variant="secondary"
              onClick={() => navigate("/profile")}
            />
          </div>

          <div className={styles.menuActions}>
            <Button
              caption={
                isTakingSnapshot
                  ? "⏳ Creating Snapshot..."
                  : "📸 AIRDROP SNAPSHOT"
              }
              variant="primary"
              onClick={handleTakeAirdropSnapshot}
              className={styles.bigButton}
              disabled={isTakingSnapshot}
            />
            <Button
              caption="➕ Add New Brand"
              variant="primary"
              onClick={startAddBrand}
              className={styles.bigButton}
            />

            <Button
              caption={isFixingScores ? "⏳ Fixing..." : "🔧 Fix Weekly Scores"}
              variant="secondary"
              onClick={handleFixWeeklyScores}
              disabled={isFixingScores}
              className={styles.bigButton}
            />

            <div className={styles.divider}>
              <Typography size={14} variant="druk" weight="wide">
                OR
              </Typography>
            </div>

            <Typography
              size={16}
              weight="medium"
              className={styles.instruction}
            >
              👇 Tap any brand below to edit it
            </Typography>
          </div>

          <div className={styles.brandsSection}>
            <AdminBrandsList onBrandSelect={handleBrandSelect} />
          </div>
        </div>
      </AppLayout>
    );
  }

  // FORM MODAL (Add or Edit)
  if (currentStep === "form") {
    return (
      <AppLayout>
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <Typography size={20} weight="bold">
                {isEditing ? `Edit: ${selectedBrand?.name}` : "Add New Brand"}
              </Typography>
              <Button
                caption="✕ Cancel"
                variant="secondary"
                onClick={goToMenu}
              />
            </div>

            <div className={styles.form}>
              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  Brand Name *
                </Typography>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Nike"
                  className={`${styles.input} ${
                    errors.name ? styles.inputError : ""
                  }`}
                  required
                />
                {errors.name && (
                  <Typography size={12} className={styles.errorText}>
                    Brand name is required
                  </Typography>
                )}
              </div>

              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  Website *
                </Typography>
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  className={`${styles.input} ${
                    errors.url ? styles.inputError : ""
                  }`}
                  required
                />
                {errors.url && (
                  <Typography size={12} className={styles.errorText}>
                    Website URL is required
                  </Typography>
                )}
              </div>

              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  Description *
                </Typography>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of what this brand does..."
                  className={`${styles.textarea} ${
                    errors.description ? styles.inputError : ""
                  }`}
                  rows={3}
                  required
                />
                {errors.description && (
                  <Typography size={12} className={styles.errorText}>
                    Description is required
                  </Typography>
                )}
              </div>

              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  Logo Image URL
                </Typography>
                <input
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/logo.png"
                  className={styles.input}
                />
                {formData.imageUrl && (
                  <div className={styles.imagePreview}>
                    <Typography size={14} weight="medium">
                      Preview:
                    </Typography>
                    <img
                      src={formData.imageUrl}
                      alt="Brand logo preview"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  Type *
                </Typography>
                <select
                  name="queryType"
                  value={formData.queryType}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  <option value={0}>Farcaster Channel</option>
                  <option value={1}>Farcaster Profile</option>
                </select>
              </div>

              <div className={styles.field}>
                <Typography size={16} weight="medium">
                  {formData.queryType === 0
                    ? "Channel Name"
                    : "Profile Username"}
                </Typography>
                <input
                  type="text"
                  name="channelOrProfile"
                  value={formData.channelOrProfile}
                  onChange={handleInputChange}
                  placeholder={
                    formData.queryType === 0 ? "e.g., founders" : "e.g., dwr"
                  }
                  className={`${styles.input} ${
                    errors.channelOrProfile ? styles.inputError : ""
                  }`}
                />
                <Typography size={12} className={styles.helpText}>
                  {formData.queryType === 0
                    ? "The Farcaster channel name (without /)"
                    : "The Farcaster username (without @)"}
                </Typography>
                {errors.channelOrProfile && (
                  <Typography size={12} className={styles.errorText}>
                    Channel/Profile name is required
                  </Typography>
                )}
              </div>

              {!isEditing && (
                <>
                  <div className={styles.field}>
                    <Typography size={16} weight="medium">
                      Brand Handle *
                    </Typography>
                    <input
                      type="text"
                      name="handle"
                      value={
                        formData.handle ||
                        formData.channelOrProfile.trim().toLowerCase()
                      }
                      onChange={handleInputChange}
                      placeholder="e.g., founders"
                      className={`${styles.input} ${
                        errors.handle ? styles.inputError : ""
                      }`}
                    />
                    <Typography size={12} className={styles.helpText}>
                      Unique handle for the brand (auto-filled from
                      channel/profile)
                    </Typography>
                    {errors.handle && (
                      <Typography size={12} className={styles.errorText}>
                        Brand handle is required
                      </Typography>
                    )}
                  </div>

                  <div className={styles.field}>
                    <Typography size={16} weight="medium">
                      Brand Owner FID *
                    </Typography>
                    <input
                      type="number"
                      name="fid"
                      value={formData.fid || ""}
                      onChange={handleInputChange}
                      placeholder={
                        user?.fid ? user.fid.toString() : "e.g., 12345"
                      }
                      className={`${styles.input} ${
                        errors.fid ? styles.inputError : ""
                      }`}
                    />
                    <Typography size={12} className={styles.helpText}>
                      Farcaster ID of the brand owner (defaults to your FID)
                    </Typography>
                    {errors.fid && (
                      <Typography size={12} className={styles.errorText}>
                        Valid FID is required
                      </Typography>
                    )}
                  </div>

                  <div className={styles.field}>
                    <Typography size={16} weight="medium">
                      Brand Owner Wallet Address *
                    </Typography>
                    <input
                      type="text"
                      name="walletAddress"
                      value={formData.walletAddress || walletAddress || ""}
                      onChange={handleInputChange}
                      placeholder={walletAddress || "0x..."}
                      className={`${styles.input} ${
                        errors.walletAddress ? styles.inputError : ""
                      }`}
                      disabled={!!walletAddress}
                    />
                    <Typography size={12} className={styles.helpText}>
                      Wallet address of the brand owner (defaults to connected
                      wallet)
                    </Typography>
                    {errors.walletAddress && (
                      <Typography size={12} className={styles.errorText}>
                        Wallet address is required
                      </Typography>
                    )}
                    {!isConnected && (
                      <Typography size={12} className={styles.errorText}>
                        Please connect your wallet
                      </Typography>
                    )}
                  </div>
                </>
              )}
              <div className={styles.formActions}>
                <Button
                  caption="Continue →"
                  variant="primary"
                  onClick={proceedToConfirm}
                  disabled={!isConnected && !isEditing}
                />
                {!isConnected && !isEditing && (
                  <Typography size={12} className={styles.errorText}>
                    Please connect your wallet to create a brand on-chain
                  </Typography>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // CONFIRMATION MODAL
  if (currentStep === "confirm") {
    return (
      <AppLayout>
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <Typography size={20} weight="bold">
                {isEditing ? "Confirm Changes" : "Confirm New Brand"}
              </Typography>
            </div>

            <div className={styles.confirmation}>
              <Typography
                size={16}
                weight="medium"
                className={styles.confirmTitle}
              >
                Please review the information:
              </Typography>

              <div className={styles.reviewCard}>
                {formData.imageUrl && (
                  <div className={styles.reviewImage}>
                    <img src={formData.imageUrl} alt={formData.name} />
                  </div>
                )}

                <div className={styles.reviewInfo}>
                  <Typography size={18} weight="bold">
                    {formData.name}
                  </Typography>
                  <Typography size={14} className={styles.reviewUrl}>
                    {formData.url}
                  </Typography>
                  <Typography size={14} className={styles.reviewDescription}>
                    {formData.description}
                  </Typography>
                  <Typography size={12} className={styles.reviewMeta}>
                    {formData.queryType === 0 ? "Channel" : "Profile"}:{" "}
                    {formData.channelOrProfile || "Not specified"}
                  </Typography>
                </div>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <Button
                caption="← Edit"
                variant="secondary"
                onClick={() => setCurrentStep("form")}
              />
              <Button
                caption={
                  isPreparingMetadata
                    ? "⏳ Preparing Metadata..."
                    : isCreatingBrand || isPending || isConfirming
                    ? "⏳ Creating on-chain..."
                    : isEditing
                    ? "✓ Save Changes"
                    : "✓ Create Brand"
                }
                variant="primary"
                onClick={handleFinalSubmit}
                className={styles.confirmButton}
                disabled={
                  isPreparingMetadata ||
                  isCreatingBrand ||
                  isPending ||
                  isConfirming ||
                  (!isConnected && !isEditing)
                }
              />
              {contractError && (
                <Typography size={12} className={styles.errorText}>
                  {contractError}
                </Typography>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // SUCCESS MODAL
  if (currentStep === "success") {
    return (
      <AppLayout>
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <Typography size={20} weight="bold">
                🎉 Success!
              </Typography>
            </div>

            <div className={styles.successContent}>
              <Typography
                size={18}
                weight="medium"
                className={styles.successMessage}
              >
                Brand successfully {isEditing ? "updated" : "added"}!
              </Typography>

              <div className={styles.successActions}>
                {successBrandId && successBrandId > 0 && (
                  <Button
                    caption="👁️ Go to Brand"
                    variant="primary"
                    onClick={goToBrand}
                    className={styles.successButton}
                  />
                )}
                <Button
                  caption="← Back to Admin Panel"
                  variant="secondary"
                  onClick={goToMenu}
                  className={styles.successButton}
                />
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
}

export default AdminPage;
