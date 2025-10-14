// Dependencies
import React, { useState, useEffect } from "react";

// StyleSheet
import styles from "./CustomLinksFrame.module.scss";
import Typography from "../Typography";

const linksData = [
  {
    id: 1,
    text: "@likes x @skycastle",
    url: "https://farcaster.xyz/yar0x/0xf86781b8",
  },
  {
    id: 2,
    text: "faircaster x @bracky",
    url: "https://farcaster.xyz/faircaster/0x1362c5bc",
  },
  {
    id: 3,
    text: "rick roll",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
];

function CustomLinksFrame(): React.ReactNode {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % linksData.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.indicators}>
        {linksData.map((_, index) => (
          <div
            key={index}
            className={`${styles.dot} ${
              index === currentIndex ? styles.activeDot : ""
            }`}
          />
        ))}
      </div>

      <a
        href={linksData[currentIndex].url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.linkFrame}
      >
        <div
          className={styles.linksContainer}
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {linksData.map((link) => (
            <div key={link.id} className={styles.linkItem}>
              <div className={styles.linkText}>
                <Typography variant="geist" weight="bold" size={16}>
                  {link.text}
                </Typography>
              </div>
            </div>
          ))}
        </div>
      </a>
    </div>
  );
}

export default CustomLinksFrame;
