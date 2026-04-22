import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { supabaseAdmin } from '../db/supabase';

export interface AuthRequest extends Request {
  userId: string;
}

// Bootstrap a brand-new Clerk user's data on their very first request.
async function ensureUserExists(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (data) return; // already exists

  const now = Date.now();
  const DEFAULT_WATCHLIST = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'META', 'AMZN', 'SPY', 'QQQ'];

  await Promise.all([
    supabaseAdmin.from('profiles').insert({ id: userId }),
    supabaseAdmin.from('settings').insert({ user_id: userId }),
    supabaseAdmin.from('watchlist').insert(
      DEFAULT_WATCHLIST.map(symbol => ({ user_id: userId, symbol, added_at: now, is_active: true })),
    ),
  ]);

  console.log(`[Auth] Bootstrapped new user: ${userId}`);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Lazy-create profile + settings + watchlist on first sign-in
  await ensureUserExists(userId);

  (req as AuthRequest).userId = userId;
  next();
}

export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  if (!data || data.plan === 'free') {
    res.status(403).json({ error: 'Upgrade to a paid plan to use this feature' });
    return;
  }
  next();
}
