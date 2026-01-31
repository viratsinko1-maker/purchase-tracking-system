import { useState, useEffect, Fragment } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";

interface OCRCode {
  id: number;
  code: number;
  name: string;
  remarks: string | null;
  father: number | null;
  lineApproverId: string | null;
  costCenterApproverId: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserProduction {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  isActive: boolean;
}

interface Assignment {
  id: number;
  ocrCodeId: number;
  userProductionId: string;
  role: string;
  createdAt: string;
  user?: UserProduction;
}

interface AssignmentCount {
  ocrCodeId: number;
  count: number;
}

interface Approver {
  id: number;
  ocrCodeId: number;
  userProductionId: string;
  approverType: "line" | "cost_center";
  priority: number;
  createdAt: string;
  user?: UserProduction;
}

type TabType = "members" | "approvers";

export default function Workflow() {
  const router = useRouter();
  const { user, requireAuth, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("members");
  const [ocrCodes, setOcrCodes] = useState<OCRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Expand/Collapse state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Assignment state
  const [assignmentCounts, setAssignmentCounts] = useState<Map<number, number>>(new Map());
  const [assignments, setAssignments] = useState<Map<number, Assignment[]>>(new Map());
  const [loadingAssignments, setLoadingAssignments] = useState<Set<number>>(new Set());

  // User selection modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedOcrCode, setSelectedOcrCode] = useState<OCRCode | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProduction[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [addingUser, setAddingUser] = useState<string | null>(null);

  // Approvers state (new multi-approver system)
  const [approvers, setApprovers] = useState<Map<number, Approver[]>>(new Map());
  const [addingApprover, setAddingApprover] = useState<{ ocrId: number; type: "line" | "cost_center"; userId: string } | null>(null);
  const [removingApprover, setRemovingApprover] = useState<number | null>(null);

  // User map for quick lookup
  const [userMap, setUserMap] = useState<Map<string, UserProduction>>(new Map());

  useEffect(() => {
    requireAuth();
  }, [requireAuth]);

  // Admin-only access
  useEffect(() => {
    if (!authLoading && user && user.role !== 'Admin') {
      void router.replace('/');
    }
  }, [user, authLoading, router]);

  // Fetch OCR Codes
  const fetchOCRCodes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/ocr-codes");
      const data = await response.json();
      if (data.success) {
        setOcrCodes(data.data);
      }
    } catch (error) {
      console.error("Error fetching OCR codes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch assignment counts
  const fetchAssignmentCounts = async () => {
    try {
      const response = await fetch("/api/admin/ocr-user-assignments");
      const data = await response.json();
      if (data.success) {
        const countMap = new Map<number, number>();
        data.data.forEach((item: AssignmentCount) => {
          countMap.set(item.ocrCodeId, item.count);
        });
        setAssignmentCounts(countMap);
      }
    } catch (error) {
      console.error("Error fetching assignment counts:", error);
    }
  };

  // Fetch all assignments for approver tab
  const fetchAllAssignments = async () => {
    try {
      const response = await fetch("/api/admin/ocr-user-assignments?all=true");
      const data = await response.json();
      if (data.success && data.data) {
        const newAssignments = new Map<number, Assignment[]>();
        // Group by ocrCodeId
        data.data.forEach((assignment: Assignment) => {
          const existing = newAssignments.get(assignment.ocrCodeId) || [];
          existing.push(assignment);
          newAssignments.set(assignment.ocrCodeId, existing);
        });
        setAssignments(newAssignments);
      }
    } catch (error) {
      console.error("Error fetching all assignments:", error);
    }
  };

  // Fetch all approvers
  const fetchAllApprovers = async () => {
    try {
      const response = await fetch("/api/admin/ocr-approvers?all=true");
      const data = await response.json();
      if (data.success && data.data) {
        const newApprovers = new Map<number, Approver[]>();
        // Group by ocrCodeId
        data.data.forEach((approver: Approver) => {
          const existing = newApprovers.get(approver.ocrCodeId) || [];
          existing.push(approver);
          newApprovers.set(approver.ocrCodeId, existing);
        });
        setApprovers(newApprovers);
      }
    } catch (error) {
      console.error("Error fetching approvers:", error);
    }
  };

  // Add approver
  const addApprover = async (ocrCodeId: number, userProductionId: string, approverType: "line" | "cost_center") => {
    setAddingApprover({ ocrId: ocrCodeId, type: approverType, userId: userProductionId });
    try {
      const response = await fetch("/api/admin/ocr-approvers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrCodeId,
          userProductionId,
          approverType,
          createdBy: user?.name || user?.username,
        }),
      });

      if (response.ok) {
        await fetchAllApprovers();
      } else {
        const data = await response.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error adding approver:", error);
      alert("เกิดข้อผิดพลาดในการเพิ่มผู้อนุมัติ");
    } finally {
      setAddingApprover(null);
    }
  };

  // Remove approver
  const removeApprover = async (approverId: number) => {
    setRemovingApprover(approverId);
    try {
      const response = await fetch("/api/admin/ocr-approvers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: approverId }),
      });

      if (response.ok) {
        await fetchAllApprovers();
      } else {
        const data = await response.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error removing approver:", error);
      alert("เกิดข้อผิดพลาดในการลบผู้อนุมัติ");
    } finally {
      setRemovingApprover(null);
    }
  };

  // Fetch assignments for specific OCR code
  const fetchAssignments = async (ocrCodeId: number) => {
    setLoadingAssignments((prev) => new Set(prev).add(ocrCodeId));
    try {
      const response = await fetch(`/api/admin/ocr-user-assignments?ocrCodeId=${ocrCodeId}`);
      const data = await response.json();
      if (data.success) {
        setAssignments((prev) => {
          const newMap = new Map(prev);
          newMap.set(ocrCodeId, data.data);
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoadingAssignments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ocrCodeId);
        return newSet;
      });
    }
  };

  // Fetch available users
  const fetchAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/admin/users-production");
      const data = await response.json();
      if (data.users) {
        const activeUsers = data.users.filter((u: UserProduction) => u.isActive);
        setAvailableUsers(activeUsers);
        // Build user map for quick lookup
        const map = new Map<string, UserProduction>();
        activeUsers.forEach((u: UserProduction) => map.set(u.id, u));
        setUserMap(map);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchOCRCodes();
      void fetchAssignmentCounts();
      void fetchAvailableUsers();
    }
  }, [user]);

  // Fetch all assignments and approvers when switching to approvers tab
  useEffect(() => {
    if (user && activeTab === "approvers") {
      void fetchAllAssignments();
      void fetchAllApprovers();
    }
  }, [user, activeTab]);

  // Toggle row expand/collapse
  const toggleRow = async (ocrCodeId: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(ocrCodeId)) {
      newExpandedRows.delete(ocrCodeId);
    } else {
      newExpandedRows.add(ocrCodeId);
      // Fetch assignments if not already loaded
      if (!assignments.has(ocrCodeId)) {
        await fetchAssignments(ocrCodeId);
      }
    }
    setExpandedRows(newExpandedRows);
  };

  // Open user selection modal
  const openUserModal = (ocrCode: OCRCode) => {
    setSelectedOcrCode(ocrCode);
    setUserSearchTerm("");
    setShowUserModal(true);
    if (availableUsers.length === 0) {
      void fetchAvailableUsers();
    }
  };

  // Add user to OCR code
  const addUserToOcr = async (userProductionId: string) => {
    if (!selectedOcrCode) return;

    setAddingUser(userProductionId);
    try {
      const response = await fetch("/api/admin/ocr-user-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrCodeId: selectedOcrCode.id,
          userProductionId,
          role: "member",
          createdBy: user?.name || user?.username,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        // Refresh assignments for this OCR code
        await fetchAssignments(selectedOcrCode.id);
        await fetchAssignmentCounts();
        // Make sure the row is expanded
        setExpandedRows((prev) => new Set(prev).add(selectedOcrCode.id));
      } else {
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("เกิดข้อผิดพลาดในการเพิ่มผู้ใช้");
    } finally {
      setAddingUser(null);
    }
  };

  // Remove user from OCR code
  const removeUserFromOcr = async (assignmentId: number, ocrCodeId: number) => {
    if (!confirm("ต้องการลบผู้ใช้นี้ออกจากแผนกหรือไม่?")) return;

    try {
      const response = await fetch("/api/admin/ocr-user-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assignmentId }),
      });

      if (response.ok) {
        // Refresh assignments
        await fetchAssignments(ocrCodeId);
        await fetchAssignmentCounts();
      } else {
        const data = await response.json();
        alert(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Error removing user:", error);
      alert("เกิดข้อผิดพลาดในการลบผู้ใช้");
    }
  };

  // Sync from SAP
  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const response = await fetch("/api/admin/ocr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResult({ success: true, message: data.message });
        await fetchOCRCodes();
      } else {
        setSyncResult({ success: false, message: data.error || "Sync ล้มเหลว" });
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncResult({ success: false, message: "เกิดข้อผิดพลาดในการ Sync" });
    } finally {
      setSyncing(false);
      setShowSyncModal(true);
    }
  };

  // Filter OCR codes by search term
  const filteredCodes = ocrCodes.filter((code) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      code.name.toLowerCase().includes(searchLower) ||
      (code.remarks && code.remarks.toLowerCase().includes(searchLower)) ||
      code.code.toString().includes(searchTerm)
    );
  });

  // Filter available users by search term and exclude already assigned
  const getFilteredUsers = () => {
    if (!selectedOcrCode) return [];
    const assignedUserIds = new Set(
      (assignments.get(selectedOcrCode.id) || []).map((a) => a.userProductionId)
    );
    return availableUsers.filter((u) => {
      if (assignedUserIds.has(u.id)) return false;
      const searchLower = userSearchTerm.toLowerCase();
      return (
        (u.username?.toLowerCase().includes(searchLower) || false) ||
        (u.name?.toLowerCase().includes(searchLower) || false) ||
        u.email.toLowerCase().includes(searchLower)
      );
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get user display name
  const getUserDisplayName = (userId: string | null) => {
    if (!userId) return null;
    const u = userMap.get(userId);
    return u ? (u.username || u.name || u.email) : userId;
  };

  // Get department members for approver selection
  const getDepartmentMembers = (ocrCodeId: number): UserProduction[] => {
    const departmentAssignments = assignments.get(ocrCodeId) || [];
    return departmentAssignments
      .map((a) => a.user)
      .filter((u): u is UserProduction => u !== undefined && u.isActive);
  };

  // Get approvers by OCR code and type
  const getApprovers = (ocrCodeId: number, approverType: "line" | "cost_center"): Approver[] => {
    const ocrApprovers = approvers.get(ocrCodeId) || [];
    return ocrApprovers
      .filter((a) => a.approverType === approverType)
      .sort((a, b) => a.priority - b.priority);
  };

  // Check if user is already an approver of this type
  const isApprover = (ocrCodeId: number, userId: string, approverType: "line" | "cost_center"): boolean => {
    const ocrApprovers = approvers.get(ocrCodeId) || [];
    return ocrApprovers.some((a) => a.userProductionId === userId && a.approverType === approverType);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return null;
  }

  // Not admin - show access denied briefly before redirect
  if (user.role !== 'Admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-600">หน้านี้สำหรับ Admin เท่านั้น</p>
          <p className="text-sm text-gray-500 mt-2">กำลังนำทางกลับ...</p>
        </div>
      </div>
    );
  }

  const isAdmin = true; // Only admins reach here

  return (
    <>
      <Head>
        <title>Workflow - OCR Codes</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Workflow</h1>
          <p className="mt-1 text-sm text-gray-600">
            รายการรหัสแผนก/ศูนย์ต้นทุน (OCR Code) จาก SAP
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("members")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "members"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              สมาชิกแผนก
            </button>
            <button
              onClick={() => setActiveTab("approvers")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "approvers"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              ตั้งค่าผู้อนุมัติ
            </button>
          </nav>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="w-full sm:w-96">
            <input
              type="text"
              placeholder="ค้นหารหัสหรือชื่อแผนก..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Sync Button - Only for Admin */}
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg bg-green-600 px-6 py-2 text-white font-medium hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลัง Sync...
                </span>
              ) : (
                "Sync จาก SAP"
              )}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-500">รหัสแผนกทั้งหมด</p>
            <p className="text-2xl font-bold text-blue-600">{ocrCodes.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-500">ผลการค้นหา</p>
            <p className="text-2xl font-bold text-green-600">{filteredCodes.length}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-500">Sync ล่าสุด</p>
            <p className="text-sm font-medium text-gray-700">
              {ocrCodes.length > 0 && ocrCodes[0]?.lastSyncAt
                ? formatDate(ocrCodes[0].lastSyncAt)
                : "-"}
            </p>
          </div>
        </div>

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">

                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      รหัสแผนก (OCR)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อแผนก/หน่วยงาน
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parent
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สมาชิก
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จัดการ
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCodes.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-gray-500">
                        {ocrCodes.length === 0
                          ? "ยังไม่มีข้อมูล กรุณากด Sync จาก SAP"
                          : "ไม่พบข้อมูลที่ค้นหา"}
                      </td>
                    </tr>
                  ) : (
                    filteredCodes.map((code, index) => (
                      <Fragment key={code.id}>
                        {/* Main Row */}
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer ${
                            expandedRows.has(code.id) ? "bg-blue-50" : ""
                          }`}
                          onClick={() => toggleRow(code.id)}
                        >
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <span className="text-lg">
                              {expandedRows.has(code.id) ? "▼" : "▶"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                            {code.code}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-block rounded px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800">
                              {code.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {code.remarks || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                            {code.father ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`inline-flex items-center justify-center min-w-[28px] rounded-full px-2 py-1 text-xs font-semibold ${
                              (assignmentCounts.get(code.id) || 0) > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {assignmentCounts.get(code.id) || 0}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-sm text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openUserModal(code);
                                }}
                                className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                              >
                                + เพิ่มคน
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Expanded Row - User List */}
                        {expandedRows.has(code.id) && (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} className="bg-gray-50 px-4 py-4">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                  รายชื่อสมาชิกในแผนก {code.remarks || code.name}
                                </h4>

                                {loadingAssignments.has(code.id) ? (
                                  <div className="flex items-center gap-2 text-gray-500">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                                    กำลังโหลด...
                                  </div>
                                ) : (assignments.get(code.id)?.length || 0) === 0 ? (
                                  <p className="text-sm text-gray-500 italic">
                                    ยังไม่มีสมาชิกในแผนกนี้
                                    {isAdmin && (
                                      <button
                                        onClick={() => openUserModal(code)}
                                        className="ml-2 text-indigo-600 hover:text-indigo-800 underline"
                                      >
                                        เพิ่มสมาชิก
                                      </button>
                                    )}
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {assignments.get(code.id)?.map((assignment) => (
                                      <div
                                        key={assignment.id}
                                        className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                                            {(assignment.user?.username || assignment.user?.email || "?").charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-gray-900">
                                              {assignment.user?.username || assignment.user?.name || "-"}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {assignment.user?.email}
                                            </p>
                                          </div>
                                        </div>
                                        {isAdmin && (
                                          <button
                                            onClick={() => removeUserFromOcr(assignment.id, code.id)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                            title="ลบออกจากแผนก"
                                          >
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Approvers Tab */}
        {activeTab === "approvers" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">ตั้งค่าผู้อนุมัติ</h3>
              <p className="text-sm text-gray-600">กำหนดผู้อนุมัติตามสายงานและผู้อนุมัติตาม Cost Center สำหรับแต่ละแผนก</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      รหัสแผนก (OCR)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ชื่อแผนก/หน่วยงาน
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สมาชิก
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                      ผู้อนุมัติตามสายงาน
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[250px]">
                      ผู้อนุมัติตาม Cost Center
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCodes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        {ocrCodes.length === 0
                          ? "ยังไม่มีข้อมูล กรุณากด Sync จาก SAP"
                          : "ไม่พบข้อมูลที่ค้นหา"}
                      </td>
                    </tr>
                  ) : (
                    filteredCodes.map((code, index) => (
                      <tr key={code.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-block rounded px-3 py-1 text-sm font-medium bg-purple-100 text-purple-800">
                            {code.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {code.remarks || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`inline-flex items-center justify-center min-w-[28px] rounded-full px-2 py-1 text-xs font-semibold ${
                            getDepartmentMembers(code.id).length > 0
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {getDepartmentMembers(code.id).length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="space-y-2">
                            {/* Show existing line approvers as tags */}
                            <div className="flex flex-wrap gap-1">
                              {getApprovers(code.id, "line").map((approver) => (
                                <span
                                  key={approver.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                                >
                                  {approver.user?.username || approver.user?.name || approver.user?.email || "?"}
                                  {isAdmin && (
                                    <button
                                      onClick={() => removeApprover(approver.id)}
                                      disabled={removingApprover === approver.id}
                                      className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                    >
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </span>
                              ))}
                              {getApprovers(code.id, "line").length === 0 && !isAdmin && (
                                <span className="text-gray-400 text-xs">ไม่ได้ระบุ</span>
                              )}
                            </div>
                            {/* Add approver dropdown for admin */}
                            {isAdmin && getDepartmentMembers(code.id).length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    void addApprover(code.id, e.target.value, "line");
                                  }
                                }}
                                disabled={addingApprover?.ocrId === code.id && addingApprover?.type === "line"}
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                              >
                                <option value="">+ เพิ่มผู้อนุมัติ</option>
                                {getDepartmentMembers(code.id)
                                  .filter((u) => !isApprover(code.id, u.id, "line"))
                                  .map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.username || u.name || u.email}
                                    </option>
                                  ))}
                              </select>
                            )}
                            {isAdmin && getDepartmentMembers(code.id).length === 0 && (
                              <span className="text-gray-400 text-xs italic">ยังไม่มีสมาชิกในแผนก</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="space-y-2">
                            {/* Show existing cost center approvers as tags */}
                            <div className="flex flex-wrap gap-1">
                              {getApprovers(code.id, "cost_center").map((approver) => (
                                <span
                                  key={approver.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
                                >
                                  {approver.user?.username || approver.user?.name || approver.user?.email || "?"}
                                  {isAdmin && (
                                    <button
                                      onClick={() => removeApprover(approver.id)}
                                      disabled={removingApprover === approver.id}
                                      className="ml-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                                    >
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </span>
                              ))}
                              {getApprovers(code.id, "cost_center").length === 0 && !isAdmin && (
                                <span className="text-gray-400 text-xs">ไม่ได้ระบุ</span>
                              )}
                            </div>
                            {/* Add approver dropdown for admin */}
                            {isAdmin && getDepartmentMembers(code.id).length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    void addApprover(code.id, e.target.value, "cost_center");
                                  }
                                }}
                                disabled={addingApprover?.ocrId === code.id && addingApprover?.type === "cost_center"}
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                              >
                                <option value="">+ เพิ่มผู้อนุมัติ</option>
                                {getDepartmentMembers(code.id)
                                  .filter((u) => !isApprover(code.id, u.id, "cost_center"))
                                  .map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.username || u.name || u.email}
                                    </option>
                                  ))}
                              </select>
                            )}
                            {isAdmin && getDepartmentMembers(code.id).length === 0 && (
                              <span className="text-gray-400 text-xs italic">ยังไม่มีสมาชิกในแผนก</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* User Selection Modal */}
      {showUserModal && selectedOcrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                เพิ่มสมาชิกในแผนก
              </h3>
              <p className="text-sm text-gray-600">
                {selectedOcrCode.remarks || selectedOcrCode.name} ({selectedOcrCode.name})
              </p>
            </div>

            {/* Search */}
            <div className="px-6 py-3 border-b">
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือ email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                </div>
              ) : getFilteredUsers().length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {userSearchTerm ? "ไม่พบผู้ใช้ที่ค้นหา" : "ไม่มีผู้ใช้ที่สามารถเพิ่มได้"}
                </p>
              ) : (
                <div className="space-y-2">
                  {getFilteredUsers().map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold">
                          {(u.username || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {u.username || u.name || "-"}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => addUserToOcr(u.id)}
                        disabled={addingUser === u.id}
                        className={`rounded px-4 py-2 text-sm font-medium text-white ${
                          addingUser === u.id
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        {addingUser === u.id ? "กำลังเพิ่ม..." : "เพิ่ม"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t px-6 py-4">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setSelectedOcrCode(null);
                }}
                className="w-full rounded-lg bg-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-400"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Result Modal */}
      {showSyncModal && syncResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              {syncResult.success ? (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {syncResult.success ? "Sync สำเร็จ" : "Sync ล้มเหลว"}
              </h3>
              <p className="text-center text-gray-600 mb-6">{syncResult.message}</p>
              <button
                onClick={() => setShowSyncModal(false)}
                className={`w-full rounded-md px-6 py-3 text-white font-medium transition ${
                  syncResult.success
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
