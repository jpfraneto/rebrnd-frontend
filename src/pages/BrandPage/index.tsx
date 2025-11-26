// Dependencies
import { useNavigate, useParams } from "react-router-dom";
import { useCallback } from "react";
import classNames from "clsx";

// StyleSheet
import styles from "./BrandPage.module.scss";

// Components
import AppLayout from "@/shared/layouts/AppLayout";
import Typography from "@/components/Typography";
import Button from "@/components/Button";
import LoaderIndicator from "@/components/LoaderIndicator";
import GridItem from "./partials/GridItem";
import IconButton from "@/components/IconButton";
import CastItem from "./partials/CastItem";

// Assets
import GoBackIcon from "@/assets/icons/go-back-icon.svg?react";
import ExportIcon from "@/assets/icons/export-icon.svg?react";
import FavoriteIcon from "@/assets/icons/favorite-icon.svg?react";
import GlobeIcon from "@/assets/icons/globe-icon.svg?react";
import ScoreUpDownIcon from "@/assets/icons/score-updown-icon.svg?react";
import ScoreEqualIcon from "@/assets/icons/score-equal-icon.svg?react";

// Hocs
import withProtectionRoute from "@/hocs/withProtectionRoute";

// Hooks
import { useBrand } from "@/hooks/brands";
import { useAuth } from "@/hooks/auth";
import useDisableScrollBody from "@/hooks/ui/useDisableScrollBody";

// Utils
import { shortenNumber } from "@/utils/number";
import { getBrandScoreVariation } from "@/utils/brand";
import sdk from "@farcaster/miniapp-sdk";

function BrandPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { data: user } = useAuth();
  const { data, isLoading } = useBrand(Number(id));
  console.log("THE DATA ON THE BRAND PAGE", data);
  useDisableScrollBody();

  /**
   * Opens the brand's website in a new tab.
   */
  const handleClickWebsite = useCallback(() => {
    window.open(data?.brand?.url, "_blank");
  }, [data?.brand?.url]);

  /**
   * Opens the share modal for the brand.
   */
  const handleClickShare = useCallback(() => {
    if (data?.brand?.id) {
      sdk.actions.composeCast({
        text: `Check out this brand on BRND: ${data?.brand?.name} - ${data?.brand?.profile}`,
        embeds: [`https://brnd.land/brand/${data?.brand?.id}`],
      });
    }
  }, [data?.brand?.id]);

  /**
   * Determines the size based on the given score.
   *
   * @param {number} score - The score to evaluate.
   * @returns {number} - The size corresponding to the score.
   */
  function getSize(score: number): number {
    switch (true) {
      case score > 1000000:
        return 26;
      case score > 100000:
        return 24;
      case score > 10000:
        return 28;
      default:
        return 32;
    }
  }

  const renderVariation = () => {
    if (!data?.brand) {
      return null;
    }

    const variation = getBrandScoreVariation(data?.brand.stateScore);

    const iconClass = styles[variation];
    const IconComponent =
      variation === "equal" ? ScoreEqualIcon : ScoreUpDownIcon;

    return (
      <GridItem
        variant={
          variation == "equal" ? "blue" : variation === "down" ? "red" : "green"
        }
        title={"Score"}
        rightElement={
          <div className={classNames(styles.indicator, iconClass)}>
            <Typography weight={"light"} size={12} lineHeight={14}>
              {variation === "up" ? "+" : variation === "down" ? "-" : ""}
              {data?.brand.stateScore}
            </Typography>

            <div className={styles.icon}>
              <IconComponent />
            </div>
          </div>
        }
      >
        <div className={styles.center}>
          <Typography
            variant={"druk"}
            weight={"wide"}
            className={styles.score}
            size={getSize(data.brand.score)}
          >
            {shortenNumber(data.brand.score)}
          </Typography>
        </div>
      </GridItem>
    );
  };

  /**
   * Determines if the footer should be visible based on the user's voting status.
   *
   * @type {boolean} - True if the user has voted today, false otherwise.
   */
  const isFooterVisible = user && !user.hasVotedToday;

  // Get actual fan count from backend response (unique users who voted for this brand)
  const totalFans = data?.fanCount || 0;

  return (
    <AppLayout>
      <div className={styles.body}>
        {isLoading || !data || !data.brand?.name ? (
          <LoaderIndicator variant={"fullscreen"} />
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.head}>
                {user && (
                  <IconButton
                    variant={"solid"}
                    icon={<GoBackIcon />}
                    onClick={() => navigate(-1)}
                    className={styles.backBtn}
                  />
                )}
                <div className={styles.actions}>
                  <IconButton
                    icon={<ExportIcon />}
                    variant={"secondary"}
                    onClick={handleClickShare}
                  />
                  <IconButton
                    icon={<GlobeIcon />}
                    variant={"secondary"}
                    onClick={handleClickWebsite}
                  />
                </div>
              </div>

              <div className={styles.head}>
                <div className={styles.title}>
                  <Typography
                    as={"p"}
                    variant={"druk"}
                    weight={"text-wide"}
                    size={22}
                    lineHeight={22}
                    className={styles.name}
                  >
                    <span>{data.brand.name}</span>
                  </Typography>
                </div>
              </div>
            </div>
            <div className={styles.container}>
              <div className={classNames(styles.grid, styles.inline)}>
                <div className={styles.grid}>
                  {/* Logo with border */}
                  <div className={styles.imageContainer}>
                    <img
                      src={data.brand.imageUrl}
                      alt={data.brand.name}
                      className={styles.brandImage}
                    />
                  </div>

                  {/* Score variation - now same height as logo */}
                  {renderVariation()}

                  {/* Farcaster info */}
                  <GridItem title={"Farcaster"}>
                    <div className={classNames(styles.bottom, styles.profile)}>
                      <Typography variant={"geist"} weight={"regular"}>
                        <a
                          href={`https://warpcast.com/${data.brand.profile.slice(
                            1
                          )}`}
                          target={"_blank"}
                        >
                          {data.brand.profile}
                        </a>
                      </Typography>
                      <Typography
                        variant={"geist"}
                        weight={"regular"}
                        className={styles.grey}
                      >
                        <a
                          href={`https://warpcast.com/~/channel/${data.brand.channel.slice(
                            1
                          )}`}
                          target={"_blank"}
                        >
                          {data.brand.channel}
                        </a>
                      </Typography>
                    </div>
                  </GridItem>

                  {/* Ranking with proper info */}
                  <GridItem title={"Ranking"}>
                    <div className={styles.bottom}>
                      <Typography
                        variant={"geist"}
                        weight={"regular"}
                        className={styles.label}
                        size={10}
                        lineHeight={12}
                      >
                        Global
                      </Typography>
                      <Typography variant={"druk"} weight={"wide"} size={32}>
                        #{data.brand.currentRanking || "N/A"}
                      </Typography>
                    </div>
                  </GridItem>

                  {/* Fans instead of Followers */}
                  <GridItem title={"Fans"}>
                    <div className={styles.bottom}>
                      <Typography
                        variant={"geist"}
                        weight={"regular"}
                        className={styles.label}
                        size={10}
                        lineHeight={12}
                      >
                        Voters
                      </Typography>
                      <Typography
                        variant={"druk"}
                        weight={"wide"}
                        size={18}
                        lineHeight={22}
                      >
                        {shortenNumber(totalFans)}
                      </Typography>
                    </div>
                  </GridItem>

                  {/* Category with smaller text */}
                  <GridItem title={"Category"}>
                    <div className={styles.bottom}>
                      <Typography
                        variant={"druk"}
                        weight={"wide"}
                        size={14} // Reduced from 18 to 14
                        lineHeight={18} // Reduced from 22 to 18
                      >
                        {data.brand.category.name}
                      </Typography>
                    </div>
                  </GridItem>
                </div>

                {/* Description box */}
                <GridItem title={"Description"} className={styles.box}>
                  <div className={styles.boxBody}>
                    <Typography size={16} lineHeight={20}>
                      {data.brand.description}
                    </Typography>
                  </div>
                </GridItem>

                {/* Latest casts */}
                <GridItem
                  title={"Latest casts"}
                  className={classNames(styles.box, styles.casts)}
                >
                  {data.casts.map((cast, index) => (
                    <CastItem
                      key={"castitem--key--" + index.toString()}
                      user={{
                        photoUrl: cast.creatorPfp,
                        username: cast.creator,
                      }}
                      url={cast.warpcastUrl}
                      message={cast.text}
                      hash={cast.hash}
                      attach={{
                        type: "image",
                        src: cast?.image as string,
                      }}
                    />
                  ))}
                </GridItem>
              </div>
              {isFooterVisible && <div className={styles.divider} />}
            </div>
          </>
        )}

        {isFooterVisible && (
          <div className={styles.footer}>
            <Button
              caption={"Add To Podium"}
              variant="primary"
              iconLeft={<FavoriteIcon />}
              onClick={() => navigate("/vote")}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default withProtectionRoute(BrandPage, "always");
