import { useCallback, useMemo, useState } from 'react';
import { useSmartFetch } from './useSmartFetch';

export const useSmartIndustry = () => {
  const [requestNonce, setRequestNonce] = useState(0);

  const { data, loading, error, refetch } = useSmartFetch('/industry/profile', {
    dependencies: [requestNonce],
    enabled: true,
    showToast: false,
  });

  const forceRefresh = useCallback(() => {
    setRequestNonce((n) => n + 1);
    refetch();
  }, [refetch]);

  const clearError = useCallback(() => {
    // useSmartFetch doesn't expose setError; simplest is to refetch.
    if (error) forceRefresh();
  }, [error, forceRefresh]);

  return useMemo(
    () => ({
      data: data?.data ?? data,
      loading,
      error,
      isStale: false,
      forceRefresh,
      clearError,
    }),
    [data, loading, error, forceRefresh, clearError]
  );
};
