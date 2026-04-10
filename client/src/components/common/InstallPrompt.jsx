import { useState, useEffect } from "react";
import { X, Smartphone, Share, MoreVertical, Plus, Download, CheckCircle } from "lucide-react";

const InstallPrompt = () => {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null); // "android" | "ios" | "desktop" | null
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Already dismissed
    if (localStorage.getItem("yahal_install_dismissed")) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isDesktop = !isIOS && !isAndroid;

    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
    else setPlatform("desktop");

    // Listen for Android install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Show after 3 seconds
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem("yahal_install_dismissed", "true");
    setShow(false);
  };

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setTimeout(dismiss, 2000);
      }
      setDeferredPrompt(null);
    } else {
      setStep(1); // show manual steps
    }
  };

  if (!show || !platform) return null;

  const IOSSteps = [
    { icon: <Share className="w-5 h-5 text-blue-500" />, text: 'Tap the Share button at the bottom of your Safari browser' },
    { icon: <Plus className="w-5 h-5 text-blue-500" />, text: 'Scroll down and tap "Add to Home Screen"' },
    { icon: <CheckCircle className="w-5 h-5 text-green-500" />, text: 'Tap "Add" in the top right — done!' },
  ];

  const AndroidManualSteps = [
    { icon: <MoreVertical className="w-5 h-5 text-blue-500" />, text: 'Tap the three-dot menu in Chrome (top right)' },
    { icon: <Plus className="w-5 h-5 text-blue-500" />, text: 'Tap "Add to Home Screen"' },
    { icon: <CheckCircle className="w-5 h-5 text-green-500" />, text: 'Tap "Add" to confirm — done!' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="bg-purple-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/yahal.png" alt="Yachal House" className="w-10 h-10 rounded-xl" />
            <div>
              <p className="font-bold text-white text-sm">Yachal House</p>
              <p className="text-purple-200 text-xs">Install on your phone</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-purple-200 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {installed ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-bold text-gray-900 dark:text-slate-100">Installed successfully!</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Find Yachal House on your home screen.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                Install the Yachal House app on your phone for quick access — no browser needed. Works like a normal app.
              </p>

              {/* Android with prompt available */}
              {platform === "android" && step === 0 && (
                <div className="space-y-3">
                  <button
                    onClick={handleAndroidInstall}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                  >
                    <Download className="w-4 h-4" />
                    Install App
                  </button>
                  <button onClick={() => setStep(1)} className="btn-ghost w-full text-sm">
                    Show me how to do it manually
                  </button>
                </div>
              )}

              {/* Android manual steps */}
              {platform === "android" && step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Steps in Chrome</p>
                  {AndroidManualSteps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700">
                      <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {s.icon}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-200 leading-snug">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* iOS steps */}
              {platform === "ios" && (
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Open this page in <strong>Safari</strong> to install. Chrome on iPhone does not support installation.
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Steps in Safari</p>
                  {IOSSteps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700">
                      <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        {s.icon}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-200 leading-snug">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Desktop */}
              {platform === "desktop" && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Install on your computer</p>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700">
                    <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Download className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-200">Click the install icon in your browser's address bar (Chrome or Edge) and click Install.</p>
                  </div>
                </div>
              )}

              <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-500 w-full text-center pt-1">
                Not now — I'll use the browser
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;