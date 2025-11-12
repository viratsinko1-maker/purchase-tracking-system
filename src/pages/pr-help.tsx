import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

export default function PRHelp() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>("overview");

  const sections = [
    { id: "overview", title: "ภาพรวม", icon: "📋" },
    { id: "roles", title: "Role และสิทธิ์", icon: "🔐" },
    { id: "qa", title: "PR Q&A", icon: "💬" },
    { id: "search", title: "การค้นหา PR", icon: "🔍" },
    { id: "filter", title: "การกรอง PR", icon: "🎯" },
    { id: "tracking", title: "การติดตาม PR", icon: "📝" },
    { id: "detail", title: "ดูรายละเอียด PR", icon: "👁️" },
    { id: "sync", title: "Sync ข้อมูล", icon: "🔄" },
    { id: "attachment", title: "ไฟล์แนบ", icon: "📎" },
  ];

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
              <div className="bg-white rounded-lg shadow-sm p-4 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">หัวข้อ</h2>
                <nav className="space-y-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg transition flex items-center gap-2 ${
                        activeSection === section.id
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      <span className="text-xl">{section.icon}</span>
                      <span>{section.title}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm p-6">

                {/* 1. ภาพรวม */}
                {activeSection === "overview" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>📋</span> ภาพรวมระบบ PR Tracking
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-4">
                        ระบบ PR Tracking เป็นระบบสำหรับติดตามสถานะของใบขอซื้อ (Purchase Request - PR)
                        ตั้งแต่เปิด PR จนถึงการออก PO (Purchase Order) พร้อมระบบบันทึกการติดตามงาน
                      </p>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <h3 className="font-semibold text-blue-900 mb-2">ฟีเจอร์หลัก:</h3>
                      <ul className="space-y-2 text-blue-800">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500">✓</span>
                          <span>ค้นหาและกรอง PR ตามเงื่อนไขต่างๆ</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500">✓</span>
                          <span>ดูสถานะความคืบหน้า (มี PO หรือยัง)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500">✓</span>
                          <span>บันทึกการติดตามพร้อมระดับความเร่งด่วน</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500">✓</span>
                          <span>ดูรายละเอียด PR และไฟล์แนบ</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-500">✓</span>
                          <span>ซิงค์ข้อมูลจาก SAP อัตโนมัติ</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 2. Role และสิทธิ์การใช้งาน */}
                {activeSection === "roles" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🔐</span> ระบบ Role และสิทธิ์การใช้งาน
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        ระบบมีการแบ่งสิทธิ์การใช้งานตาม Role (บทบาท) ของผู้ใช้ แต่ละ Role มีสิทธิ์ในการใช้งานที่แตกต่างกัน
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Admin Role */}
                      <div className="border-2 border-purple-200 rounded-lg p-5 bg-gradient-to-r from-purple-50 to-purple-100">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">👑</span>
                          <div>
                            <h3 className="text-xl font-bold text-purple-900">Admin (ผู้ดูแลระบบ)</h3>
                            <p className="text-sm text-purple-700">สิทธิ์สูงสุด ควบคุมทุกอย่างในระบบ</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 mt-3">
                          <h4 className="font-semibold text-purple-900 mb-3">สิทธิ์ทั้งหมด:</h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ดู/ค้นหา/กรอง PR และ PO ได้ทั้งหมด</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ถามและตอบคำถามได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>บันทึกการติดตาม PR ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>บันทึกสถานะการส่งของ PO ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>เปิดไฟล์แนบ PR และ PO ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-semibold text-purple-700">จัดการผู้ใช้ (เพิ่ม/แก้ไข/ลบ)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-semibold text-purple-700">ดูประวัติการใช้งาน (Activity Trail)</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Manager Role */}
                      <div className="border-2 border-blue-200 rounded-lg p-5 bg-gradient-to-r from-blue-50 to-blue-100">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">👔</span>
                          <div>
                            <h3 className="text-xl font-bold text-blue-900">Manager (ผู้จัดการ)</h3>
                            <p className="text-sm text-blue-700">ตอบคำถามได้ แต่ถามไม่ได้</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 mt-3">
                          <h4 className="font-semibold text-blue-900 mb-3">สิทธิ์การใช้งาน:</h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ดู/ค้นหา/กรอง PR และ PO ได้ทั้งหมด</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-semibold">ตอบคำถามในระบบ PR Q&A ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">ถามคำถามไม่ได้ (แต่อ่านได้)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>บันทึกสถานะการส่งของ PO ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>เปิดไฟล์แนบ PR และ PO ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">เข้าหน้าจัดการผู้ใช้ไม่ได้</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* POPR Role */}
                      <div className="border-2 border-green-200 rounded-lg p-5 bg-gradient-to-r from-green-50 to-green-100">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">📦</span>
                          <div>
                            <h3 className="text-xl font-bold text-green-900">POPR (เจ้าหน้าที่ PO/PR)</h3>
                            <p className="text-sm text-green-700">ดู PO ได้ แต่ตอบคำถามไม่ได้</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 mt-3">
                          <h4 className="font-semibold text-green-900 mb-3">สิทธิ์การใช้งาน:</h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ดู/ค้นหา/กรอง PR ได้ทั้งหมด</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-semibold">เข้าหน้า PO Tracking ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-semibold">เปิด PO Detail ได้ (แต่ไฟล์แนบ PO กดไม่ได้)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ถามคำถามในระบบ PR Q&A ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">ตอบคำถามไม่ได้ (แต่อ่านได้)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">เปิดไฟล์แนบ PO ไม่ได้ (เห็นชื่อไฟล์เท่านั้น)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>เปิดไฟล์แนบ PR ได้</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* PR Role */}
                      <div className="border-2 border-orange-200 rounded-lg p-5 bg-gradient-to-r from-orange-50 to-orange-100">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">📋</span>
                          <div>
                            <h3 className="text-xl font-bold text-orange-900">PR (เจ้าหน้าที่ PR)</h3>
                            <p className="text-sm text-orange-700">ดู PR ได้ เข้า PO ไม่ได้</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 mt-3">
                          <h4 className="font-semibold text-orange-900 mb-3">สิทธิ์การใช้งาน:</h4>
                          <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ดู/ค้นหา/กรอง PR ได้ทั้งหมด</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>ถามคำถามในระบบ PR Q&A ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-500">✓</span>
                              <span>เปิดไฟล์แนบ PR ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">ตอบคำถามไม่ได้ (แต่อ่านได้)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">เข้าหน้า PO Tracking ไม่ได้</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-red-500">✗</span>
                              <span className="text-gray-500">เปิด PO Detail ไม่ได้ (เห็นเลข PO เป็นสีเทา กดไม่ได้)</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* ตารางเปรียบเทียบ */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-4">📊 ตารางเปรียบเทียบสิทธิ์:</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white rounded-lg overflow-hidden">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ฟีเจอร์</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-purple-700">Admin</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-blue-700">Manager</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-green-700">POPR</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-orange-700">PR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            <tr>
                              <td className="px-4 py-3 text-sm text-gray-700">ดู PR Tracking</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                            </tr>
                            <tr className="bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">ดู PO Tracking</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-gray-700">ถามคำถาม</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                            </tr>
                            <tr className="bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">ตอบคำถาม</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-gray-700">เปิดไฟล์แนบ PR</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                            </tr>
                            <tr className="bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">เปิดไฟล์แนบ PO</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 text-sm text-gray-700">จัดการผู้ใช้</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                            </tr>
                            <tr className="bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">ดู Activity Trail</td>
                              <td className="px-4 py-3 text-center"><span className="text-green-600 text-lg">✓</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                              <td className="px-4 py-3 text-center"><span className="text-red-600 text-lg">✗</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <p className="text-sm text-blue-800">
                        💡 <strong>หมายเหตุ:</strong> ถ้าพยายามเข้าหน้าที่ไม่มีสิทธิ์ ระบบจะแจ้งเตือนและนำกลับไปหน้า PR Tracking
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. PR Q&A - การถามตอบคำถาม */}
                {activeSection === "qa" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>💬</span> PR Q&A - ระบบถามตอบคำถาม
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        ระบบ PR Q&A ช่วยให้สามารถถามและตอบคำถามเกี่ยวกับ PR ได้โดยตรง
                        เพื่อให้การสื่อสารระหว่างทีมงานเป็นไปอย่างรวดเร็วและมีประสิทธิภาพ
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* เข้าหน้า PR Q&A */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📍 เข้าหน้า PR Q&A:</h3>
                        <p className="text-gray-700">คลิกเมนู "PR Q&A" ที่ Sidebar หรือไอคอน 💬 ทางด้านซ้าย</p>
                      </div>

                      {/* สิทธิ์การใช้งาน */}
                      <div className="border-2 border-purple-200 rounded-lg p-5 bg-purple-50">
                        <h3 className="font-semibold text-purple-900 mb-4 text-lg">🔐 สิทธิ์การใช้งาน:</h3>
                        <div className="bg-white rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="text-green-500 text-xl">✓</span>
                            <div>
                              <p className="font-medium text-gray-900">ถามคำถามได้:</p>
                              <p className="text-sm text-gray-600">Admin, POPR, PR (Manager ถามไม่ได้)</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-green-500 text-xl">✓</span>
                            <div>
                              <p className="font-medium text-gray-900">ตอบคำถามได้:</p>
                              <p className="text-sm text-gray-600">Admin, Manager (POPR และ PR ตอบไม่ได้)</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* การกรองดูคำถาม */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">🔍 การกรองดูคำถามในหน้า PR Q&A:</h3>
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">1. กรองตามผู้ติดตาม (Tracked By):</h4>
                            <p className="text-sm text-gray-600 ml-4">พิมพ์ชื่อผู้ที่ถามคำถาม เพื่อดูเฉพาะคำถามจากคนนั้น</p>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">2. กรองตามช่วงเวลา:</h4>
                            <p className="text-sm text-gray-600 ml-4">เลือกวันที่เริ่มต้นและวันที่สิ้นสุด เพื่อดูคำถามในช่วงเวลาที่ต้องการ</p>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">3. กรองตามเลข PR:</h4>
                            <p className="text-sm text-gray-600 ml-4">พิมพ์เลข PR เพื่อดูคำถามเฉพาะ PR นั้น</p>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">4. กรองตามชื่อผู้เปิด PR (Requester Name):</h4>
                            <p className="text-sm text-gray-600 ml-4">พิมพ์ชื่อผู้เปิด PR เพื่อดูคำถามที่เกี่ยวข้องกับ PR ของคนนั้น</p>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">5. กรองตามชื่องาน (Job Name):</h4>
                            <p className="text-sm text-gray-600 ml-4">พิมพ์ชื่องานเพื่อดูคำถามที่เกี่ยวข้องกับงานนั้น</p>
                          </div>

                          <div className="pt-3 border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-2">6. กรองตามสถานะการตอบ:</h4>
                            <div className="ml-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" className="rounded" disabled checked />
                                <span className="text-sm text-gray-700"><strong>ตอบครบแล้ว:</strong> คำถามที่มีการตอบกลับครบทุกรายการ</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" className="rounded" disabled />
                                <span className="text-sm text-gray-700"><strong>ตอบบางส่วน:</strong> คำถามที่มีการตอบกลับบางคำถาม (มีหลายคำถามในหนึ่ง PR)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" className="rounded" disabled />
                                <span className="text-sm text-gray-700"><strong>ยังไม่ตอบเลย:</strong> คำถามที่ยังไม่มีคำตอบเลย</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* การแสดงผล */}
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h3 className="font-semibold text-gray-900 mb-3">📊 การแสดงผล:</h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>คำถามแต่ละข้อจะแสดงใน Card พร้อมระดับความเร่งด่วน</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>คำตอบจะแสดงใต้คำถาม พร้อมชื่อผู้ตอบและเวลาที่ตอบ</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>สามารถตอบได้หลายครั้งต่อคำถามเดียวกัน</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>Card จะมีสีตามระดับความเร่งด่วน (แดง=ด่วนที่สุด, ส้ม=ด่วน, น้ำเงิน=ปกติ)</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <p className="text-sm text-green-800">
                        ✅ <strong>ข้อดี:</strong> ทุกคนในทีมสามารถเห็นคำถามและคำตอบได้ทันที ไม่ต้องถาม-ตอบซ้ำซากกัน
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. การค้นหา PR */}
                {activeSection === "search" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🔍</span> การค้นหา PR
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        มีหลายวิธีในการค้นหา PR ที่ต้องการ:
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* ค้นหาตามเลข PR */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-blue-600">1.</span> ค้นหาด้วยเลข PR
                        </h3>
                        <p className="text-gray-700 mb-3">
                          พิมพ์เลข PR ในช่อง "ค้นหาเลข PR" จะค้นหาแบบบางส่วนได้ เช่น พิมพ์ "251010" จะหา PR ที่มีเลขนี้อยู่
                        </p>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300">
                          <p className="text-sm text-gray-600 mb-1">ตัวอย่าง:</p>
                          <code className="text-sm text-blue-700">พิมพ์: 251010125 → หา PR #251010125</code>
                        </div>
                      </div>

                      {/* ค้นหาตามชื่อผู้เปิด */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-blue-600">2.</span> ค้นหาด้วยชื่อผู้เปิด PR
                        </h3>
                        <p className="text-gray-700 mb-3">
                          พิมพ์ชื่อหรือนามสกุลของผู้เปิด PR ในช่อง "ชื่อผู้เปิด PR"
                        </p>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300">
                          <p className="text-sm text-gray-600 mb-1">ตัวอย่าง:</p>
                          <code className="text-sm text-blue-700">พิมพ์: สมชาย → หาทุก PR ที่เปิดโดยคนชื่อสมชาย</code>
                        </div>
                      </div>

                      {/* ค้นหาตามโครงการ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-blue-600">3.</span> ค้นหาด้วยชื่อโครงการ
                        </h3>
                        <p className="text-gray-700 mb-3">
                          พิมพ์ชื่อโครงการในช่อง "ชื่อโครงการ/งาน"
                        </p>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300">
                          <p className="text-sm text-gray-600 mb-1">ตัวอย่าง:</p>
                          <code className="text-sm text-blue-700">พิมพ์: ซ่อมเครื่องจักร → หา PR ที่เกี่ยวกับงานซ่อมเครื่องจักร</code>
                        </div>
                      </div>

                      {/* ค้นหาตามการติดตาม */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-blue-600">4.</span> ค้นหาจากหมายเหตุการติดตาม
                        </h3>
                        <p className="text-gray-700 mb-3">
                          พิมพ์คำที่มีในหมายเหตุหรือชื่อผู้ติดตาม
                        </p>
                        <div className="bg-gray-50 p-3 rounded border border-gray-300">
                          <p className="text-sm text-gray-600 mb-1">ตัวอย่าง:</p>
                          <code className="text-sm text-blue-700">พิมพ์: รอราคา → หา PR ที่มีหมายเหตุว่ารอราคา</code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                      <p className="text-sm text-yellow-800">
                        💡 <strong>เคล็ดลับ:</strong> สามารถใช้หลายเงื่อนไขร่วมกันได้ เช่น เลือกวันที่ + พิมพ์ชื่อผู้เปิด
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. การกรอง PR */}
                {activeSection === "filter" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🎯</span> การกรอง PR
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        ใช้ตัวกรองเพื่อแสดงเฉพาะ PR ที่ต้องการ:
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* กรองตามวันที่ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📅 กรองตามวันที่</h3>
                        <p className="text-gray-700 mb-3">
                          เลือกช่วงวันที่ที่ต้องการดู (ตั้งค่าเริ่มต้นเป็นเดือนปัจจุบัน)
                        </p>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>วันที่เริ่มต้น:</strong> เลือกวันแรกที่ต้องการดู</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>วันที่สิ้นสุด:</strong> เลือกวันสุดท้ายที่ต้องการดู</span>
                          </li>
                        </ul>
                      </div>

                      {/* กรองตามสถานะ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📊 กรองตามสถานะ PR</h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Open</span>
                            <span>PR ที่ยังเปิดอยู่</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Closed</span>
                            <span>PR ที่ปิดแล้ว</span>
                          </li>
                        </ul>
                      </div>

                      {/* กรองตาม PO */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📦 กรองตามสถานะ PO</h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="text-red-500">•</span>
                            <span><strong>ไม่มี PO เลย:</strong> PR ที่ยังไม่ได้ออก PO เลย</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-orange-500">•</span>
                            <span><strong>PO ยังไม่ครบ:</strong> PR ที่ออก PO บางรายการแล้ว (ยังมีรายการที่รอออก PO)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span><strong>PO ครบ:</strong> PR ที่ออก PO ครบทุกรายการแล้ว (100%)</span>
                          </li>
                        </ul>
                      </div>

                      {/* กรองตามความเร่งด่วน */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">⚡ กรองตามความเร่งด่วน</h3>
                        <p className="text-gray-700 mb-3">
                          เลือกระดับความเร่งด่วนที่ต้องการดู (เลือกได้หลายระดับ):
                        </p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-red-100 text-red-800 text-sm rounded border border-red-200">ด่วนที่สุด</span>
                            <span className="text-gray-700">งานเร่งด่วนมาก ต้องติดตามทันที</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded border border-orange-200">ด่วน</span>
                            <span className="text-gray-700">งานค่อนข้างเร่ง</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded border border-blue-200">ปกติ</span>
                            <span className="text-gray-700">งานปกติทั่วไป</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded border border-gray-200">ปิดแล้ว</span>
                            <span className="text-gray-700">งานเสร็จแล้ว</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <p className="text-sm text-blue-800">
                        💡 <strong>หมายเหตุ:</strong> เมื่อเลือกกรองตามความเร่งด่วน ระบบจะค้นหาย้อนหลัง 12 เดือนอัตโนมัติ
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. การติดตาม PR */}
                {activeSection === "tracking" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>📝</span> การบันทึกติดตาม PR
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        บันทึกการติดตามงานเพื่อให้ทีมงานอื่นๆ รู้ว่า PR นั้นอยู่ในสถานะใด
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* ขั้นตอนการบันทึก */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">ขั้นตอนการบันทึกติดตาม:</h3>
                        <ol className="space-y-3">
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">1</span>
                            <div>
                              <p className="font-medium text-gray-900">คลิกที่ PR Card ที่ต้องการ</p>
                              <p className="text-sm text-gray-600">จะเปิดหน้ารายละเอียดขึ้นมา</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">2</span>
                            <div>
                              <p className="font-medium text-gray-900">กดปุ่ม "📝 ติดตาม PR"</p>
                              <p className="text-sm text-gray-600">จะแสดงฟอร์มบันทึกการติดตาม</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">3</span>
                            <div>
                              <p className="font-medium text-gray-900">เลือกระดับความเร่งด่วน</p>
                              <p className="text-sm text-gray-600">ด่วนที่สุด, ด่วน, ปกติ, หรือปิดแล้ว</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">4</span>
                            <div>
                              <p className="font-medium text-gray-900">กรอกหมายเหตุ (ถ้ามี)</p>
                              <p className="text-sm text-gray-600">เช่น "รอใบเสนอราคา", "ติดต่อซัพพลายเออร์แล้ว"</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">5</span>
                            <div>
                              <p className="font-medium text-gray-900">กรอกชื่อผู้ติดตาม (ถ้าต้องการ)</p>
                              <p className="text-sm text-gray-600">ระบบจะใส่ชื่อผู้เปิด PR ให้อัตโนมัติ</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">6</span>
                            <div>
                              <p className="font-medium text-gray-900">กดปุ่ม "บันทึกการติดตาม"</p>
                              <p className="text-sm text-gray-600">ข้อมูลจะถูกบันทึกและแสดงบน PR Card</p>
                            </div>
                          </li>
                        </ol>
                      </div>

                      {/* ข้อมูลที่แสดงบน PR Card */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">ข้อมูลที่แสดงบน PR Card:</h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>กรอบสี:</strong> สีของกรอบการ์ดจะเปลี่ยนตามระดับความเร่งด่วน (แดง=ด่วนที่สุด, ส้ม=ด่วน, น้ำเงิน=ปกติ)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>Badge:</strong> แสดงระดับความเร่งด่วนข้างเลข PR</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>หมายเหตุ:</strong> แสดงด้วยไอคอน 💬</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span><strong>ผู้ติดตาม:</strong> แสดงด้วยไอคอน 👤</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <p className="text-sm text-green-800">
                        ✅ <strong>ข้อดี:</strong> ทุกคนในทีมสามารถดูสถานะและหมายเหตุการติดตามได้ทันที ไม่ต้องถาม-ตอบกัน
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. ดูรายละเอียด PR */}
                {activeSection === "detail" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>👁️</span> ดูรายละเอียด PR
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        คลิกที่ PR Card เพื่อดูข้อมูลแบบละเอียด
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* ข้อมูลที่มีใน PR Detail */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">ข้อมูลที่แสดงในหน้ารายละเอียด:</h3>

                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">📄 ข้อมูล PR:</h4>
                            <ul className="space-y-1 text-gray-700 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>เลขที่ PR, สถานะ (Open/Closed)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>ผู้เปิด PR, หน่วยงาน</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>วันที่เปิด PR, วันที่ครบกำหนด</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>ชื่องาน, หมายเหตุ</span>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">📦 รายการสินค้า:</h4>
                            <ul className="space-y-1 text-gray-700 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>รหัสสินค้า, ชื่อสินค้า</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>จำนวน, สถานะรายการ</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>เลข PO ที่เชื่อมโยง (คลิกได้เพื่อดูรายละเอียด PO)</span>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">📎 ไฟล์แนบ:</h4>
                            <ul className="space-y-1 text-gray-700 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>รายชื่อไฟล์ที่แนบกับ PR</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>คลิกชื่อไฟล์เพื่อเปิดดู</span>
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">📝 ประวัติการติดตาม:</h4>
                            <ul className="space-y-1 text-gray-700 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>ดูได้ที่แท็บ "ประวัติการอัพเดต"</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>แสดงทุกครั้งที่มีการบันทึกติดตาม</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* ฟีเจอร์พิเศษ */}
                      <div className="border border-gray-200 rounded-lg p-4 bg-purple-50">
                        <h3 className="font-semibold text-purple-900 mb-3">✨ ฟีเจอร์พิเศษ:</h3>
                        <ul className="space-y-2 text-purple-800">
                          <li className="flex items-start gap-2">
                            <span className="text-purple-500">•</span>
                            <span>คลิกที่ PO # สามารถดูรายละเอียด PO ได้ทันที (ซ้อนกันได้ 2 ชั้น)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-purple-500">•</span>
                            <span>ใน PO Detail สามารถคลิกกลับมาดู PR ได้</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Sync ข้อมูล */}
                {activeSection === "sync" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>🔄</span> Sync ข้อมูล
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        ระบบจะซิงค์ข้อมูลจาก SAP มายัง PR Tracking อัตโนมัติ
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* Auto Sync */}
                      <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <h3 className="font-semibold text-green-900 mb-3">🤖 Auto Sync (อัตโนมัติ):</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium text-green-900 mb-2">Full Sync (ซิงค์ข้อมูลทั้งหมด):</p>
                            <ul className="space-y-1 text-green-800 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>07:00 น. - เช้า</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>10:00 น. - ก่อนเที่ยง</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>12:00 น. - เที่ยง</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>15:00 น. - บ่าย</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>17:00 น. - เย็น</span>
                              </li>
                            </ul>
                          </div>
                          <div>
                            <p className="font-medium text-green-900 mb-2">Incremental Sync (ซิงค์เฉพาะที่เปลี่ยนแปลง):</p>
                            <ul className="space-y-1 text-green-800 ml-4">
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>ทุกชั่วโมง (ยกเว้นช่วงเวลาที่ทำ Full Sync)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>เร็วกว่า Full Sync มาก</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Manual Sync */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">🔧 Manual Sync (กดเอง):</h3>
                        <ol className="space-y-3">
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">1</span>
                            <div>
                              <p className="font-medium text-gray-900">กดปุ่ม "🔄 Sync ข้อมูล" มุมบนขวา</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">2</span>
                            <div>
                              <p className="font-medium text-gray-900">ยืนยันการ Sync</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">3</span>
                            <div>
                              <p className="font-medium text-gray-900">รอจนกว่าจะเสร็จ</p>
                              <p className="text-sm text-gray-600">จะมีข้อความแจ้งเมื่อซิงค์เสร็จ</p>
                            </div>
                          </li>
                        </ol>
                      </div>

                      {/* ดูประวัติ Sync */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">📊 ดูประวัติ Sync:</h3>
                        <p className="text-gray-700 mb-3">
                          กดปุ่ม "📋 ประวัติ Sync" เพื่อดูประวัติการซิงค์ข้อมูล:
                        </p>
                        <ul className="space-y-2 text-gray-700 ml-4">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>วันเวลาที่ Sync</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>จำนวนข้อมูลที่ซิงค์</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>เวลาที่ใช้</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>สถานะ (สำเร็จ/ล้มเหลว)</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ <strong>ข้อควรระวัง:</strong> ห้ามกด Manual Sync ขณะที่ Auto Sync กำลังทำงานอยู่
                      </p>
                    </div>
                  </div>
                )}

                {/* 7. ไฟล์แนบ */}
                {activeSection === "attachment" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span>📎</span> ไฟล์แนบ
                      </h2>
                      <p className="text-gray-700 leading-relaxed mb-6">
                        ดูและเปิดไฟล์ที่แนบกับ PR หรือ PO
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* วิธีเปิดไฟล์ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">วิธีเปิดไฟล์แนบ:</h3>
                        <ol className="space-y-3">
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">1</span>
                            <div>
                              <p className="font-medium text-gray-900">เปิดรายละเอียด PR</p>
                              <p className="text-sm text-gray-600">คลิกที่ PR Card</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">2</span>
                            <div>
                              <p className="font-medium text-gray-900">เลื่อนลงมาที่ส่วน "ไฟล์แนบ PR"</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">3</span>
                            <div>
                              <p className="font-medium text-gray-900">คลิกที่ชื่อไฟล์</p>
                              <p className="text-sm text-gray-600">ไฟล์จะเปิดในแท็บใหม่</p>
                            </div>
                          </li>
                        </ol>
                      </div>

                      {/* ประเภทไฟล์ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">การแสดงผลตามประเภทไฟล์:</h3>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 p-3 bg-green-50 rounded">
                            <span className="text-2xl">📄</span>
                            <div>
                              <p className="font-medium text-green-900">PDF</p>
                              <p className="text-sm text-green-700">เปิดในแท็บใหม่ของเบราว์เซอร์ ดูได้ทันที</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded">
                            <span className="text-2xl">🖼️</span>
                            <div>
                              <p className="font-medium text-blue-900">รูปภาพ (JPG, PNG, GIF)</p>
                              <p className="text-sm text-blue-700">เปิดในแท็บใหม่ของเบราว์เซอร์ ดูได้ทันที</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded">
                            <span className="text-2xl">📊</span>
                            <div>
                              <p className="font-medium text-orange-900">Excel (XLSX, XLS)</p>
                              <p className="text-sm text-orange-700">ดาวน์โหลดไฟล์ → เปิดด้วย Excel</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-purple-50 rounded">
                            <span className="text-2xl">📝</span>
                            <div>
                              <p className="font-medium text-purple-900">Word (DOC, DOCX)</p>
                              <p className="text-sm text-purple-700">ดาวน์โหลดไฟล์ → เปิดด้วย Word</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* หมายเหตุ */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">หมายเหตุสำคัญ:</h3>
                        <ul className="space-y-2 text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>ไฟล์ทั้งหมดเก็บอยู่ใน network share ของบริษัท</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>ต้องเชื่อมต่อกับเครือข่ายบริษัทถึงจะเปิดไฟล์ได้</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>ถ้าไม่มีไฟล์แนบจะแสดงข้อความ "ไม่มีไฟล์แนบ"</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
