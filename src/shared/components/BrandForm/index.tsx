// src/pages/AdminPage/components/BrandForm.tsx
import React, { useState, useEffect } from "react";

// Components
import Button from "@/shared/components/Button";

// Hooks
import { Brand } from "@/hooks/brands";

// StyleSheet
import styles from "./BrandForm.module.scss";

// Types
interface BrandFormProps {
  brand?: Brand;
  onClose: () => void;
  onSuccess: () => void;
}

interface BrandFormData {
  name: string;
  url: string;
  warpcastUrl: string;
  description: string;
  categoryId: number;
  followerCount: number;
  imageUrl: string;
  profile: string;
  channel: string;
  queryType: number;
}

// Simple API calls using your existing request structure
const createBrandAPI = async (data: BrandFormData) => {
  const response = await fetch("/admin/brands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Add your auth headers here
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create brand");
  }

  return response.json();
};

const updateBrandAPI = async (id: number, data: Partial<BrandFormData>) => {
  const response = await fetch(`/admin/brands/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // Add your auth headers here
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update brand");
  }

  return response.json();
};

function BrandForm({
  brand,
  onClose,
  onSuccess,
}: BrandFormProps): React.ReactNode {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<BrandFormData>({
    name: "",
    url: "",
    warpcastUrl: "",
    description: "",
    categoryId: 1, // Default category
    followerCount: 0,
    imageUrl: "",
    profile: "",
    channel: "",
    queryType: 0, // Default to Channel
  });

  // Populate form if editing
  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name || "",
        url: brand.url || "",
        warpcastUrl: brand.warpcastUrl || "",
        description: brand.description || "",
        categoryId: brand.category?.id || 1,
        followerCount: brand.followerCount || 0,
        imageUrl: brand.imageUrl || "",
        profile: brand.profile || "",
        channel: brand.channel || "",
        queryType: brand.queryType || 0,
      });
    }
  }, [brand]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "categoryId" ||
        name === "followerCount" ||
        name === "queryType"
          ? parseInt(value) || 0
          : value,
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (brand) {
        await updateBrandAPI(brand.id, formData);
      } else {
        await createBrandAPI(formData);
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving brand:", error);
      alert("Error saving brand. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Essential Fields Only */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Brand Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="Enter brand name"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Website URL *</label>
        <input
          type="url"
          name="url"
          value={formData.url}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="https://example.com"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Warpcast URL *</label>
        <input
          type="url"
          name="warpcastUrl"
          value={formData.warpcastUrl}
          onChange={handleInputChange}
          required
          className={styles.input}
          placeholder="https://warpcast.com/..."
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Description *</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          required
          rows={3}
          className={styles.textarea}
          placeholder="Brief description of the brand"
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Query Type *</label>
          <select
            name="queryType"
            value={formData.queryType}
            onChange={handleInputChange}
            required
            className={styles.select}
          >
            <option value={0}>Channel</option>
            <option value={1}>Profile</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Category ID</label>
          <input
            type="number"
            name="categoryId"
            value={formData.categoryId}
            onChange={handleInputChange}
            min="1"
            className={styles.input}
            placeholder="1"
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Channel/Profile Handle</label>
          <input
            type="text"
            name={formData.queryType === 0 ? "channel" : "profile"}
            value={
              formData.queryType === 0 ? formData.channel : formData.profile
            }
            onChange={handleInputChange}
            className={styles.input}
            placeholder={formData.queryType === 0 ? "channel-name" : "username"}
          />
          <small className={styles.helpText}>
            {formData.queryType === 0
              ? "Farcaster channel name"
              : "Farcaster username"}
          </small>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Image URL</label>
          <input
            type="url"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleInputChange}
            className={styles.input}
            placeholder="https://example.com/logo.png"
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <Button caption="Cancel" variant="secondary" onClick={onClose} />
        <Button
          caption={
            isSubmitting ? "Saving..." : brand ? "Update Brand" : "Create Brand"
          }
          variant="primary"
          disabled={isSubmitting}
          onClick={handleSubmit}
        />
      </div>
    </form>
  );
}

export default BrandForm;
