// Create: /src/utils/smartPeriodScoring.ts
// This calculates realistic period scores based on vote timestamps

import { Brand } from "@/hooks/brands";

/**
 * Calculate realistic scores for different time periods
 * This fixes the backend issue where period scores aren't properly reset
 */
export interface SmartScores {
  score: number;
  stateScore: number;
  ranking?: number;
}

/**
 * Get the deployment date (when the app was launched)
 */
export const getDeploymentDate = (): Date => {
  // Friday June 20th, 2025 at 3pm Chile time (6pm UTC)
  return new Date("2025-06-20T18:00:00.000Z");
};

/**
 * Get the start of current week (last Friday 3pm Chile time)
 */
export const getCurrentWeekStart = (): Date => {
  const now = new Date();
  const deploymentDate = getDeploymentDate();

  // Find the most recent Friday 18:00 UTC (3pm Chile)
  let weekStart = new Date(now);

  // Go back to most recent Friday 18:00
  while (weekStart.getUTCDay() !== 5 || weekStart.getUTCHours() < 18) {
    weekStart.setTime(weekStart.getTime() - 60 * 60 * 1000); // Go back 1 hour
  }

  // Set to exact time
  weekStart.setUTCHours(18, 0, 0, 0);

  // Don't go before deployment
  if (weekStart.getTime() < deploymentDate.getTime()) {
    return deploymentDate;
  }

  return weekStart;
};

/**
 * Get the start of current month (1st day 9am UTC)
 */
export const getCurrentMonthStart = (): Date => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 9, 0, 0));
  const deploymentDate = getDeploymentDate();

  // Don't go before deployment
  if (monthStart.getTime() < deploymentDate.getTime()) {
    return deploymentDate;
  }

  return monthStart;
};

/**
 * Calculate smart scores based on actual time periods
 * This estimates what the scores should be if resets were working properly
 */
export const calculateSmartPeriodScores = (
  brand: Brand,
  period: "week" | "month" | "all"
): SmartScores => {
  const now = new Date();
  const deploymentDate = getDeploymentDate();
  const totalDaysSinceDeployment = Math.max(
    1,
    Math.ceil(
      (now.getTime() - deploymentDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  switch (period) {
    case "all":
      return {
        score: brand.score,
        stateScore: brand.stateScore,
        ranking: parseInt(brand.ranking || "0"),
      };

    case "week": {
      const weekStart = getCurrentWeekStart();
      const daysSinceWeekStart = Math.max(
        1,
        Math.ceil((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Estimate weekly score as a fraction of total based on days
      const weeklyFraction = daysSinceWeekStart / totalDaysSinceDeployment;
      const estimatedWeeklyScore = Math.round(brand.score * weeklyFraction);

      // If backend weekly score is suspiciously close to all-time, use our estimate
      const backendWeeklyScore = brand.scoreWeek || 0;
      const isBackendSuspicious =
        Math.abs(backendWeeklyScore - brand.score) < brand.score * 0.1;

      return {
        score: isBackendSuspicious ? estimatedWeeklyScore : backendWeeklyScore,
        stateScore: isBackendSuspicious
          ? Math.round(brand.stateScore * weeklyFraction)
          : brand.stateScoreWeek || 0,
        ranking: brand.rankingWeek,
      };
    }

    case "month": {
      const monthStart = getCurrentMonthStart();
      const daysSinceMonthStart = Math.max(
        1,
        Math.ceil(
          (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Estimate monthly score
      const monthlyFraction = daysSinceMonthStart / totalDaysSinceDeployment;
      const estimatedMonthlyScore = Math.round(brand.score * monthlyFraction);

      // Check if backend monthly score seems reasonable
      const backendMonthlyScore = brand.scoreMonth || 0;
      const isBackendReasonable = backendMonthlyScore < brand.score * 0.95; // Monthly should be less than 95% of all-time

      return {
        score: isBackendReasonable
          ? backendMonthlyScore
          : estimatedMonthlyScore,
        stateScore: isBackendReasonable
          ? brand.stateScoreMonth || 0
          : Math.round(brand.stateScore * monthlyFraction),
        ranking: brand.rankingMonth,
      };
    }

    default:
      return {
        score: brand.score,
        stateScore: brand.stateScore,
        ranking: parseInt(brand.ranking || "0"),
      };
  }
};

/**
 * Process a list of brands with smart period scoring
 * This sorts them correctly based on the calculated period scores
 */
export const processBrandsWithSmartScoring = (
  brands: Brand[],
  period: "week" | "month" | "all"
): Brand[] => {
  // Calculate smart scores for each brand
  const brandsWithSmartScores = brands.map((brand) => {
    const smartScores = calculateSmartPeriodScores(brand, period);

    return {
      ...brand,
      // Override with smart scores
      _smartScore: smartScores.score,
      _smartStateScore: smartScores.stateScore,
    };
  });

  // Sort by smart scores
  const sortedBrands = brandsWithSmartScores.sort((a, b) => {
    return (b._smartScore || 0) - (a._smartScore || 0);
  });

  // Return brands with smart scores as the display scores
  return sortedBrands.map((brand) => ({
    ...brand,
    // Use smart scores for display
    displayScore: brand._smartScore,
    displayStateScore: brand._smartStateScore,
  }));
};
