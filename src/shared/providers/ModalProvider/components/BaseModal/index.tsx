// Dependencies
import React from "react";

// StyleSheet
import styles from "./BaseModal.module.scss";

// Components
import Button from "@/components/Button";

interface BaseModalProps {
  readonly onClose?: () => void;
  readonly children: React.ReactNode;
}

export default function BaseModal({ children, onClose }: BaseModalProps) {
  return (
    <div className={styles.layout}>
      {onClose && (
        <Button
          variant="underline"
          onClick={onClose}
          className={styles.closeBtn}
          caption="CLOSE"
        />
      )}
      <div className={styles.container}>{children}</div>
    </div>
  );
}
