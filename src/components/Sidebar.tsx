import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { useSidebar } from "~/contexts/SidebarContext";
import { useMenuVisibility } from "~/hooks/usePermission";
import { isElevatedRole } from "~/lib/permissions";
import type { PermissionAction } from "~/lib/permissions";

interface MenuItem {
  name: string;
  path: string;
  icon: string;
  permission?: {
    table: string;
    action: PermissionAction;
  };
  adminOnly?: boolean;
  restrictedFor?: string[];
}

export default function Sidebar() {
  const router = useRouter();
  const { user } = useAuth();
  const { isExpanded, toggleSidebar } = useSidebar();

  // Define menu items with permission-based visibility
  const menuItems: MenuItem[] = [
    {
      name: "PR Tracking",
      path: "/pr-tracking",
      icon: "📋",
      permission: { table: "pr_tracking", action: "read" },
    },
    {
      name: "PR Q&A",
      path: "/pr-qa",
      icon: "💬",
      permission: { table: "pr_qa", action: "read" },
    },
    {
      name: "PR Overview",
      path: "/pr-overview",
      icon: "📊",
      permission: { table: "pr_tracking", action: "read" },
    },
    {
      name: "PR Approval",
      path: "/pr-approval",
      icon: "✅",
      permission: { table: "pr_approval", action: "read" },
      // Note: pr_approval.read is set to true for all roles by default
    },
    {
      name: "PO Tracking",
      path: "/po-tracking",
      icon: "📦",
      permission: { table: "po_tracking", action: "read" },
    },
    {
      name: "Receive Good",
      path: "/receive-good",
      icon: "📥",
      permission: { table: "receive_good", action: "read" },
    },
    {
      name: "GR Tracking",
      path: "/gr-tracking",
      icon: "📦",
    },
    {
      name: "Help",
      path: "/pr-help",
      icon: "❓",
      // No permission required for help page
    },
    {
      name: "W Series",
      path: "/w-series/wo",
      icon: "🔧",
      // No permission required - available for all users
    },
    {
      name: "Admin",
      path: "/admin/users",
      icon: "⚙️",
      adminOnly: true, // Only Admin and Approval roles
    },
  ];

  // Use permission-based menu visibility
  const visibleMenuItems = useMenuVisibility(menuItems);

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
