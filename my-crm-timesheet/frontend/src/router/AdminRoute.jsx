// src/components/AdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

// ตรวจสอบว่าผู้ใช้มี role เป็น admin หรือไม่
const AdminRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user")); // ดึงข้อมูล user จาก localStorage

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" />;  // ถ้าไม่ใช่ admin ให้ไปที่หน้า dashboard
  }

  return children;  // ถ้าเป็น admin ให้แสดง children (เช่น หน้า User Management)
};

export default AdminRoute;
