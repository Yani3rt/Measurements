import {createClient, type User} from '@supabase/supabase-js';
import type {RequestHandler} from 'express';

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_ANON_KEY are required to protect API routes.',
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export const requireAuthenticatedUser: RequestHandler = async (
  request,
  response,
  next,
) => {
  const accessToken = getBearerToken(request.header('authorization'));

  if (!accessToken) {
    response.status(401).json({message: 'Authentication required.'});
    return;
  }

  const {data, error} = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    response.status(401).json({message: 'Your session is invalid or expired.'});
    return;
  }

  request.authUser = data.user;
  next();
};

export {};
