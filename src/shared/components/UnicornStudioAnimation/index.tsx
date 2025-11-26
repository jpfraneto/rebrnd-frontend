// components/UnicornStudioAnimation.tsx
import React from "react";
import { useUnicornStudio } from "@/hooks/ui/useUnicornStudio";

interface UnicornStudioAnimationProps {
  projectId: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

const UnicornStudioAnimation: React.FC<UnicornStudioAnimationProps> = ({
  projectId,
  width = "100%",
  height = "100%",
  className,
}) => {
  const containerRef = useUnicornStudio(projectId);

  return (
    <div
      ref={containerRef}
      data-us-project={projectId}
      style={{ width, height }}
      className={className}
    />
  );
};

export default UnicornStudioAnimation;
