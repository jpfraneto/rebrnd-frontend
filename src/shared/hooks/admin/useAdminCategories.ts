import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/services/admin";

export const useAdminCategories = () => {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};
