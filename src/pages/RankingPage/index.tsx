// Dependencies
import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

// StyleSheet
import styles from "./RankingPage.module.scss";

// Components
import AppLayout from "../../shared/layouts/AppLayout";
import TopRankings from "./partials/TopRankings";
import NewRankings from "./partials/NewRankings";
import AllRankings from "./partials/AllRankings";
import TabNavigator from "@/components/TabNavigator";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";
import BrandHeader from "@/shared/components/BrandHeader";
import TimePeriodFilter, {
  BrandTimePeriod,
} from "@/shared/components/TimePeriodFilter";

function RankingPage(): React.ReactNode {
  const location = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<BrandTimePeriod>("all");

  // Initialize period from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const periodParam = urlParams.get('period') as BrandTimePeriod;
    
    if (periodParam && ['week', 'month', 'all'].includes(periodParam)) {
      setSelectedPeriod(periodParam);
    }
  }, [location.search]);

  return (
    <AppLayout>
      <div className={styles.body}>
        <div className={styles.header}>
          <BrandHeader showBackButton={true} />

          <div className={styles.tabs}>
            <TabNavigator
              tabs={[
                {
                  label: "Top",
                  path: "/ranking",
                },
                {
                  label: "New",
                  path: "/ranking/new",
                },
                {
                  label: "All",
                  path: "/ranking/all",
                },
              ]}
            />
          </div>
        </div>

        <div className={styles.periodFilter}>
          <TimePeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>

        <Routes>
          <Route path="/" element={<TopRankings period={selectedPeriod} />} />
          <Route path="/new" element={<NewRankings period={selectedPeriod} />} />
          <Route path="/all" element={<AllRankings period={selectedPeriod} />} />
        </Routes>
      </div>
    </AppLayout>
  );
}

export default withProtectionRoute(RankingPage, "only-connected");