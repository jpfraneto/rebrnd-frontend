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
        <UserProfileGridItem variant="red" title="FAV BRAND">
          <div className={styles.brandContent}>
            <img
              src="https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/1b471987-45b1-48e3-6af4-44929b6e4900/anim=false,fit=contain,f=auto,w=576"
              alt="Favorite Brand"
              className={styles.brandIcon}
            />
            <Typography
              as="h3"
              variant="geist"
              weight="bold"
              size={11}
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
