import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface UseApiOptions<T> {
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

export function useApi<T>(url: string, options?: UseApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const { enabled = true, onSuccess, onError } = options || {};

  const execute = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(url);
      setData(response.data);
      if (onSuccess) onSuccess(response.data);
    } catch (err: any) {
      setError(err);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [url, enabled, onSuccess, onError]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
