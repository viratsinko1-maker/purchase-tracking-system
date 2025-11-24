import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getComputerName } from "~/utils/getComputerName";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: "",
    name: "",
    password: "",
  });
  const [registerError, setRegisterError] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const computerName = getComputerName();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, computerName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        // Reset username and password fields
        setUsername("");
        setPassword("");
        setLoading(false);
        return;
      }

      // Save user data to sessionStorage (จะหายเมื่อปิด browser)
      sessionStorage.setItem("user", JSON.stringify(data.user));

      // Force full page reload to ensure sessionStorage is loaded
      window.location.href = "/pr-tracking";

    } catch (err) {
      console.error("Login error:", err);
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      // Reset username and password fields
      setUsername("");
      setPassword("");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");
    setRegisterLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setRegisterError(data.error || "เกิดข้อผิดพลาด");
        setRegisterLoading(false);
        return;
      }

      // Success
      setRegisterSuccess(true);
      setRegisterForm({ username: "", name: "", password: "" });

      // Close modal after 3 seconds
      setTimeout(() => {
        setShowRegisterModal(false);
        setRegisterSuccess(false);
      }, 3000);

    } catch (err) {
      console.error("Registration error:", err);
      setRegisterError("เกิดข้อผิดพลาดในการลงทะเบียน");
      setRegisterLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>เข้าสู่ระบบ - PR/PO Tracking</title>
      </Head>

      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800">
              PR/PO Tracking System
            </h1>
            <p className="mt-2 text-gray-600">กรุณาเข้าสู่ระบบ</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700"
              >
                User ID / Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="กรอก User ID หรือ Username"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                placeholder="กรอก Password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            {/* Register Button */}
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="w-full text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              ขอเข้าใช้งาน
            </button>
          </form>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
            <h2 className="mb-6 text-2xl font-bold text-gray-800">
              ขอเข้าใช้งานระบบ
            </h2>

            {registerSuccess ? (
              <div className="rounded-lg bg-green-50 p-6 text-center">
                <div className="mb-4 text-5xl">✅</div>
                <p className="text-lg font-semibold text-green-800">
                  ลงทะเบียนสำเร็จ!
                </p>
                <p className="mt-2 text-sm text-green-600">
                  กรุณารอผู้ดูแลระบบอนุมัติการใช้งาน
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {registerError && (
                  <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                    {registerError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reg-username"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    id="reg-username"
                    value={registerForm.username}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, username: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    placeholder="กรอก Username"
                    required
                    disabled={registerLoading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    ชื่อ-นามสกุล
                  </label>
                  <input
                    type="text"
                    id="reg-name"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, name: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    placeholder="กรอกชื่อ-นามสกุล"
                    required
                    disabled={registerLoading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    id="reg-password"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, password: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    placeholder="กรอก Password"
                    required
                    disabled={registerLoading}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegisterModal(false);
                      setRegisterForm({ username: "", name: "", password: "" });
                      setRegisterError("");
                    }}
                    disabled={registerLoading}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={registerLoading}
                    className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {registerLoading ? "กำลังส่งข้อมูล..." : "ลงทะเบียน"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
