/**
 * Authentication Service
 * NextAuth configuration for EasyPoly
 */

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { getSupabase } from './supabase-server';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        const supabase = getSupabase();

        // Check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();

        if (!existingUser) {
          // Create new user
          await supabase.from('users').insert({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account?.provider,
          });

          console.log('New user created:', user.email);
        } else {
          console.log('User logged in:', user.email);
        }

        return true;
      } catch (error: any) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session, token }) {
      // Add user ID to session
      if (session.user) {
        const supabase = getSupabase();
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .single();

        if (user) {
          (session.user as any).id = user.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Get current user from session
 */
export async function getCurrentUser(request: Request): Promise<any> {
  try {
    // Extract session token from cookies
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;

    // Parse session token
    const sessionToken = cookie
      .split(';')
      .find((c) => c.trim().startsWith('next-auth.session-token='))
      ?.split('=')[1];

    if (!sessionToken) return null;

    // Verify session (simplified - in production use proper JWT verification)
    // This would use NextAuth's session verification
    // For now, we'll return null and let middleware handle it

    return null;
  } catch (error: any) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  const user = await getCurrentUser(request);
  return !!user;
}

/**
 * Require authentication (throw error if not authenticated)
 */
export async function requireAuth(request: Request): Promise<any> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized - please sign in');
  }
  return user;
}
