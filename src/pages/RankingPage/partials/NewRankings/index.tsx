// Components
import BrandsList from "@/components/BrandsList";

// Services
import { BrandTimePeriod } from "@/services/brands";

// StyleSheet
import styles from "./NewRankings.module.scss";

interface NewRankingsProps {
  period: BrandTimePeriod;
}

function NewRankings({ period }: NewRankingsProps) {
  return (
    <div className={styles.layout}>
      <BrandsList
        isFinderEnabled={false}
        config={{
          order: "new",
          limit: 50,
          period,
        }}
      />
    </div>
  );
}

export default NewRankings;