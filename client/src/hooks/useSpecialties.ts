import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiLoader, type SpecialtyData } from '@/lib/apiLoader';
import { getSpecialties } from '@/data/specialtyMetadata';

export function useSpecialties() {
  // Try API first, fallback to client-side metadata
  const { data: apiSpecialties, isLoading, error } = useQuery({
    queryKey: ['/api/specialties'],
    queryFn: async () => {
      try {
        return await ApiLoader.getSpecialties();
      } catch (error) {
        console.log('API specialties failed, using fallback:', error);
        // Return client-side specialties in the same format
        const clientSpecialties = getSpecialties();
        return clientSpecialties.map((name, index) => ({
          id: name.toLowerCase().replace(/\s+/g, '_'),
          name,
          displayOrder: index + 1
        }));
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false
  });

  // Return specialty names for backward compatibility
  const specialtyNames = apiSpecialties?.map(s => s.name) || [];
  
  return {
    specialties: specialtyNames,
    specialtyData: apiSpecialties || [],
    isLoading,
    error
  };
}