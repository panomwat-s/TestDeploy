import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 overflow-auto p-6">
        <Outlet />   {/* หน้าปัจจุบันจะมาแสดงตรงนี้ */}
      </main>
    </div>
  );
}
