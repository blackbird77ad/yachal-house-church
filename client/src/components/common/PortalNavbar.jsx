import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, Sun, Moon, ChevronDown, LogOut, User, LayoutDashboard, FileText, Bell, Clock, Users, Calendar, ClipboardList, Shield, MonitorCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import NotificationBell from "./NotificationBell";
import { cn } from "../../utils/scoreHelpers";
import GlobalSearch from "./GlobalSearch";

const PortalNavbar = () => {
  const { user, logout, isAdminLevel } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("yahal_theme") === "dark");

  const handleLogout = () => { logout(); navigate("/"); };
  const toggleDark = () => {
    const d = !dark;
    setDark(d);
    document.body.classList.toggle("dark", d);
    localStorage.setItem("yahal_theme", d ? "dark" : "light");
  };

  const workerLinks = [
    { to: "/portal/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: "/portal/submit-report", label: "Submit Report", icon: <FileText className="w-4 h-4" /> },
    { to: "/portal/my-reports", label: "My Reports", icon: <Clock className="w-4 h-4" /> },
    { to: "/portal/roster", label: "My Roster", icon: <Calendar className="w-4 h-4" /> },
    { to: "/portal/notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { to: "/portal/profile", label: "My Profile", icon: <User className="w-4 h-4" /> },
    { to: "/portal/front-desk", label: "Front Desk", icon: <MonitorCheck className="w-4 h-4" /> },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: "/admin/workers", label: "Workers", icon: <Users className="w-4 h-4" /> },
    { to: "/admin/reports", label: "Reports", icon: <FileText className="w-4 h-4" /> },
    { to: "/admin/qualification", label: "Qualification", icon: <Shield className="w-4 h-4" /> },
    { to: "/admin/roster", label: "Roster", icon: <Calendar className="w-4 h-4" /> },
    { to: "/admin/portal", label: "Portal", icon: <Clock className="w-4 h-4" /> },
    { to: "/admin/report-types", label: "Report Types", icon: <ClipboardList className="w-4 h-4" /> },
    { to: "/portal/notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { to: "/portal/my-reports", label: "My Reports", icon: <Clock className="w-4 h-4" /> },
    { to: "/portal/roster", label: "Roster", icon: <Calendar className="w-4 h-4" /> },
    { to: "/portal/front-desk", label: "Front Desk", icon: <MonitorCheck className="w-4 h-4" /> },
  ];

  const navLinks = isAdminLevel ? adminLinks : workerLinks;

  const roleLabel = { pastor: "Pastor", admin: "Admin", moderator: "Moderator", worker: "Worker" };
  const roleColor = {
    pastor: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    admin: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    moderator: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    worker: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  };

  return (
    <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <div className="flex items-center gap-3">
            <Link to={isAdminLevel ? "/admin/dashboard" : "/portal/dashboard"} className="flex items-center flex-shrink-0">
              <img src="/yahal.png" alt="Yachal House" className="h-10 w-auto" />
            </Link>
            <div className="hidden sm:block h-6 border-l border-gray-200 dark:border-slate-700 pl-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleColor[user?.role] || roleColor.worker}`}>
                {roleLabel[user?.role] || "Worker"}
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                    : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100"
                )}
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <GlobalSearch />
            <NotificationBell />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-none">
                    {user?.fullName?.split(" ")[0]}
                  </p>
                  {user?.workerId && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mt-0.5">
                      ID: {user.workerId}
                    </p>
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-40 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 animate-slide-down py-1">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{user?.email}</p>
                      {user?.workerId && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">ID: {user.workerId}</p>
                      )}
                    </div>
                    {isAdminLevel && (
                      <Link
                        to="/portal/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                      >
                        <LayoutDashboard className="w-4 h-4 text-green-600" />
                        Worker View
                      </Link>
                    )}
                    <Link
                      to="/portal/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <User className="w-4 h-4 text-purple-600" />
                      My Profile
                    </Link>
                    <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                    : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                )}
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 w-full rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default PortalNavbar;