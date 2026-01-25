import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("mycase_token"); // ต้องอ่าน key เดียวกัน
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
