import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"form" | "success" | "error">("form");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!email) {
      setStatus("error");
      setMessage("กรุณากรอก Email");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "เกิดข้อผิดพลาด");
      } else {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
      }
    } catch (err) {
      setStatus("error");
      setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStatus("form");
    setMessage("");
    setEmail("");
  };

  return (
    <>
      <Head>
        <title>ลืมรหัสผ่าน - PR/PO Tracking</title>
      </Head>

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          {status === "success" ? (
            // Success State
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-gray-800">ตรวจสอบอีเมลของคุณ</h2>
              <p className="mb-6 text-gray-600">{message}</p>

              <div className="mb-6 rounded-lg bg-blue-50 p-4 text-left text-sm text-blue-800">
                <p className="mb-2 font-semibold">ขั้นตอนถัดไป:</p>
                <ol className="ml-4 list-decimal space-y-1">
                  <li>ตรวจสอบอีเมลของคุณ (รวมถึง Spam/Junk)</li>
                  <li>คลิกลิงก์ "สร้างรหัสผ่านใหม่" ในอีเมล</li>
                  <li>ตั้งรหัสผ่านใหม่</li>
                  <li>เข้าสู่ระบบด้วยรหัสผ่านใหม่</li>
                </ol>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleReset}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  ส่งอีเมลอีกครั้ง
                </button>
                <Link
                  href="/login"
                  className="block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-center text-gray-700 hover:bg-gray-50"
                >
                  กลับไปหน้าเข้าสู่ระบบ
                </Link>
              </div>
            </div>
          ) : (
            // Form State
            <>
              <div className="mb-6">
                <Link href="/login" className="flex items-center text-sm text-gray-600 hover:text-indigo-600">
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  กลับไปหน้าเข้าสู่ระบบ
                </Link>
              </div>

              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-gray-800">ลืมรหัสผ่าน?</h1>
                <p className="mt-2 text-gray-600">
                  กรอก Email ที่ใช้สมัครเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {status === "error" && message && (
                  <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                    {message}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    placeholder="กรอก Email ของคุณ"
                    required
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    ใส่อีเมลที่ใช้ล็อคอินเข้าระบบ
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
                </button>
              </form>

              <div className="mt-6 rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">หมายเหตุ:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600">
                  <li>ลิงก์รีเซ็ตจะหมดอายุใน 1 ชั่วโมง</li>
                  <li>ตรวจสอบโฟลเดอร์ Spam/Junk หากไม่พบอีเมล</li>
                  <li>หากยังมีปัญหา ติดต่อผู้ดูแลระบบ</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
