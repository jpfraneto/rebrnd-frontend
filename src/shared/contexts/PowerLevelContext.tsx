// src/shared/contexts/PowerLevelContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/shared/hooks/auth";

interface PowerLevelContextType {
  currentLevel: number;
  optimisticLevel: number | null;
  setOptimisticLevel: (level: number | null) => void;
  getDisplayLevel: () => number;
}

const PowerLevelContext = createContext<PowerLevelContextType | undefined>(
  undefined
);

interface PowerLevelProviderProps {
  children: React.ReactNode;
}

export const PowerLevelProvider: React.FC<PowerLevelProviderProps> = ({
  children,
}) => {
  const [optimisticLevel, setOptimisticLevel] = useState<number | null>(null);
  const { data: authData } = useAuth();

  // Get the current level from /me endpoint (source of truth)
  const backendLevel = authData?.brndPowerLevel || 0;

  // Get display level - use optimistic if available, otherwise backend level
  const getDisplayLevel = (): number => {
    if (optimisticLevel !== null && optimisticLevel > backendLevel) {
      return optimisticLevel;
    }
    return backendLevel;
  };

  // Clear optimistic level when backend catches up
  useEffect(() => {
    if (optimisticLevel !== null && backendLevel >= optimisticLevel) {
      console.log(
        `[POWER LEVEL CONTEXT] Backend caught up! Clearing optimistic update. Backend: ${backendLevel}, Optimistic: ${optimisticLevel}`
      );
      setOptimisticLevel(null);
    }
  }, [backendLevel, optimisticLevel]);

  // Clear optimistic level when user changes
  useEffect(() => {
    setOptimisticLevel(null);
  }, [authData?.fid]);

  const value: PowerLevelContextType = {
    currentLevel: backendLevel,
    optimisticLevel,
    setOptimisticLevel,
    getDisplayLevel,
  };

  return (
    <PowerLevelContext.Provider value={value}>
      {children}
    </PowerLevelContext.Provider>
  );
};

export const usePowerLevel = (): PowerLevelContextType => {
  const context = useContext(PowerLevelContext);
  if (context === undefined) {
    throw new Error("usePowerLevel must be used within a PowerLevelProvider");
  }
  return context;
};