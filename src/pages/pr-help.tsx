import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  HelpSidebar,
  OverviewSection,
  RolesSection,
  FeaturesSection,
  SearchFilterSection,
  SyncSection,
  AttachmentSection,
  AdminSection,
  FAQSection,
  type HelpSection,
} from "~/components/help";

const sections: HelpSection[] = [
  { id: "overview", title: "ภาพรวม", icon: "📋" },
  { id: "roles", title: "Role และสิทธิ์", icon: "🔐" },
  { id: "features", title: "ฟีเจอร์หลัก", icon: "✨" },
  { id: "search-filter", title: "ค้นหาและกรอง", icon: "🔍" },
  { id: "sync", title: "Sync ข้อมูล", icon: "🔄" },
  { id: "attachment", title: "ไฟล์แนบ", icon: "📎" },
  { id: "admin", title: "Admin Features", icon: "👑" },
  { id: "faq", title: "FAQ / แก้ปัญหา", icon: "❓" },
];

export default function PRHelp() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>("overview");

  return (
    <>
      <Head>
        <title>คู่มือการใช้งาน | PR Tracking</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/pr-tracking")}
                  className="rounded-lg bg-gray-100 p-2 hover:bg-gray-200 transition"
                >
                  <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">คู่มือการใช้งาน PR Tracking</h1>
                  <p className="text-sm text-gray-600">วิธีการใช้งานระบบติดตาม PR แบบง่ายๆ</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Menu */}
            <div className="lg:col-span-1">
              <HelpSidebar
                sections={sections}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6">
                {activeSection === "overview" && <OverviewSection />}
                {activeSection === "roles" && <RolesSection />}
                {activeSection === "features" && <FeaturesSection />}
                {activeSection === "search-filter" && <SearchFilterSection />}
                {activeSection === "sync" && <SyncSection />}
                {activeSection === "attachment" && <AttachmentSection />}
                {activeSection === "admin" && <AdminSection />}
                {activeSection === "faq" && <FAQSection />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
