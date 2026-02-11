import { useState, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, FileText, FolderOpen, Settings,
  LogOut, ChevronLeft, ChevronRight, Users
} from "lucide-react";

// decode username/email จาก JWT
function getUserFromToken() {
  try {
    const token = localStorage.getItem("mycase_token");
    if (!token) return null;

    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      username: payload.username,
      email: payload.email,
      role: payload.role?.toLowerCase(),
    };
  } catch (err) {
    console.error("Invalid token", err);
    return null;
  }
}


export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openSetting, setOpenSetting] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const me = useMemo(getUserFromToken, [location.pathname]);

  const menuItems = [
    { id: "home", label: "Home", icon: Home, href: "/dashboard" },
    { id: "assign", label: "Assignment", icon: FileText, href: "/assign", adminOnly: true, },
    { id: "timesheet", label: "Time Sheet", icon: FolderOpen, href: "/timesheet" },

  ];

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300 ease-in-out flex flex-col h-screen bg-white border-r border-gray-200 relative shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            INTELLIGIST
          </h1>
        )}
        <button
          onClick={() => setCollapsed(s => !s)}
          className="p-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-all border border-gray-200"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {menuItems
          .filter(item => !item.adminOnly || me?.role === "admin")
          .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.href}
                end
                className={({ isActive }) => `
                flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"}
                ${collapsed ? "justify-center" : ""}
              `}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={20}
                      className={`${collapsed ? "" : "mr-3"} ${isActive
                        ? "text-white"
                        : "text-gray-500 group-hover:text-blue-600"
                        }`}
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

        {/* ===== Setting (with submenu) ===== */}
        <button
          onClick={() => setOpenSetting(s => !s)}
          className={`
            flex items-center w-full px-3 py-2.5 rounded-lg transition-all duration-200
            text-gray-600 hover:bg-blue-50 hover:text-blue-600
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <Settings size={20} className={`${collapsed ? "" : "mr-3"}`} />
          {!collapsed && (
            <>
              <span className="text-sm font-medium">Setting</span>
              <span className="ml-auto text-xs">{openSetting ? "▲" : "▼"}</span>
            </>
          )}
        </button>

        {openSetting && !collapsed && (
          <div className="ml-8 mt-1 space-y-1">

            <NavLink to="/change-password" className="block px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-blue-50">
              Change Password
            </NavLink>

            {me?.role === "admin" && (
              <NavLink
                to="/admin/users"
                className="block px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-blue-50"
              >
                User Management
              </NavLink>
            )}
          </div>
        )}

      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => {
            localStorage.removeItem("mycase_token");
            localStorage.removeItem("user"); // ถ้ามีเก็บ user ไว้
            navigate("/login", { replace: true });
          }}
          className={`flex items-center w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-gray-600 hover:bg-red-50 hover:text-red-600 ${collapsed ? "justify-center" : ""
            }`}
        >
          <LogOut size={20} className={`${collapsed ? "" : "mr-3"}`} />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>

      {/* User Profile */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {(me?.username || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{me?.username}</p>
              <p className="text-xs text-gray-500">{me?.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
