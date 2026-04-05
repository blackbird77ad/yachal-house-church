import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { loginUser } from "../../services/authService";
import axiosInstance from "../../utils/axiosInstance";

const Login = () => {
  const { user, login, isAdminLevel } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  if (user) return <Navigate to={isAdminLevel ? "/admin/dashboard" : "/portal/dashboard"} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await loginUser({ identifier, password });
      login(data.user, data.token);
      const role = data.user.role;
      navigate(["pastor", "admin", "moderator"].includes(role) ? "/admin/dashboard" : "/portal/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      await axiosInstance.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send request.");
    } finally { setForgotLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
        </div>

        {!showForgot ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Sign in</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">Enter your email or Worker ID and password.</p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="form-label">Email or Worker ID</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="your@email.com or 001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field pr-10"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><LogIn className="w-4 h-4" /> Sign In</>
                }
              </button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <button
                onClick={() => { setShowForgot(true); setError(""); }}
                className="text-sm text-purple-700 dark:text-purple-400 hover:underline"
              >
                Forgot your password?
              </button>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Not yet registered?{" "}
                <Link to="/register" className="text-purple-700 dark:text-purple-400 font-semibold hover:underline">
                  Create an account
                </Link>
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Forgot Password</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
              Enter your email and the admin team will be notified to reset your password.
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            {forgotSent ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                <p className="text-green-800 dark:text-green-300 font-semibold mb-2">Request Sent</p>
                <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                  The admin team has been notified. They will reset your password and contact you with the new credentials.
                </p>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                  className="btn-primary text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-5">
                <div>
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={forgotLoading} className="btn-primary w-full py-3">
                  {forgotLoading ? "Sending..." : "Send Reset Request"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setError(""); }}
                  className="btn-ghost w-full"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <p className="mt-10 text-xs text-gray-300 dark:text-slate-700">
        Built by{" "}
        <a
          href="https://thebrandhelper.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-400 dark:hover:text-slate-500 transition-colors"
        >
          thebrandhelper.com
        </a>
      </p>
    </div>
  );
};

export default Login;