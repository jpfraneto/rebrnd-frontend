// Dependencies
import React, { useState } from "react";

// StyleSheet
import styles from "./HomePage.module.scss";

// Components
import AppLayout from "../../shared/layouts/AppLayout";
import AirdropBanner from "@/components/AirdropBanner";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";
import BrandHeader from "@/shared/components/BrandHeader";
import { BrandTimePeriod } from "@/shared/components/TimePeriodFilter";
import BrandOfTheDay from "./partials/BrandOfTheDay";
import PeriodBasedBrandsList from "./partials/PeriodBasedBrandsList";
import CustomLinksFrame from "@/shared/components/CustomLinksFrame";

function HomePage(): React.ReactNode {
  const [selectedPeriod, setSelectedPeriod] = useState<BrandTimePeriod>("all");

  return (
    <AppLayout>
      <div className={styles.body}>
        <div className={styles.header}>
          <BrandHeader
            showBackButton={false}
            showUserProfile={true}
            showUserPoints={false}
          />
        </div>
        <AirdropBanner />
        <CustomLinksFrame />

        <div className={styles.brandOfTheDaySection}>
          <BrandOfTheDay />
        </div>

        <div className={styles.brandsListSection}>
          <PeriodBasedBrandsList
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default withProtectionRoute(HomePage, "only-connected");
