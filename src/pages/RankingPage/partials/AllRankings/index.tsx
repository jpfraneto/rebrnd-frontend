// Components
import BrandsList from "@/components/BrandsList";

// Services
import { BrandTimePeriod } from "@/services/brands";

// StyleSheet
import styles from "./AllRankings.module.scss";

interface AllRankingsProps {
  period: BrandTimePeriod;
}

function AllRankings({ period }: AllRankingsProps) {
  return (
    <div className={styles.layout}>
      <BrandsList
        isFinderEnabled={true}
        config={{
          order: "all",
          limit: 50,
          period,
        }}
      />
    </div>
  );
}

export default AllRankings;