import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../db/supabase';

export interface AuthRequest extends Request {
  userId: string;
  accessToken: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as AuthRequest).userId = user.id;
  (req as AuthRequest).accessToken = token;
  next();
}

// Reads the user's plan from the profiles table and rejects if not on a paid plan.
export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = (req as AuthRequest).userId;
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
