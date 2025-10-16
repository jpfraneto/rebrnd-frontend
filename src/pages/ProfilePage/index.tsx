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
import Ranks from "./partials/Ranks";
import ProfileTabNavigator from "@/shared/components/ProfileTabNavigator";
import UserProfileHeader from "@/shared/components/UserProfileHeader";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";

function ProfilePage(): React.ReactNode {

  return (
    <AppLayout>
      <div className={styles.body}>
        {/* <PointsHeader /> */}
        <UserProfileHeader />

        {/* Admin Button - Only show for admin users */}
        {/* {isAdmin && (
          <div className={styles.adminSection}>
            <Button
              caption="🛠️ Admin Panel"
              variant="secondary"
              onClick={() => navigate("/admin")}
            />
          </div>
        )} */}

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
                label: "Ranks",
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
          <Route path="/ranks" element={<Ranks />} />
          <Route path="/podiums" element={<MyPodium />} />
        </Routes>
      </div>
    </AppLayout>
  );
}

export default withProtectionRoute(ProfilePage, "only-connected");
