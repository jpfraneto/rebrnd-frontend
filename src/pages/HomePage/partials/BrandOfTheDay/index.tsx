// Dependencies
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// Components
import BrandCard from "@/components/cards/BrandCard";

// StyleSheet
import styles from "./BrandOfTheDay.module.scss";

// Hook
import { Brand, useBrandList } from "@/hooks/brands";

// Utils
import { getBrandScoreVariation } from "@/utils/brand";
import {
  calculateSmartPeriodScores,
  processBrandsWithSmartScoring,
} from "@/utils/smartPeriodScoring";

// Assets
import BrandOfTheDayImage from "@/assets/images/brand-of-the-day.svg?react";

import { BrandTimePeriod } from "@/shared/components/TimePeriodFilter";

interface BrandOfTheDayProps {
  period: BrandTimePeriod;
}

function BrandOfTheDay({ period }: BrandOfTheDayProps) {
  const navigate = useNavigate();
  const { data, refetch } = useBrandList("top", "", 1, 1, period);

  useEffect(() => {
    refetch();
  }, [period]);

  const processedBrands = useMemo(() => {
    if (!data?.brands) return [];
    return processBrandsWithSmartScoring(data.brands, period);
  }, [data?.brands, period]);

  const getScoreForPeriod = useCallback(
    (brand: Brand): number => {
      const smartScores = calculateSmartPeriodScores(brand, period);
      return smartScores.score;
    },
    [period]
  );

  const getStateScoreForPeriod = useCallback(
    (brand: Brand): number => {
      const smartScores = calculateSmartPeriodScores(brand, period);
      return smartScores.stateScore;
    },
    [period]
  );

  const mainBrand = useMemo<Brand | undefined>(
    () => processedBrands?.[0],
    [processedBrands]
  );

  const handleClickCard = useCallback((id: Brand["id"]) => {
    navigate(`/brand/${id}`);
  }, []);

  if (!mainBrand) return null;

  return (
    <div className={styles.feature}>
      <div className={styles.image}>
        <BrandOfTheDayImage />
      </div>
      <div className={styles.brand}>
        <BrandCard
          size={"l"}
          selected={true}
          orientation={"center"}
          className={styles.brandCard}
          name={mainBrand.name}
          photoUrl={mainBrand.imageUrl}
          score={getScoreForPeriod(mainBrand)}
          onClick={() => handleClickCard(mainBrand.id)}
          variation={getBrandScoreVariation(
            getStateScoreForPeriod(mainBrand)
          )}
        />
      </div>
    </div>
  );
}

export default BrandOfTheDay;