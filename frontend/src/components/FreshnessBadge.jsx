/**
 * Shows "updated Xs ago" or "showing last known price" depending on staleness.
 * Ticks every second via a local interval.
 */

import { useState, useEffect } from 'react';

function secondsAgo(isoString) {
  if (!isoString) return null;
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
}

function formatAge(secs) {
  if (secs === null) return null;
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function FreshnessBadge({ fetchedAt, stale }) {
  const [age, setAge] = useState(() => secondsAgo(fetchedAt));

  useEffect(() => {
    setAge(secondsAgo(fetchedAt));
    const id = setInterval(() => setAge(secondsAgo(fetchedAt)), 1000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  if (!fetchedAt) {
    return <span className="badge badge-stale" aria-label="Price unavailable">no data</span>;
  }

  if (stale) {
    return (
      <span className="badge badge-stale" title={`Last fetched: ${fetchedAt}`}>
        ⚠ last known price
      </span>
    );
  }

  return (
    <span className="badge badge-fresh" title={`Last fetched: ${fetchedAt}`}>
      updated {formatAge(age)}
    </span>
  );
}
