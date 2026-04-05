import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";
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
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await registerUser({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password });
      navigate("/pending");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Create account</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
          Register to access the Yachal House workers portal. Your account will be reviewed and approved before you can sign in.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Full Name</label>
            <input className="input-field" placeholder="Your full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Email address</label>
            <input type="email" className="input-field" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Phone number (optional)</label>
            <input className="input-field" placeholder="+233 XXX XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">Confirm Password</label>
            <input type="password" className="input-field" placeholder="Repeat your password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><UserPlus className="w-4 h-4" /> Create Account</>
            }
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-700 dark:text-purple-400 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>

      <p className="mt-10 text-xs text-gray-300 dark:text-slate-700">
        Built by{" "}
        <a href="https://thebrandhelper.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
          thebrandhelper.com
        </a>
      </p>
    </div>
  );
};

export default Register;