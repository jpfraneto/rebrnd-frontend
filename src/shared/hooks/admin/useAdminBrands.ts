// src/hooks/admin.ts
import { useQuery } from "@tanstack/react-query";
import { getBrands, getCategories } from "@/services/admin";

export const useAdminBrands = (
  page: number = 1,
  limit: number = 20,
  search: string = ""
) => {
  return useQuery({
    queryKey: ["admin", "brands", page, limit, search],
    queryFn: () => getBrands(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

export const useAdminCategories = () => {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};
