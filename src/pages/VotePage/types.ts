import { Brand } from "@/hooks/brands";

export enum VotingViewEnum {
  PODIUM = "podium",
  SHARE = "share",
  CONGRATS = "congrats",
}

export interface VotingViewProps {
  navigateToView?: (
    view: VotingViewEnum,
    brands: Brand[],
    voteId: string,
    transactionHash?: string,
    castHash?: string
  ) => void;
  currentBrands: Brand[];
  currentVoteId: string;
  currentView: VotingViewEnum;
  voteTransactionHash?: string; // Transaction hash from voting (State 1 → State 2)
  claimTransactionHash?: string; // Transaction hash from claiming rewards (State 3 → State 4)
  castHash?: string; // Cast hash from sharing on Farcaster (State 2 → State 3)
  // Legacy prop for backward compatibility
  transactionHash?: string;
}
