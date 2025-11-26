// Dependencies
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";

// Services
import { getUserVotesHistory } from "@/services/user";

// Types
import { User, UserVoteHistory } from "./types";

export const useVoteHistory = (userId: User["fid"], pageId: number) => {
  const votesRef = useRef<Record<string, UserVoteHistory>>({});
  const countRef = useRef<number>(0);
  console.log("THE USER ID", userId);
  const result = useQuery({
    queryKey: ["votesHistory", userId, pageId],
    queryFn: () => getUserVotesHistory(userId, pageId),
    retry: false,
    staleTime: 0,
    enabled: false,
    placeholderData: (prev) => prev,
  });

  console.log("THE RESULT", result);

  if (!result.isError) {
    const votes = result.data?.data || {};

    if (pageId === 1) {
      votesRef.current = votes;
    } else {
      votesRef.current = {
        ...votesRef.current,
        ...votes,
      };
    }
    countRef.current = result.data?.count ?? 0;
  }

  return {
    ...result,
    data: {
      data: votesRef.current,
      count: countRef.current,
    },
  };
};
