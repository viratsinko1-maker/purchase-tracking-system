import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { useEffect } from "react";

import { api } from "~/utils/api";
import AuthGuard from "~/components/AuthGuard";

import "~/styles/globals.css";

// เริ่มต้น scheduler เมื่อ app เริ่มทำงาน (client-side)
if (typeof window === 'undefined') {
  // ทำงานฝั่ง server เท่านั้น
  import('~/server/scheduler').then(({ initScheduler }) => {
    initScheduler();
  }).catch(console.error);
}

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className={geist.className}>
        <AuthGuard>
          <Component {...pageProps} />
        </AuthGuard>
      </div>
    </SessionProvider>
  );
};

export default api.withTRPC(MyApp);
