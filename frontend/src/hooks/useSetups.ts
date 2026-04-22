import { useState, useEffect, useCallback } from 'react';
import { TradeSetup } from '../types';
import { setupsApi } from '../services/api';

export function useSetups(pollInterval = 30000) {
  const [setups, setSetups] = useState<TradeSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSetups = useCallback(async () => {
    try {
      const data = await setupsApi.list('ACTIVE');
      setSetups(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError('Failed to load setups');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSetups();
    const id = setInterval(fetchSetups, pollInterval);
    return () => clearInterval(id);
  }, [fetchSetups, pollInterval]);

  const dismissSetup = useCallback(async (id: string) => {
    await setupsApi.dismiss(id);
    setSetups(prev => prev.filter(s => s.id !== id));
  }, []);

  return { setups, loading, error, lastUpdated, refresh: fetchSetups, dismissSetup };
}

export function useSetupDetail(id: string) {
  const [setup, setSetup] = useState<TradeSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setupsApi.get(id)
      .then(data => { setSetup(data); setError(null); })
      .catch(() => setError('Setup not found'))
      .finally(() => setLoading(false));
  }, [id]);

  return { setup, loading, error };
}
