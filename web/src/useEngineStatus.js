import { useEffect, useState } from 'react';

// Polls the API health endpoint so the header reflects whether simulations can run.
export default function useEngineStatus(intervalMs = 15000) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (!cancelled) setStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }
    check();
    const timer = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [intervalMs]);

  return status;
}
