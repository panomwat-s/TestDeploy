// src/App.jsx
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Assign from "./pages/Assign";
import Timesheet from "./pages/Timesheet";               // ฟอร์มกรอกของงานหนึ่ง
import TimesheetIndex from "./pages/TimesheetIndex";
import UserManagement from "./pages/UserManagement";
import ChangePassword from "./pages/ChangePassword";   // หน้ารวม/เลือกงาน
import AdminRoute from "./router/AdminRoute"; // เพิ่มการ import นี้


import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./router/ProtectedRoute";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* protected + layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assign" element={<Assign />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Timesheet: หน้ารวม + แบบเจาะงาน */}
          <Route path="/timesheet" element={<TimesheetIndex />} />
          <Route path="/timesheet/:taskId" element={<Timesheet />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
