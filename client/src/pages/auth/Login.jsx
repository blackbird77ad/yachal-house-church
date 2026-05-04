import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Mail } from "lucide-react";
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
  const [forgotError, setForgotError] = useState("");

  if (user) {
    return (
      <Navigate
        to={isAdminLevel ? "/admin/dashboard" : "/portal/dashboard"}
        replace
      />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginUser({
        identifier: identifier.trim(),
        password,
      });

      login(data.user, data.token);

      const role = data.user.role;
      navigate(
        ["pastor", "admin", "moderator"].includes(role)
          ? "/admin/dashboard"
          : "/portal/dashboard"
      );
    } catch (err) {
      if (!err.response) {
        setError(
          "Could not reach the server right now. Check your internet connection and try again."
        );
      } else if (err.response.status >= 500) {
        setError("The server hit an error while signing you in. Please try again.");
      } else {
        setError(err.response?.data?.message || "Invalid credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");

    try {
      await axiosInstance.post("/auth/forgot-password", {
        email: forgotEmail.trim(),
      });
      setForgotSent(true);
    } catch (err) {
      if (!err.response) {
        setForgotError(
          "Could not reach the server right now. Check your internet connection and try again."
        );
      } else {
        setForgotError(err.response?.data?.message || "Could not send request.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
        </div>

        <div className="card p-8">
          {!showForgot ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                Sign in
              </h1>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
                Enter your email or Worker ID and password.
              </p>

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
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button
                  onClick={() => {
                    setShowForgot(true);
                    setError("");
                    setForgotError("");
                    setForgotSent(false);
                  }}
                  className="text-sm text-purple-700 dark:text-purple-400 hover:underline"
                >
                  Forgot your password?
                </button>

                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Not yet registered?{" "}
                  <Link
                    to="/register"
                    className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
                Forgot Password
              </h1>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
                Enter your email and the admin team will be notified to reset your password.
              </p>

              {forgotError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-6">
                  {forgotError}
                </div>
              )}

              {forgotSent ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
                  <Mail className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3" />
                  <p className="text-green-800 dark:text-green-300 font-semibold mb-1">
                    Request sent
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Your password reset request has been sent to the admin team.
                  </p>
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

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-primary w-full py-3"
                  >
                    {forgotLoading ? "Sending..." : "Send Request"}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setShowForgot(false);
                    setForgotEmail("");
                    setForgotError("");
                    setForgotSent(false);
                  }}
                  className="text-sm text-purple-700 dark:text-purple-400 hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
