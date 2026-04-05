// import { useState, useEffect } from "react";
// import { Link, NavLink, useNavigate } from "react-router-dom";
// import { Menu, X, Sun, Moon, ChevronDown, LogOut, User, LayoutDashboard } from "lucide-react";
// import { useAuth } from "../../hooks/useAuth";
// import NotificationBell from "./NotificationBell";
// import { cn } from "../../utils/scoreHelpers";

// const Navbar = () => {
//   const { user, logout, isAdminLevel } = useAuth();
//   const navigate = useNavigate();
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [userMenuOpen, setUserMenuOpen] = useState(false);
//   const [dark, setDark] = useState(() => localStorage.getItem("yahal_theme") === "dark");
//   const [scrolled, setScrolled] = useState(false);

//   useEffect(() => {
//     document.body.classList.toggle("dark", dark);
//     localStorage.setItem("yahal_theme", dark ? "dark" : "light");
//   }, [dark]);

//   useEffect(() => {
//     const handleScroll = () => setScrolled(window.scrollY > 10);
//     window.addEventListener("scroll", handleScroll);
//     return () => window.removeEventListener("scroll", handleScroll);
//   }, []);

//   const handleLogout = () => {
//     logout();
//     navigate("/");
//   };

//   const publicLinks = [
//     { to: "/", label: "Home" },
//     { to: "/service-times", label: "Service Times" },
//     { to: "/location", label: "Find Us" },
//     { to: "/contact", label: "Contact" },
//     { to: "/media", label: "Media" },
//   ];

//   return (
//     <nav
//       className={cn(
//         "sticky top-0 z-40 w-full transition-all duration-300",
//         scrolled ? "shadow-lg shadow-purple-900/30" : ""
//       )}
//       style={{
//         background: scrolled
//           ? "linear-gradient(135deg, #4c1d95 0%, #7B5EA7 50%, #3B6D11 100%)"
//           : "linear-gradient(135deg, #3b0764 0%, #6d28d9 40%, #7B5EA7 70%, #3B6D11 100%)",
//       }}
//     >
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="flex items-center justify-between h-16">

//           <Link to="/" className="flex items-center flex-shrink-0">
//             <img src="/yahal.png" alt="Yachal House" className="h-12 w-auto drop-shadow-md" />
//           </Link>

//           <div className="hidden lg:flex items-center gap-1">
//             {publicLinks.map((link) => (
//               <NavLink
//                 key={link.to}
//                 to={link.to}
//                 className={({ isActive }) => cn(
//                   "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
//                   isActive
//                     ? "bg-white/25 text-white font-semibold shadow-sm"
//                     : "text-purple-100 hover:bg-white/15 hover:text-white"
//                 )}
//               >
//                 {link.label}
//               </NavLink>
//             ))}
//           </div>

//           <div className="flex items-center gap-2">
//             <button
//               onClick={() => setDark(!dark)}
//               className="p-2 rounded-lg text-purple-200 hover:bg-white/15 hover:text-white transition-all"
//             >
//               {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
//             </button>

//             {user && (
//               <>
//                 <NotificationBell />
//                 <div className="relative">
//                   <button
//                     onClick={() => setUserMenuOpen(!userMenuOpen)}
//                     className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/15 transition-all"
//                   >
//                     <div className="w-8 h-8 rounded-full bg-white text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0 shadow">
//                       {user.fullName?.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="hidden sm:block text-left">
//                       <p className="text-sm font-semibold text-white leading-none">
//                         {user.fullName?.split(" ")[0]}
//                       </p>
//                       {user.workerId && (
//                         <p className="text-xs text-purple-200 leading-none mt-0.5">
//                           ID: {user.workerId}
//                         </p>
//                       )}
//                     </div>
//                     <ChevronDown className="w-4 h-4 text-purple-200 hidden sm:block" />
//                   </button>

//                   {userMenuOpen && (
//                     <>
//                       <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
//                       <div className="absolute right-0 top-12 z-40 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-purple-100 dark:border-slate-700 animate-slide-down py-1">
//                         <Link
//                           to={isAdminLevel ? "/admin/dashboard" : "/portal/dashboard"}
//                           onClick={() => setUserMenuOpen(false)}
//                           className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700"
//                         >
//                           <LayoutDashboard className="w-4 h-4 text-purple-600" />
//                           Dashboard
//                         </Link>
//                         <Link
//                           to="/portal/profile"
//                           onClick={() => setUserMenuOpen(false)}
//                           className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-slate-700"
//                         >
//                           <User className="w-4 h-4 text-purple-600" />
//                           My Profile
//                         </Link>
//                         <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
//                         <button
//                           onClick={handleLogout}
//                           className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
//                         >
//                           <LogOut className="w-4 h-4" />
//                           Sign Out
//                         </button>
//                       </div>
//                     </>
//                   )}
//                 </div>
//               </>
//             )}

//             <button
//               className="lg:hidden p-2 rounded-lg text-purple-200 hover:bg-white/15 hover:text-white transition-all"
//               onClick={() => setMobileOpen(!mobileOpen)}
//             >
//               {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
//             </button>
//           </div>
//         </div>
//       </div>

//       {mobileOpen && (
//         <div
//           className="lg:hidden border-t border-white/20 animate-slide-down"
//           style={{ background: "linear-gradient(135deg, #4c1d95 0%, #7B5EA7 100%)" }}
//         >
//           <div className="px-4 py-3 space-y-1">
//             {publicLinks.map((link) => (
//               <NavLink
//                 key={link.to}
//                 to={link.to}
//                 onClick={() => setMobileOpen(false)}
//                 className={({ isActive }) => cn(
//                   "block px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
//                   isActive
//                     ? "bg-white/25 text-white font-semibold"
//                     : "text-purple-100 hover:bg-white/15 hover:text-white"
//                 )}
//               >
//                 {link.label}
//               </NavLink>
//             ))}
//           </div>
//         </div>
//       )}
//     </nav>
//   );
// };

// export default Navbar;


import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center">
        <Link to="/">
          <img src="/yahal.png" alt="Yachal House" className="h-9 w-auto" />
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;