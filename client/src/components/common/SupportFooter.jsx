const SupportFooter = () => (
  <footer className="mt-auto pt-8 pb-4 px-4">
    <div className="max-w-screen-xl mx-auto">
      <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center leading-relaxed">
          For technical support contact{" "}
          <a href="mailto:davida@thebrandhelper.com" className="hover:text-gray-400 dark:hover:text-slate-500 transition-colors">
            davida@thebrandhelper.com
          </a>
          {" "}or WhatsApp{" "}
          <a href="https://wa.me/233501657205" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 dark:hover:text-slate-500 transition-colors">
            0501657205
          </a>
          . For ministry-related matters, please speak with your department leader or pastor.
          Church: <a href="tel:+233544600600" className="hover:text-gray-400 dark:hover:text-slate-500 transition-colors">0544 600 600</a>.{" "}
          Please do not reply to emails from noreply@yachalhousegh.com.
        </p>
      </div>
    </div>
  </footer>
);

export default SupportFooter;