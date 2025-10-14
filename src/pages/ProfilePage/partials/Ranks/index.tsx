// Dependencies
import React from "react";

// StyleSheet
import styles from "./Ranks.module.scss";

// Components
import Typography from "@/components/Typography";

const Ranks: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Typography
          as="h2"
          variant="druk"
          weight="text-wide"
          size={20}
          lineHeight={24}
          className={styles.title}
        >
          ????
        </Typography>
      </div>
    </div>
  );
};

export default Ranks;
