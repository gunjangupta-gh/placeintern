/**
 * Example: Component with Request Cancellation
 *
 * This example demonstrates how to implement request cancellation
 * using AbortController to prevent memory leaks and race conditions.
 */

import React, { useEffect, useState } from 'react';
import { useAbortController, useAbortControllers } from '../hooks/useAbortController';
import { Button, message } from 'antd';

// Example 1: Single request cancellation
const SimpleComponentWithAbort = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { getSignal, abort } = useAbortController();

  useEffect(() => {
    fetchData();

    // Cleanup: abort request on unmount
    return () => abort();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data', {
        signal: getSignal() // Pass abort signal
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        message.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading ? 'Loading...' : JSON.stringify(data)}
      <Button onClick={abort}>Cancel Request</Button>
    </div>
  );
};

// Example 2: Multiple concurrent requests
const ComplexComponentWithAbort = () => {
  const [dashboard, setDashboard] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const { getSignal, createNew, abort, abortAll } = useAbortControllers();

  useEffect(() => {
    // Fetch multiple endpoints concurrently
    Promise.all([
      fetchDashboard(),
      fetchMetrics(),
      fetchAlerts(),
    ]);

    // Cleanup: cancel all requests on unmount
    return () => abortAll();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard', {
        signal: createNew('dashboard') // Unique key for this request
      });
      const data = await response.json();
      setDashboard(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Dashboard fetch failed:', error);
      }
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics', {
        signal: createNew('metrics')
      });
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Metrics fetch failed:', error);
      }
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts', {
        signal: createNew('alerts')
      });
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Alerts fetch failed:', error);
      }
    }
  };

  const handleRefresh = () => {
    // Cancel all current requests and start fresh
    abortAll();
    fetchDashboard();
    fetchMetrics();
    fetchAlerts();
  };

  const handleCancelMetrics = () => {
    // Cancel only metrics request
    abort('metrics');
  };

  return (
    <div>
      <Button onClick={handleRefresh}>Refresh All</Button>
      <Button onClick={handleCancelMetrics}>Cancel Metrics</Button>
      <Button onClick={abortAll}>Cancel All</Button>

      <div>Dashboard: {JSON.stringify(dashboard)}</div>
      <div>Metrics: {JSON.stringify(metrics)}</div>
      <div>Alerts: {JSON.stringify(alerts)}</div>
    </div>
  );
};

// Example 3: Search with debounce and cancellation
const SearchWithAbort = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const { createNew, abort } = useAbortControllers();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    // Debounce search
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      clearTimeout(timer);
      abort('search'); // Cancel previous search
    };
  }, [query]);

  const performSearch = async (searchQuery) => {
    try {
      const response = await fetch(`/api/search?q=${searchQuery}`, {
        signal: createNew('search')
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      if (error.name !== 'AbortError') {
        message.error('Search failed');
      }
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
};

export {
  SimpleComponentWithAbort,
  ComplexComponentWithAbort,
  SearchWithAbort,
};

/**
 * Best Practices:
 *
 * 1. Always cleanup in useEffect
 *    return () => abortAll()
 *
 * 2. Ignore abort errors
 *    if (error.name !== 'AbortError') { ... }
 *
 * 3. Use unique keys for multiple requests
 *    createNew('dashboard'), createNew('metrics')
 *
 * 4. Cancel on component unmount
 *    Prevents "Can't perform state update on unmounted component"
 *
 * 5. Cancel previous requests in useEffect
 *    Prevents race conditions in search/filter
 *
 * 6. Combine with retry logic carefully
 *    Don't retry aborted requests
 */
