import { useRouteError, Link } from "react-router-dom";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

// Used as errorElement in AppRouter
export const RouteError = () => {
  const error = useRouteError();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          {error?.message || "An unexpected error occurred. Please try refreshing the page."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="btn-outline flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link to="/portal/dashboard" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" /> Go Home
          </Link>
        </div>
        <p className="text-xs text-gray-300 dark:text-slate-600 mt-8">
          If this keeps happening, contact{" "}
          <a href="mailto:davida@thebrandhelper.com" className="hover:text-gray-400 transition-colors">
            davida@thebrandhelper.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default RouteError;