import { useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import "../assign.css";

export default function ChangePassword() {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();

    async function submit(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword.length < 6) {
            setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/change-password", {
                old_password: oldPassword,
                new_password: newPassword,
            });
            setSuccess("เปลี่ยนรหัสผ่านเรียบร้อย");
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (e) {
            setError(e.response?.data?.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header - แบบ Assign */}
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                            Change Password
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            เปลี่ยนรหัสผ่านของคุณเพื่อความปลอดภัย
                        </p>
                    </div>
                </header>

                {/* Alert Messages */}
                {error && (
                    <div className="alert-error">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {success}
                    </div>
                )}

                {/* Form Card - แบบ Assign */}
                <section className="card">
                    <div className="card-header">
                        <div className="card-dot" />
                        <h2 className="card-title">ข้อมูลรหัสผ่าน</h2>
                    </div>

                    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">รหัสผ่านเดิม</label>
                            <input
                                type="password"
                                placeholder="กรอกรหัสผ่านเดิม"
                                className="form-input"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="form-label">รหัสผ่านใหม่</label>
                            <input
                                type="password"
                                placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                รหัสผ่านควรมีความยาวอย่างน้อย 6 ตัวอักษร
                            </p>
                        </div>

                        {/* ปุ่มบันทึก */}
                        <div className="md:col-span-2 flex justify-center pt-2">
                            <button
                                type="submit"
                                disabled={loading || !oldPassword || !newPassword}
                                className="bg-blue-600 text-white rounded px-4 py-2 text-sm inline-flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        กำลังบันทึก…
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} className="mr-2" />
                                        บันทึก
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}