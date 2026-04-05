import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const { user, isAdminLevel } = useAuth();
  const home = user ? (isAdminLevel ? "/admin/dashboard" : "/portal/dashboard") : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-bold text-purple-700 dark:text-purple-400">404</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">Page not found</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={home} className="btn-primary flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          <button onClick={() => window.history.back()} className="btn-outline flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;