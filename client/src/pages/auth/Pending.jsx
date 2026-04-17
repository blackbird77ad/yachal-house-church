import { Link } from "react-router-dom";
import { Clock, Mail, Phone, CheckCircle, ArrowLeft } from "lucide-react";

const Pending = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-10 text-center">
          <div className="mb-6 flex justify-center">
            <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto" />
          </div>

          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
            Account Pending Approval
          </h1>

          <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
            Thank you for registering with Yachal House. Your account has been received and is currently being reviewed by the admin team. You will be notified when your account is approved and ready for portal access.
          </p>

          <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-5 text-left space-y-4 mb-8">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              What happens next
            </p>

            {[
              "The admin team reviews your registration details.",
              "Your account is approved and a Worker ID is assigned to you.",
              "You receive access information for portal sign-in.",
              "You can then sign in and start using the workers portal.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-300">{step}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 mb-8">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Need help? Contact us
            </p>

            <a
              href="tel:+233544600600"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
            >
              <Phone className="w-4 h-4" />
              +233 544 600 600
            </a>

            <a
              href="mailto:yachalhouse@gmail.com"
              className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-400 transition-colors"
            >
              <Mail className="w-4 h-4" />
              yachalhouse@gmail.com
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="btn-primary flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Try Signing In
            </Link>

            <Link
              to="/"
              className="btn-ghost flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pending;