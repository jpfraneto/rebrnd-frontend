// Dependencies
import React from "react";

// StyleSheet
import styles from "./Power.module.scss";

// Components
import Typography from "@/components/Typography";

const Power: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Typography
          as="h2"
          variant="druk"
          weight="text-wide"
          size={24}
          lineHeight={28}
          className={styles.title}
        >
          ????
        </Typography>
      </div>
    </div>
  );
};

export default Power;
