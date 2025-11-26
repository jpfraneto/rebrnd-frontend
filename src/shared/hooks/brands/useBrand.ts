// Dependencies
import { useQuery } from '@tanstack/react-query';

// Services
import { getBrandById } from '@/services/brands';

// Types
import { Brand } from './types';

/**
 * Custom hook to fetch brand data by ID using React Query.
 *
 * @param {Brand['id']} id - The ID of the brand to fetch.
 * @returns {object} - The query object returned by useQuery, containing the brand data and query status.
 */
export const useBrand = (id: Brand['id']) => {
  const numericId = id ? Number(id) : null;
  const isValidId = numericId !== null && !isNaN(numericId) && numericId > 0;
  
  return useQuery({
    queryKey: ['brand', numericId], 
    queryFn: () => getBrandById(numericId!), 
    enabled: isValidId,
  });
};
