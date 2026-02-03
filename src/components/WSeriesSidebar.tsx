import { useRouter } from "next/router";
import { useSidebar } from "~/contexts/SidebarContext";

interface MenuItem {
  name: string;
  path: string;
  icon: string;
  isBack?: boolean;
}

export default function WSeriesSidebar() {
  const router = useRouter();
  const { isExpanded, toggleSidebar } = useSidebar();

  const menuItems: MenuItem[] = [
    {
      name: "กลับหน้าหลัก",
      path: "/pr-tracking",
      icon: "🏠",
      isBack: true,
    },
    {
      name: "WR",
      path: "/w-series/wr",
      icon: "📝",
    },
    {
      name: "WO",
      path: "/w-series/wo",
      icon: "🔧",
    },
    {
      name: "WA",
      path: "/w-series/wa",
      icon: "✅",
    },
    {
      name: "WC",
      path: "/w-series/wc",
      icon: "🏁",
    },
  ];

  return (
    <>
      {/* W Series Sidebar */}
      <div
        className={`fixed left-0 top-0 z-40 h-full bg-teal-800 shadow-lg transition-all duration-300 ${
          isExpanded ? "w-64" : "w-16"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Toggle Button */}
          <div className="flex items-center justify-between border-b border-teal-700 p-3">
            <button
              onClick={toggleSidebar}
              className="rounded-lg bg-teal-600 p-2 text-white transition hover:bg-teal-500"
              title={isExpanded ? "ซ่อนข้อความ" : "แสดงข้อความ"}
            >
              {isExpanded ? "◀" : "▶"}
            </button>
          </div>

          {/* Header - Only show when expanded */}
          {isExpanded && (
            <div className="border-b border-teal-700 px-4 py-3">
              <h2 className="text-lg font-bold text-white">W Series</h2>
              <p className="mt-1 text-xs text-teal-300">Work Order Management</p>
            </div>
          )}

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {menuItems.map((item) => {
              const isActive = router.pathname === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => void router.push(item.path)}
                  className={`group relative flex w-full items-center rounded-lg px-3 py-3 transition ${
                    item.isBack
                      ? "text-blue-300 hover:bg-teal-700 hover:text-blue-200"
                      : isActive
                      ? "bg-teal-600 text-white"
                      : "text-teal-100 hover:bg-teal-700 hover:text-white"
                  } ${isExpanded ? "gap-3" : "justify-center"}`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <span className={`text-xl ${isActive ? "font-bold" : ""}`}>
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <span className={`flex-1 text-left ${isActive ? "font-semibold" : ""}`}>
                      {item.name}
                    </span>
                  )}

                  {/* Tooltip when collapsed */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-teal-900 px-3 py-1 text-sm text-white group-hover:block z-50">
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
