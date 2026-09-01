import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, UserPlus } from "lucide-react";
import { registerUser } from "../../services/authService";
import { getPublicBranches } from "../../services/branchService";

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    branchId: "",
    password: "",
    confirmPassword: "",
  });

  const [branches, setBranches] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let cancelled = false;

    getPublicBranches()
      .then(({ branches: nextBranches = [] }) => {
        if (!cancelled) setBranches(nextBranches);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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

    if (branches.length > 0 && !form.branchId) {
      setError("Please select your current branch.");
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        branchId: form.branchId,
        password: form.password,
      });
      navigate("/pending");
    } catch (err) {
      if (!err.response) {
        setError("Could not reach the server. Please check that the backend is running.");
      } else if (err.response.status >= 500) {
        setError("The server hit an error while creating your account. Please try again.");
      } else {
        setError(err.response?.data?.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">
            Create account
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
            Register to access the Yachal House workers portal. Your account will be reviewed before you can sign in.
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
                onChange={(e) => updateField("fullName", e.target.value)}
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
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Phone number (optional)</label>
              <input
                className="input-field"
                placeholder="+233 XXX XXX XXX"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>

            {branches.length > 0 && (
              <div>
                <label className="form-label">Current Branch</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select
                    className="input-field pl-9"
                    value={form.branchId}
                    onChange={(e) => updateField("branchId", e.target.value)}
                    required
                  >
                    <option value="">Select your branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                        {branch.location ? ` - ${branch.location}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-10"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
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

            <div>
              <label className="form-label">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="input-field pr-10"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  {showConfirmPassword ? (
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
            <Link
              to="/login"
              className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
