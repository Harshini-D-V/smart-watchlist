/**
 * Lightweight middleware: reads x-user-id header set by the frontend
 * after Supabase anonymous/magic-link auth.
 */
export function requireUserId(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'x-user-id header is required' });
  }
  req.userId = userId;
  next();
}
