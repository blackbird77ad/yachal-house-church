import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus, CheckCircle } from "lucide-react";
import { registerUser } from "../../services/authService";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password });
      navigate("/pending");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12">
        <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
        <div>
          <h2 className="text-3xl font-bold mb-4 leading-snug">
            Join the Yachal House workers family.
          </h2>
          <p className="text-gray-400 leading-relaxed text-sm mb-8">
            Create your account to access the workers portal. Once registered, your account will be reviewed and approved by the admin team before you can sign in.
          </p>
          <div className="space-y-3">
            {[
              "Submit weekly evangelism and follow-up reports",
              "Track your qualification and score",
              "View your duty roster and assignments",
              "Stay notified with in-app and email alerts",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600 italic">
          "Moreover, brethren, I declare unto you the gospel..." 1 Corinthians 15:1-4
        </p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Create account</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
            Register to access the Yachal House workers portal.
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                className="input-field"
                placeholder="Your full name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="input-field"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="form-label">Phone number (optional)</label>
              <input
                className="input-field"
                placeholder="+233 XXX XXX XXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-10"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-purple-700 dark:text-purple-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-3">
            <Link to="/" className="hover:text-purple-700 dark:hover:text-purple-400 transition-colors">
              Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;