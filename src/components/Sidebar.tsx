import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { useSidebar } from "~/contexts/SidebarContext";

export default function Sidebar() {
  const router = useRouter();
  const { user } = useAuth();
  const { isExpanded, toggleSidebar } = useSidebar();

  const menuItems = [
    {
      name: "PR Tracking",
      path: "/pr-tracking",
      icon: "📋",
    },
    {
      name: "PR Q&A",
      path: "/pr-qa",
      icon: "💬",
    },
    {
      name: "PR Overview",
      path: "/pr-overview",
      icon: "📊",
    },
    {
      name: "PR Approval",
      path: "/pr-approval",
      icon: "✅",
      adminOnly: true, // แสดงเฉพาะ Approval และ Admin
    },
    {
      name: "PO Tracking",
      path: "/po-tracking",
      icon: "📦",
      restrictedFor: ["PR"], // ซ่อนสำหรับ role PR
    },
    {
      name: "W Series",
      path: "/w-series",
      icon: "⚙️",
      restrictedFor: ["PR"], // ซ่อนสำหรับ role PR
    },
    {
      name: "Workflow",
      path: "/workflow",
      icon: "🔀",
    },
    {
      name: "Help",
      path: "/pr-help",
      icon: "❓",
    },
    {
      name: "จัดการผู้ใช้",
      path: "/admin/users",
      icon: "👥",
      adminOnly: true,
    },
  ];

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.adminOnly) {
      // Only show to Admin and Approval users
      return user?.role === "Admin" || user?.role === "Approval";
    }
    if (item.restrictedFor && user?.role) {
      // Hide if user role is in restricted list
      return !item.restrictedFor.includes(user.role);
    }
    return true;
  });

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 z-40 h-full bg-white shadow-lg transition-all duration-300 ${
          isExpanded ? "w-64" : "w-16"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Toggle Button */}
          <div className="flex items-center justify-between border-b p-3">
            <button
              onClick={toggleSidebar}
              className="rounded-lg bg-indigo-600 p-2 text-white transition hover:bg-indigo-700"
              title={isExpanded ? "ซ่อนข้อความ" : "แสดงข้อความ"}
            >
              {isExpanded ? "◀" : "▶"}
            </button>
          </div>

          {/* Header - Only show when expanded */}
          {isExpanded && (
            <div className="border-b px-4 py-3">
              <h2 className="text-lg font-bold text-gray-800">เมนู</h2>
              {user && (
                <p className="mt-1 text-xs text-gray-600 truncate">
                  {user.name || user.username}
                </p>
              )}
            </div>
          )}

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-2">
            {visibleMenuItems.map((item) => {
              const isActive = router.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => void router.push(item.path)}
                  className={`group relative flex w-full items-center rounded-lg px-3 py-3 transition ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  } ${isExpanded ? "gap-3" : "justify-center"}`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <span className={`text-xl ${isActive ? "font-bold" : ""}`}>
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <span className={isActive ? "font-semibold" : ""}>
                      {item.name}
                    </span>
                  )}

                  {/* Tooltip when collapsed */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-gray-800 px-3 py-1 text-sm text-white group-hover:block">
                      {item.name}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
