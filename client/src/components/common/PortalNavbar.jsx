import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Clock, Calendar, Bell, User,
  MonitorCheck, Users, Shield, Settings, ClipboardList,
  LogOut, ChevronDown, Menu, X, Sun, Moon, Lightbulb,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useRestartTour } from "./TourGuide";
import NotificationBell from "./NotificationBell";
import { cn } from "../../utils/scoreHelpers";

const workerLinks = [
  { to: "/portal/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/portal/submit-report", label: "Submit",        icon: FileText },
  { to: "/portal/my-reports",    label: "My Reports",    icon: Clock },
  { to: "/portal/roster",        label: "My Roster",     icon: Calendar },
  { to: "/portal/front-desk",    label: "Front Desk",    icon: MonitorCheck },
];

const adminLinks = [
  { to: "/admin/dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { to: "/admin/workers",     label: "Workers",      icon: Users },
  { to: "/admin/reports",     label: "Reports",      icon: FileText },
  { to: "/admin/qualification", label: "Qualify",    icon: Shield },
  { to: "/admin/roster",      label: "Roster",       icon: Calendar },
  { to: "/admin/portal",      label: "Portal",       icon: Settings },
  { to: "/admin/report-types", label: "Report Types", icon: ClipboardList },
  { to: "/portal/front-desk", label: "Front Desk",   icon: MonitorCheck },
  { to: "/admin/attendance",  label: "Attendance",   icon: Users },
];

const roleBadge = {
  pastor:    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  admin:     "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  moderator: "bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400",
  worker:    "bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-400",
};

const PortalNavbar = () => {
  const { user, logout, isAdminLevel } = useAuth();
  const navigate = useNavigate();
  const restartTour = useRestartTour();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => document.body.classList.contains("dark"));

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.body.classList.toggle("dark", next);
    localStorage.setItem("yahal_theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const links = isAdminLevel ? adminLinks : workerLinks;
  const initials = user?.fullName?.charAt(0)?.toUpperCase() || "?";
  const firstName = user?.fullName?.split(" ")[0] || "";

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">

            {/* Logo */}
            <Link
              to={isAdminLevel ? "/admin/dashboard" : "/portal/dashboard"}
              className="flex-shrink-0"
            >
              <img src="/yahal.png" alt="Yachal House" className="h-9 w-auto" />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 overflow-hidden">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                    isActive
                      ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                      : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1 ml-auto">
              {/* Dark mode */}
              <button
                onClick={toggleDark}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Toggle theme"
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 leading-none">{firstName}</p>
                    {user?.workerId && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-none mt-0.5">{user.workerId}</p>
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-10 z-40 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 animate-slide-down">
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{user?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", roleBadge[user?.role] || roleBadge.worker)}>
                            {user?.role}
                          </span>
                          {user?.workerId && (
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">{user.workerId}</span>
                          )}
                        </div>
                      </div>

                      {/* Switch view for admin */}
                      {isAdminLevel && (
                        <Link
                          to="/portal/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4 text-green-500" />
                          Worker View
                        </Link>
                      )}

                      <Link
                        to="/portal/notifications"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Bell className="w-4 h-4 text-blue-500" />
                        Notifications
                      </Link>

                      <Link
                        to="/portal/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <User className="w-4 h-4 text-purple-500" />
                        My Profile
                      </Link>

                      <button
                        onClick={restartTour}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 w-full text-left transition-colors"
                      >
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Restart Tour
                      </button>

                      <div className="border-t border-gray-100 dark:border-slate-700 my-1" />

                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-screen-xl mx-auto px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {links.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                        : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{user?.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">{user?.role} {user?.workerId && `· ${user.workerId}`}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default PortalNavbar;