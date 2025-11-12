import { api } from "~/utils/api";

export function useActivityLogger() {
  const logActivity = api.activityTrail.logActivity.useMutation();

  return {
    logLogin: () => {
      logActivity.mutate({
        action: 'LOGIN',
        description: 'ล็อคอินเข้าระบบ',
      });
    },
    logLogout: () => {
      logActivity.mutate({
        action: 'LOGOUT',
        description: 'ออกจากระบบ',
      });
    },
  };
}
