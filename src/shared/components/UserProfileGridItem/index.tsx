// Dependencies
import React from "react";
import classNames from "clsx";

// StyleSheet
import styles from "./UserProfileGridItem.module.scss";

// Components
import Typography from "@/components/Typography";

interface UserProfileGridItemProps {
  variant?: "primary" | "green" | "red" | "blue";
  title: string;
  value?: string | number;
  subtext?: string;
  hasLink?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const UserProfileGridItem: React.FC<UserProfileGridItemProps> = ({
  variant = "primary",
  title,
  value,
  subtext,
  hasLink = false,
  className,
  children,
}) => {
  return (
    <div className={classNames(styles.layout, styles[variant], className)}>
      <div className={styles.container}>
        {/* Title - Top Left */}
        <div className={styles.header}>
          <Typography
            as="h5"
            variant="druk"
            weight="text-wide"
            size={10}
            lineHeight={12}
            className={styles.title}
          >
            {title}
          </Typography>
        </div>

        {/* Main Content Area */}
        <div className={styles.content}>
          {children || (
            <>
              {/* Value - Bottom Left */}
              <div className={styles.valueSection}>
                {subtext && (
                  <Typography
                    as="p"
                    size={12}
                    lineHeight={14}
                    className={styles.subText}
                  >
                    {subtext}
                  </Typography>
                )}
                <Typography
                  as="h1"
                  variant="druk"
                  weight="text-wide"
                  size={20}
                  lineHeight={24}
                  className={styles.mainValue}
                >
                  {value}
                </Typography>
              </div>

              {/* Link Icon - Bottom Right */}
              {hasLink && (
                <div className={styles.linkIcon}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 17L17 7M17 7H7M17 7V17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileGridItem;
