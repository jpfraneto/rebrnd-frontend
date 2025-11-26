// src/pages/ProfilePage/index.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";

// StyleSheet
import styles from "./ProfilePage.module.scss";

// Components
import AppLayout from "@/shared/layouts/AppLayout";
import MyPodium from "./partials/MyPodium";
import UserProfile from "./partials/UserProfile";
import Power from "./partials/Power";
import ProfileTabNavigator from "@/shared/components/ProfileTabNavigator";
import UserProfileHeader from "@/shared/components/UserProfileHeader";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";
import MyBrands from "./partials/MyBrands";

function ProfilePage(): React.ReactNode {
  return (
    <AppLayout>
      <div className={styles.body}>
        {/* <PointsHeader /> */}
        <UserProfileHeader />

        <div className={styles.tabs}>
          <ProfileTabNavigator
            tabs={[
              {
                label: "Profile",
                path: "/profile",
              },
              {
                label: "Power",
                path: "/profile/power",
              },
              {
                label: "Rank",
                path: "/profile/ranks",
              },
              {
                label: "Podiums",
                path: "/profile/podiums",
              },
            ]}
          />
        </div>
        <Routes>
          <Route path="/" element={<UserProfile />} />
          <Route path="/power" element={<Power />} />
          <Route path="/ranks" element={<MyBrands />} />
          <Route path="/podiums" element={<MyPodium />} />
        </Routes>
      </div>
    </AppLayout>
  );
}

export default withProtectionRoute(ProfilePage, "only-connected");
