import { useState } from "react";
import { useRouter } from "next/router";
import { useSidebar } from "~/contexts/SidebarContext";

interface SubMenuItem {
  name: string;
  path: string;
  icon: string;
}

interface MenuItem {
  name: string;
  path?: string;
  icon: string;
  isBack?: boolean;
  subMenu?: SubMenuItem[];
}

export default function AdminSidebar() {
  const router = useRouter();
  const { isExpanded, toggleSidebar } = useSidebar();
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [subMenuExpanded, setSubMenuExpanded] = useState(true);

  const menuItems: MenuItem[] = [
    {
      name: "กลับหน้าหลัก",
      path: "/pr-tracking",
      icon: "🏠",
      isBack: true,
    },
    {
      name: "จัดการผู้ใช้",
      path: "/admin/users",
      icon: "👥",
    },
    {
      name: "จัดการ Role",
      path: "/admin/roles",
      icon: "🔐",
    },
    {
      name: "จัดการสิทธิ์",
      path: "/admin/permissions",
      icon: "🛡️",
    },
    {
      name: "Audit Trail",
      path: "/admin/audit-trail",
      icon: "📜",
    },
    {
      name: "Workflow",
      path: "/admin/workflow",
      icon: "🔀",
    },
    {
      name: "KPI Dashboard",
      path: "/admin/kpi-dashboard",
      icon: "📊",
    },
    {
      name: "สถิติการใช้งาน",
      path: "/admin/usage-analytics",
      icon: "📈",
    },
    {
      name: "ประวัติ Sync",
      icon: "🔄",
      subMenu: [
        {
          name: "PR Sync",
          path: "/admin/sync-history",
          icon: "📋",
        },
        {
          name: "PO Sync",
          path: "/admin/po-sync-history",
          icon: "📦",
        },
        {
          name: "WO Sync",
          path: "/admin/wo-sync-history",
          icon: "🔧",
        },
        {
          name: "Attachment",
          path: "/admin/attachment-sync-history",
          icon: "📎",
        },
        {
          name: "User Sync",
          path: "/admin/user-sync-history",
          icon: "👤",
        },
      ],
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.subMenu) {
      // Toggle sub-menu sidebar
      if (activeSubMenu === item.name) {
        setActiveSubMenu(null);
      } else {
        setActiveSubMenu(item.name);
      }
    } else if (item.path) {
      setActiveSubMenu(null);
      void router.push(item.path);
    }
  };

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.path) {
      return router.pathname === item.path;
    }
    if (item.subMenu) {
      return item.subMenu.some((sub) => router.pathname === sub.path);
    }
    return false;
  };

  const activeSubMenuData = menuItems.find((item) => item.name === activeSubMenu);

  // Calculate left position for sub-sidebar
  const mainSidebarWidth = isExpanded ? 256 : 64; // w-64 = 256px, w-16 = 64px
  const subSidebarWidth = subMenuExpanded ? 200 : 48;

  return (
    <>
      {/* Main Admin Sidebar */}
      <div
        className={`fixed left-0 top-0 z-40 h-full bg-gray-800 shadow-lg transition-all duration-300 ${
          isExpanded ? "w-64" : "w-16"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Toggle Button */}
          <div className="flex items-center justify-between border-b border-gray-700 p-3">
            <button
              onClick={toggleSidebar}
              className="rounded-lg bg-gray-600 p-2 text-white transition hover:bg-gray-500"
              title={isExpanded ? "ซ่อนข้อความ" : "แสดงข้อความ"}
            >
              {isExpanded ? "◀" : "▶"}
            </button>
          </div>

          {/* Header - Only show when expanded */}
          {isExpanded && (
            <div className="border-b border-gray-700 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Admin Panel</h2>
              <p className="mt-1 text-xs text-gray-400">ระบบหลังบ้าน</p>
            </div>
          )}

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {menuItems.map((item) => {
              const isActive = isMenuActive(item);
              const hasSubMenu = !!item.subMenu;
              const isSubMenuOpen = activeSubMenu === item.name;

              return (
                <button
                  key={item.name}
                  onClick={() => handleMenuClick(item)}
                  className={`group relative flex w-full items-center rounded-lg px-3 py-3 transition ${
                    item.isBack
                      ? "text-blue-400 hover:bg-gray-700 hover:text-blue-300"
                      : isActive || isSubMenuOpen
                      ? "bg-gray-600 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  } ${isExpanded ? "gap-3" : "justify-center"}`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <span className={`text-xl ${isActive ? "font-bold" : ""}`}>
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <>
                      <span className={`flex-1 text-left ${isActive ? "font-semibold" : ""}`}>
                        {item.name}
                      </span>
                      {hasSubMenu && (
                        <span className="text-sm text-gray-400">
                          {isSubMenuOpen ? "◀" : "▶"}
                        </span>
                      )}
                    </>
                  )}

                  {/* Tooltip when collapsed */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-gray-900 px-3 py-1 text-sm text-white group-hover:block z-50">
                      {item.name}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Secondary Sidebar (Sub-menu) */}
      {activeSubMenuData && activeSubMenuData.subMenu && (
        <div
          className={`fixed top-0 z-30 h-full bg-gray-700 shadow-lg transition-all duration-300`}
          style={{ left: `${mainSidebarWidth}px`, width: `${subSidebarWidth}px` }}
        >
          <div className="flex h-full flex-col">
            {/* Sub-sidebar Toggle */}
            <div className="flex items-center justify-between border-b border-gray-600 p-2">
              <button
                onClick={() => setSubMenuExpanded(!subMenuExpanded)}
                className="rounded p-1.5 text-white transition hover:bg-gray-600"
                title={subMenuExpanded ? "ซ่อน" : "แสดง"}
              >
                {subMenuExpanded ? "◀" : "▶"}
              </button>
              {subMenuExpanded && (
                <button
                  onClick={() => setActiveSubMenu(null)}
                  className="rounded p-1.5 text-gray-400 transition hover:bg-gray-600 hover:text-white"
                  title="ปิด"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sub-menu Header */}
            {subMenuExpanded && (
              <div className="border-b border-gray-600 px-3 py-2">
                <h3 className="text-sm font-semibold text-white">{activeSubMenuData.name}</h3>
              </div>
            )}

            {/* Sub-menu Items */}
            <nav className="flex-1 space-y-1 p-2">
              {activeSubMenuData.subMenu.map((subItem) => {
                const isActive = router.pathname === subItem.path;
                return (
                  <button
                    key={subItem.path}
                    onClick={() => void router.push(subItem.path)}
                    className={`group relative flex w-full items-center rounded-lg px-2 py-2 transition ${
                      isActive
                        ? "bg-gray-600 text-white"
                        : "text-gray-300 hover:bg-gray-600 hover:text-white"
                    } ${subMenuExpanded ? "gap-2" : "justify-center"}`}
                    title={!subMenuExpanded ? subItem.name : undefined}
                  >
                    <span className="text-lg">{subItem.icon}</span>
                    {subMenuExpanded && (
                      <span className={`text-sm ${isActive ? "font-semibold" : ""}`}>
                        {subItem.name}
                      </span>
                    )}

                    {/* Tooltip when collapsed */}
                    {!subMenuExpanded && (
                      <div className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-gray-900 px-3 py-1 text-sm text-white group-hover:block z-50">
                        {subItem.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
