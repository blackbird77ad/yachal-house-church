import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Lightbulb } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/scoreHelpers";

const WORKER_STEPS = [
  {
    title: "Welcome to Yachal House Portal",
    body: "This is your personal workers portal. Everything you need to manage your weekly ministry activities is right here. Let's take a quick tour.",
    icon: "👋",
    position: "center",
  },
  {
    title: "Your Worker ID",
    body: "Your permanent Worker ID is shown on your dashboard. Keep it safe — you need it to check in at the front desk before every service and to log in.",
    icon: "🪪",
    position: "center",
  },
  {
    title: "Submit Report",
    body: "Every week you must submit your report before Monday 2:59pm. The portal opens Friday midnight and closes Monday 2:59pm. Two cards appear — current week and past weeks (arrears).",
    icon: "📋",
    position: "center",
  },
  {
    title: "Draft Saves Automatically",
    body: "You can fill your report at any time — even when the portal is closed. Drafts save automatically. Only submission is restricted to the open window.",
    icon: "💾",
    position: "center",
  },
  {
    title: "Qualification",
    body: "To qualify each week you need: 10+ souls preached to, 2+ hrs fellowship prayer, 2+ hrs cell prayer, 4+ service attendance counts, and your report submitted on time. All 5 must be met.",
    icon: "✅",
    position: "center",
  },
  {
    title: "Front Desk Check-in",
    body: "Always check in at the Front Desk when you arrive for service. Your Worker ID is used for check-in. This records your arrival time and counts toward your service attendance.",
    icon: "🖥️",
    position: "center",
  },
  {
    title: "My Roster",
    body: "After qualification is processed, the duty roster is published. Check My Roster to see your department assignment for the upcoming service.",
    icon: "📅",
    position: "center",
  },
  {
    title: "Notifications",
    body: "Enable push notifications to get alerted when the portal opens, when it's about to close, and when your roster is published — even when the app is closed.",
    icon: "🔔",
    position: "center",
  },
  {
    title: "You're all set!",
    body: "You can always revisit this tour from My Profile. God bless you! 🙏",
    icon: "🎉",
    position: "center",
  },
];

const ADMIN_STEPS = [
  {
    title: "Welcome Sir / Ma",
    body: "This is your admin portal. This is totally different from the workers portal. You manage workers, reports, qualification, rosters and the front desk from here. Your worker portal is also accessible via the dropdown menu.",
    icon: "👑",
    position: "center",
  },
  {
    title: "Workers",
    body: "Add workers individually with a password you set, or bulk add by pasting email addresses. Credentials are downloadable. Approve registrations from the Workers page.",
    icon: "👥",
    position: "center",
  },
  {
    title: "Report Portal Control",
    body: "The portal opens automatically every Friday at midnight and closes Monday 2:59pm. You can override this manually from Portal Control. Service times are also managed here.",
    icon: "⚙️",
    position: "center",
  },
  {
    title: "Qualification",
    body: "Click Calculate Now to process metrics from submitted reports. Results update live as reports come in. On Monday 2:59pm results are finalised, emailed, and posted in your system notifications.",
    icon: "🏆",
    position: "center",
  },
  {
    title: "Roster Builder",
    body: "After calculating qualification, go to Roster Builder. Workers appear in three groups: qualified, not qualified, and no report. Assign any worker to any department. Pastor (001) is excluded.",
    icon: "📋",
    position: "center",
  },
  {
    title: "Publish and Notify",
    body: "Once the roster is ready, save it then publish. All workers receive an in-app notification and push notification. Use the WhatsApp button to share the full roster via WhatsApp instantly.",
    icon: "📤",
    position: "center",
  },
  {
    title: "Front Desk",
    body: "Open a front desk session before each service. Workers check in by ID or name. Stats update live — showing who arrived early, on time or late. Session auto-closes 4 hours after service start.",
    icon: "🖥️",
    position: "center",
  },
  {
    title: "Reports History",
    body: "View all submitted reports by any worker for any period. Filter by worker, type, period or custom date range. Export as CSV. Report Detail shows the full submission.",
    icon: "📊",
    position: "center",
  },
  {
    title: "Password Resets",
    body: "When a worker requests a reset, you receive a notification and email. Go to their Worker Profile and click Reset Password. The temporary password shows on screen for you to share.",
    icon: "🔑",
    position: "center",
  },
  {
    title: "You're ready to go!",
    body: "You have full control of the system. For technical issues contact davida@thebrandhelper.com or 0501657205. You can restart this tour anytime from your profile dropdown. God bless You! 🙏",
    icon: "🚀",
    position: "center",
  },
];

const TOUR_KEY = (role) => `yahal_tour_done_${role}`;

const TourGuide = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState("right"); // "right" | "left"
  const [animating, setAnimating] = useState(false);

  const isAdminLevel = ["pastor", "admin", "moderator"].includes(user?.role);
  const steps = isAdminLevel ? ADMIN_STEPS : WORKER_STEPS;
  const storageKey = TOUR_KEY(user?.role || "worker");

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(storageKey);
    if (!done) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const dismiss = (permanent = true) => {
    if (permanent) localStorage.setItem(storageKey, "true");
    setVisible(false);
    setStep(0);
  };

  const goTo = (dir) => {
    if (animating) return;
    setAnimDir(dir === "next" ? "right" : "left");
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => dir === "next" ? s + 1 : s - 1);
      setAnimating(false);
    }, 200);
  };

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / steps.length) * 100;

  if (!visible || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => dismiss(false)}
      />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-slate-700">
          <div
            className="h-1 bg-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              {isAdminLevel ? "Admin Guide" : "Worker Guide"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-slate-500">{step + 1} of {steps.length}</span>
            <button onClick={() => dismiss(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "px-6 py-6 text-center transition-all duration-200",
          animating ? (animDir === "right" ? "-translate-x-4 opacity-0" : "translate-x-4 opacity-0") : "translate-x-0 opacity-100"
        )}>
          <div className="text-5xl mb-4 select-none">{current.icon}</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3 leading-snug">{current.title}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">{current.body}</p>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i === step
                  ? "w-5 h-1.5 bg-purple-600"
                  : "w-1.5 h-1.5 bg-gray-200 dark:bg-slate-600"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 pb-5 pt-2">
          <button
            onClick={() => dismiss(true)}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors flex-1 text-left"
          >
            Don't show again
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button onClick={() => goTo("prev")} className="btn-ghost flex items-center gap-1 text-sm px-3 py-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {!isLast ? (
              <button onClick={() => goTo("next")} className="btn-primary flex items-center gap-1 text-sm px-4 py-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => dismiss(true)} className="btn-primary text-sm px-4 py-2">
                Got it!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Export a hook to restart the tour from Profile
export const useRestartTour = () => {
  const { user } = useAuth();
  return () => {
    if (!user) return;
    const key = TOUR_KEY(user.role);
    localStorage.removeItem(key);
    window.location.reload();
  };
};

export default TourGuide;
