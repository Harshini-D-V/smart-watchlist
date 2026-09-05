import { useAuth } from './hooks/useAuth.js';
import { WatchlistPage } from './pages/WatchlistPage.jsx';

export default function App() {
  const { userId, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="loading-screen" role="alert">
        <p>Authentication failed. Check your Supabase configuration.</p>
      </div>
    );
  }

  return <WatchlistPage userId={userId} />;
}
