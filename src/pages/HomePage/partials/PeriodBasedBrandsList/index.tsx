// Dependencies
import React, { useEffect, useMemo, useState } from "react";

// Components

// StyleSheet
import styles from "./PeriodBasedBrandsList.module.scss";

// Hook
import { useBrandList } from "@/hooks/brands";

// Utils
import { processBrandsWithSmartScoring } from "@/utils/smartPeriodScoring";
import { useNavigate } from "react-router-dom";

// Assets
import BrandOfTheWeek from "@/assets/images/brand-of-the-week.svg?react";
import BrandOfTheMonth from "@/assets/images/brand-of-the-month.svg?react";
import AllTimeBrand from "@/assets/images/all-time-brand.svg?react";

import { BrandTimePeriod } from "@/shared/components/TimePeriodFilter";
import Typography from "@/shared/components/Typography";

interface PeriodBasedBrandsListProps {
  period: BrandTimePeriod;
  onPeriodChange: (period: BrandTimePeriod) => void;
}

const PERIOD_SVGS = {
  week: BrandOfTheWeek,
  month: BrandOfTheMonth,
  all: AllTimeBrand,
};

const PERIODS: BrandTimePeriod[] = ["week", "month", "all"];

function PeriodBasedBrandsList({
  period,
  onPeriodChange,
}: PeriodBasedBrandsListProps) {
  const { data, refetch, isLoading } = useBrandList("top", "", 1, 5, period);
  const [startY, setStartY] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    try {
      refetch();
    } catch (error) {
      console.error("Error refetching brands:", error);
    }
  }, [period, refetch]);

  const processedBrands = useMemo(() => {
    if (!data?.brands) return [];
    return processBrandsWithSmartScoring(data.brands, period);
  }, [data?.brands, period]);

  // Swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = startY - endY;

    // Minimum swipe distance
    if (Math.abs(diffY) > 50) {
      const currentIndex = PERIODS.indexOf(period);
      let nextIndex;

      if (diffY > 0) {
        // Swipe up - next period
        nextIndex = (currentIndex + 1) % PERIODS.length;
      } else {
        // Swipe down - previous period
        nextIndex = currentIndex === 0 ? PERIODS.length - 1 : currentIndex - 1;
      }

      onPeriodChange(PERIODS[nextIndex]);
    }
  };

  const PeriodSvg = PERIOD_SVGS[period];
  const currentPeriodIndex = PERIODS.indexOf(period);

  const truncateName = (name: string, maxLength: number = 16) => {
    return name.length > maxLength
      ? `${name.substring(0, maxLength)}...`
      : name;
  };

  const handleClickBrand = (id: string) => {
    navigate(`/brand/${id}`);
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.leftSection}
          onClick={() => {
            const currentIndex = PERIODS.indexOf(period);
            const nextIndex = (currentIndex + 1) % PERIODS.length;
            onPeriodChange(PERIODS[nextIndex]);
          }}
        >
          <div className={styles.periodSvg}>
            <PeriodSvg />
          </div>
        </div>

        <div className={styles.rightSection}>
          <ul className={styles.brandsList}>
            {isLoading || !processedBrands || processedBrands.length === 0 ? (
              // Show skeleton loading state
              Array.from({ length: 3 }).map((_, index) => (
                <li key={`skeleton-${index}`} className={styles.brandItem}>
                  <div className={styles.brandInfo}>
                    <div className={styles.skeletonImage} />
                    <div className={styles.skeletonName} />
                  </div>
                </li>
              ))
            ) : (
              // Show actual brand data
              processedBrands.slice(0, 3).map((brand, index) => (
                <li
                  onClick={() => handleClickBrand(brand.id.toString())}
                  key={`brand-item-${index}`}
                  className={styles.brandItem}
                >
                  <div className={styles.brandInfo}>
                    <img
                      src={brand.imageUrl}
                      alt={brand.name}
                      className={styles.brandImage}
                    />
                    <Typography
                      size={14}
                      lineHeight={14}
                      weight="medium"
                      variant="geist"
                      className={styles.brandName}
                    >
                      {truncateName(brand.name)}
                    </Typography>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className={styles.periodIndicator}>
        {PERIODS.map((_, index) => (
          <div
            key={index}
            className={`${styles.dot} ${
              index === currentPeriodIndex ? styles.activeDot : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(PeriodBasedBrandsList);
