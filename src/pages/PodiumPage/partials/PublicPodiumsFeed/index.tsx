import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatUnits } from "viem";

// Components
import BrandCard from "@/components/cards/BrandCard";
import Typography from "@/components/Typography";

// StyleSheet
import styles from "./PublicPodiumsFeed.module.scss";

// Hooks
import { useRecentPodiums } from "@/hooks/brands";
import { Brand } from "@/hooks/brands";

// Utils
import { getBrandScoreVariation } from "@/utils/brand";
import { sdk } from "@farcaster/miniapp-sdk";
import LoaderIndicator from "@/shared/components/LoaderIndicator";

function PublicPodiumsFeed() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [allPodiums, setAllPodiums] = useState<any[]>([]); // Accumulate all podiums
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // NEW: Track initialization
  const limit = 20;

  const { data, isLoading, isFetching, error, refetch } = useRecentPodiums(
    currentPage,
    limit
  );

  /**
   * Initialize component with first page data on mount
   */
  useEffect(() => {
    console.log("THE DATA HERE IS", data);
    if (data?.podiums && !isInitialized) {
      console.log("THE DATA HERE IS", data);
      setAllPodiums(data.podiums);
      console.log("THE DATA DOT PODIUMS HERE IS", data.podiums);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  /**
   * Accumulate podiums from subsequent pages
   */
  useEffect(() => {
    if (data?.podiums && isInitialized) {
      if (currentPage === 1) {
        // First page after initialization - replace all podiums

        setAllPodiums(data.podiums);
      } else {
        // Subsequent pages - append new podiums

        setAllPodiums((prev) => {
          // Filter out duplicates by transactionHash
          const existingHashes = new Set(prev.map((p) => p.transactionHash));
          const newPodiums = data.podiums.filter(
            (p) => !existingHashes.has(p.transactionHash)
          );
          return [...prev, ...newPodiums];
        });
      }
      setIsLoadingMore(false);
    }
  }, [data, currentPage, isInitialized]);

  /**
   * Handles clicking on a brand card
   */
  const handleClickCard = useCallback(
    (id: Brand["id"]) => {
      navigate(`/brand/${id}`);
    },
    [navigate]
  );

  /**
   * Handles the scroll event for automatic loading.
   * When user scrolls near the bottom, loads the next page automatically.
   */
  const handleScrollList = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const calc = scrollTop + clientHeight + 50; // 50px buffer before bottom

      if (
        calc >= scrollHeight &&
        !isFetching &&
        !isLoadingMore &&
        data?.pagination.hasNextPage
      ) {
        setIsLoadingMore(true);
        setCurrentPage((prev) => prev + 1);
      }
    },
    [isFetching, isLoadingMore, data?.pagination.hasNextPage, currentPage]
  );

  /**
   * Format time ago display
   */
  const getTimeAgo = useCallback((date: string) => {
    const now = new Date();
    const created = new Date(date);
    const diffInHours = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return created.toLocaleDateString();
  }, []);

  /**
   * Format reward amount from wei
   */
  const formatReward = useCallback((amountWei: string) => {
    try {
      return formatUnits(BigInt(amountWei), 18);
    } catch {
      return "0";
    }
  }, []);

  useEffect(() => {
    if (!data?.podiums) {
      setCurrentPage(1);
      setAllPodiums([]);
      setIsInitialized(false);
    }
    setIsLoadingMore(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Check if we have data to show
  const hasData = allPodiums.length > 0;
  const hasNextPage = data?.pagination.hasNextPage;

  // Show loading only if we're loading the first page and haven't initialized
  if (isLoading && !isInitialized) {
    return (
      <div className={styles.layout}>
        <LoaderIndicator size={30} variant={"fullscreen"} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.layout}>
        <div className={styles.error}>
          <Typography>Failed to load podiums</Typography>
          <button
            onClick={() => {
              setCurrentPage(1);
              setAllPodiums([]);
              setIsInitialized(false);
              refetch();
            }}
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Only show empty state if we have no data AND we've finished loading the first time
  if (!hasData && !isLoading && isInitialized) {
    return (
      <div className={styles.layout}>
        <div className={styles.empty}>
          <Typography>No podiums yet!</Typography>
          <Typography size={14} className={styles.emptySubtext}>
            Be the first to vote and create a podium.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Scrollable container with automatic loading */}
      <div className={styles.scrollContainer} onScroll={handleScrollList}>
        <div className={styles.podiumsList}>
          {allPodiums.map((podium) => {
            // Convert brand1, brand2, brand3 to array for mapping
            const brands = [podium.brand1, podium.brand2, podium.brand3];
            return (
              <div key={podium.transactionHash} className={styles.podiumItem}>
                {/* User info header */}
                <div className={styles.podiumHeader}>
                  <div
                    className={styles.userInfo}
                    onClick={() => {
                      sdk.actions.viewProfile({ fid: podium.user.fid });
                    }}
                  >
                    {podium.user.photoUrl && (
                      <img
                        src={podium.user.photoUrl}
                        alt={podium.user.username}
                        className={styles.userAvatar}
                      />
                    )}
                    <div className={styles.userDetails}>
                      <Typography size={14} weight="medium">
                        {podium.user.username}
                      </Typography>
                      <Typography size={12} className={styles.timeAgo}>
                        {getTimeAgo(podium.date)}
                      </Typography>
                    </div>
                  </div>
                  {/* Payment and claim info */}
                  <div className={styles.paymentInfo}>
                    {podium.brndPaidWhenCreatingPodium !== null &&
                      podium.brndPaidWhenCreatingPodium !== undefined && (
                        <Typography size={12} className={styles.paidAmount}>
                          Paid {podium.brndPaidWhenCreatingPodium} $BRND
                        </Typography>
                      )}
                    {podium.claimedAt && podium.rewardAmount && (
                      <Typography size={12} className={styles.claimedAmount}>
                        Claimed {formatReward(podium.rewardAmount)} $BRND
                      </Typography>
                    )}
                  </div>
                </div>

                {/* Podium content */}
                <div className={styles.podiumRow}>
                  <div className={styles.podiumContent}>
                    <div className={styles.podiumGrid}>
                      {brands.map((brand: Brand, index: number) => (
                        <BrandCard
                          key={`${podium.transactionHash}-brand-${index}`}
                          name={brand.name}
                          photoUrl={brand.imageUrl}
                          context="podium"
                          podiumPosition={index + 1}
                          orientation={
                            index === 0
                              ? "left"
                              : index === 1
                              ? "center"
                              : "right"
                          }
                          score={brand.score}
                          variation={getBrandScoreVariation(brand.score)}
                          size="s"
                          onClick={() => handleClickCard(brand.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading indicator when fetching more */}
          {(isFetching || isLoadingMore) && currentPage > 1 && (
            <div className={styles.loadingMore}>
              <LoaderIndicator size={24} />
              <Typography size={12} className={styles.loadingText}>
                Loading more podiums...
              </Typography>
            </div>
          )}

          {/* End of list indicator */}
          {!hasNextPage && allPodiums.length > 0 && !isLoadingMore && (
            <div className={styles.endOfList}>
              <Typography size={12} className={styles.endText}>
                You've seen all {data?.pagination.total || allPodiums.length}{" "}
                podiums! 🎉
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicPodiumsFeed;
