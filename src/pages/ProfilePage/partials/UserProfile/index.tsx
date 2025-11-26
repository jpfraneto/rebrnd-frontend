// Dependencies
import React from "react";

// StyleSheet
import styles from "./UserProfile.module.scss";

// Components
import UserProfileGridItem from "@/shared/components/UserProfileGridItem";
import Typography from "@/components/Typography";

// Hooks
import { useUserProfile } from "@/shared/hooks/user";
import { useContextualTransaction } from "@/shared/hooks/user/useContextualTransaction";
import LoaderIndicator from "@/shared/components/LoaderIndicator";
import TransactionInfo from "@/shared/components/TransactionInfo";

const UserProfile: React.FC = () => {
  const { data: profileData, isLoading, error } = useUserProfile();
  const { transaction, hasTransaction } = useContextualTransaction();
  console.log("THE PROFILE DATA IS", profileData);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoaderIndicator size={30} variant={"fullscreen"} />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className={styles.container}>
        <div className={styles.grid}>Error loading profile data</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Leader Board Position */}
        <UserProfileGridItem
          variant="primary"
          title="LEADER BOARD"
          value={`#${profileData.leaderboardPosition}`}
        />

        {/* Points */}
        <UserProfileGridItem
          variant="green"
          title="POINTS"
          value={profileData.currentPoints.toString()}
        />

        {/* Streak */}
        <UserProfileGridItem
          variant="blue"
          title="STREAK"
          value={profileData.dailyStreak.toString()}
          subtext="DAYS"
        />

        {/* Podiums */}
        <UserProfileGridItem
          variant="primary"
          title="PODIUMS"
          value={profileData.totalPodiums.toString()}
          subtext="TOTAL"
        />

        {/* Favorite Brand */}
        <UserProfileGridItem variant="red" title="FAV BRAND">
          {profileData.favoriteBrand ? (
            <div className={styles.brandContent}>
              <img
                src={profileData.favoriteBrand.iconUrl}
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
                {profileData.favoriteBrand.name}
              </Typography>
            </div>
          ) : (
            <div className={styles.brandContent}>
              <Typography
                as="h3"
                variant="geist"
                weight="bold"
                size={11}
                lineHeight={18}
                className={styles.brandName}
              >
                No favorite yet
              </Typography>
            </div>
          )}
        </UserProfileGridItem>

        {/* Voted Brands */}
        <UserProfileGridItem
          variant="primary"
          title="VOTED BRANDS"
          subtext="TOTAL"
          value={profileData.votedBrands.toString()}
        />

        {/* Neynar Score */}
        <UserProfileGridItem
          variant="blue"
          title="NEYNAR SCORE"
          value={Number(profileData.neynarScore).toFixed(2)}
          subtext="SCORE"
        />
      </div>
      
      {/* Contextual Transaction Information */}
      {hasTransaction && transaction && (
        <TransactionInfo 
          transaction={transaction}
          className={styles.transactionInfo}
        />
      )}
    </div>
  );
};

export default UserProfile;
