// Dependencies
import React from "react";

// StyleSheet
import styles from "./UserProfile.module.scss";

// Components
import UserProfileGridItem from "@/shared/components/UserProfileGridItem";
import Typography from "@/components/Typography";

const UserProfile: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Leader Board Position */}
        <UserProfileGridItem
          variant="primary"
          title="LEADER BOARD"
          value="#8"
        />

        {/* Points */}
        <UserProfileGridItem variant="green" title="POINTS" value="462" />

        {/* Streak */}
        <UserProfileGridItem
          variant="blue"
          title="STREAK"
          value="22"
          subtext="DAYS"
        />

        {/* Podiums */}
        <UserProfileGridItem
          variant="primary"
          title="PODIUMS"
          value="69"
          subtext="TOTAL"
          hasLink={true}
        />

        {/* Favorite Brand */}
        <UserProfileGridItem variant="red" title="FAVORITE">
          <div className={styles.brandContent}>
            <div className={styles.brandIcon}>
              <div className={styles.brandSphere}></div>
            </div>
            <Typography
              as="h3"
              variant="druk"
              weight="text-wide"
              size={16}
              lineHeight={18}
              className={styles.brandName}
            >
              Zora
            </Typography>
          </div>
        </UserProfileGridItem>

        {/* Voted Brands */}
        <UserProfileGridItem
          variant="primary"
          title="VOTED BRANDS"
          value="27"
          hasLink={true}
        />

        {/* Neymar Score */}
        <UserProfileGridItem
          variant="blue"
          title="NEYNAR"
          value="0.90"
          subtext="SCORE"
          hasLink={true}
        />
      </div>
    </div>
  );
};

export default UserProfile;
