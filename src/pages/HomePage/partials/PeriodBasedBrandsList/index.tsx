// Dependencies
import React, { useEffect, useMemo, useState } from "react";

// Components

// StyleSheet
import styles from "./PeriodBasedBrandsList.module.scss";

// Hook
import { useBrandList } from "@/hooks/brands";

// Utils
import {
  processBrandsWithSmartScoring,
} from "@/utils/smartPeriodScoring";

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
  const { data, refetch } = useBrandList("top", "", 1, 5, period);
  const [startY, setStartY] = useState(0);

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

  const truncateName = (name: string, maxLength: number = 12) => {
    return name.length > maxLength
      ? `${name.substring(0, maxLength)}...`
      : name;
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.leftSection}>
          <div className={styles.periodSvg}>
            <PeriodSvg />
          </div>
        </div>

        <div className={styles.rightSection}>
          {processedBrands && processedBrands.length > 0 && (
            <ul className={styles.brandsList}>
              {processedBrands.slice(0, 3).map((brand, index) => (
                <li key={`brand-item-${index}`} className={styles.brandItem}>
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
                      variant="druk"
                      className={styles.brandName}
                    >
                      {truncateName(brand.name)}
                    </Typography>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
