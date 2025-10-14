// Dependencies
import React, { useState, useEffect } from "react";

// Components
import TrendBrands from "../TrendBrands";
import NewBrands from "../NewBrands";
import AllBrands from "../AllBrands";

// StyleSheet
import styles from "./BrandsCarousel.module.scss";

// Types
import { BrandTimePeriod } from "@/shared/components/TimePeriodFilter";

interface BrandsCarouselProps {
  period: BrandTimePeriod;
}

const carouselItems = [
  { component: TrendBrands, label: "Top" },
  { component: NewBrands, label: "New" },
  { component: AllBrands, label: "All" },
];

function BrandsCarousel({ period }: BrandsCarouselProps): React.ReactNode {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselItems.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const CurrentComponent = carouselItems[currentIndex].component;

  return (
    <div className={styles.carousel}>
      <div className={styles.content}>
        <CurrentComponent period={period} />
      </div>
      
      <div className={styles.indicators}>
        {carouselItems.map((_, index) => (
          <div
            key={index}
            className={`${styles.indicator} ${
              index === currentIndex ? styles.active : ""
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default BrandsCarousel;