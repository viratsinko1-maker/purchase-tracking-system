import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    DiscordProvider,
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
    maxAge: 24 * 60 * 60, // 24 ชั่วโมง (เป็น fallback กรณีที่ browser ไม่ปิด)
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // ไม่กำหนด maxAge หรือ expires = session cookie (จะหายเมื่อปิด browser)
      },
    },
  },
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // Log LOGIN activity
      console.log('[AUTH EVENT] signIn triggered for user:', user.id);
      try {
        const result = await db.activity_trail.create({
          data: {
            user_id: user.id ?? undefined,
            user_name: user.name ?? undefined,
            ip_address: 'unknown', // Will be updated by client-side call
            action: 'LOGIN',
            description: isNewUser ? 'ผู้ใช้ใหม่ล็อคอินครั้งแรก' : 'ล็อคอินเข้าระบบ',
            metadata: {
              provider: account?.provider,
              isNewUser,
            },
            created_at: new Date(),
          },
        });
        console.log('[AUTH EVENT] ✅ LOGIN activity logged, ID:', result.id);
      } catch (error) {
        console.error('[AUTH EVENT] ❌ Failed to log LOGIN activity:', error);
      }
    },
    async signOut(params) {
      // Log LOGOUT activity
      console.log('[AUTH EVENT] signOut triggered');
      try {
        const userId = 'session' in params && (params.session as any)?.user
          ? ((params.session as any).user as any)?.id
          : 'token' in params
          ? (params.token as any)?.sub
          : undefined;

        const userName = 'session' in params && (params.session as any)?.user
          ? ((params.session as any).user.name ?? undefined)
          : undefined;

        console.log('[AUTH EVENT] Logging out user:', userId);

        if (userId) {
          const result = await db.activity_trail.create({
            data: {
              user_id: userId,
              user_name: userName,
              ip_address: 'unknown', // Will be updated by client-side call
              action: 'LOGOUT',
              description: 'ออกจากระบบ',
              created_at: new Date(),
            },
          });
          console.log('[AUTH EVENT] ✅ LOGOUT activity logged, ID:', result.id);
        } else {
          console.log('[AUTH EVENT] ⚠️ No userId found for logout');
        }
      } catch (error) {
        console.error('[AUTH EVENT] ❌ Failed to log LOGOUT activity:', error);
      }
    },
  },
} satisfies NextAuthConfig;
