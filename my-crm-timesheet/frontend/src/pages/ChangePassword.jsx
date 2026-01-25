import { useState } from "react";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function submit(e) {
        e.preventDefault();

        if (newPassword.length < 6) {
            return alert("รหัสใหม่อย่างน้อย 6 ตัว");
        }

        setLoading(true);
        try {
            await api.post("/auth/change-password", {
                old_password: oldPassword,
                new_password: newPassword,
            });
            alert("เปลี่ยนรหัสผ่านเรียบร้อย");
            navigate("/dashboard");
        } catch (e) {
            alert(e.response?.data?.error || "เปลี่ยนรหัสไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 max-w-md">
            <h1 className="text-2xl font-bold mb-4">Change Password</h1>

            <form onSubmit={submit} className="space-y-4">
                <input
                    type="password"
                    placeholder="Old password (temp)"
                    className="w-full border px-3 py-2 rounded"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="New password"
                    className="w-full border px-3 py-2 rounded"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />

                <button
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    {loading ? "Saving..." : "Save"}
                </button>
            </form>
        </div>
    );
}
