import { useState } from "react";
import { Mail, Phone, MapPin, Send, CheckCircle, MessageSquare } from "lucide-react";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            Whether you have a question, need prayer, or just want to know more about Yachal House, we are here and we would love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Get in Touch</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                Our team is always happy to respond. We typically reply within 24 hours.
              </p>
              <div className="space-y-5">
                {[
                  { icon: <Phone className="w-5 h-5" />, label: "Phone", value: "+233 544 600 600", href: "tel:+233544600600", accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
                  { icon: <Mail className="w-5 h-5" />, label: "Email", value: "yachalhouse@gmail.com", href: "mailto:yachalhouse@gmail.com", accent: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
                  { icon: <MapPin className="w-5 h-5" />, label: "Address", value: "13, Ridge Quarry Enclave, Behind Atlantic Computers, Ridge, Accra, Ghana", accent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${item.accent}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="text-sm text-gray-700 dark:text-slate-300 hover:text-purple-700 transition-colors font-medium">{item.value}</a>
                      ) : (
                        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{item.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-gray-50 dark:bg-slate-800 rounded-2xl p-8">
              {sent ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Message Received!</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">Thank you for reaching out. Someone from our team will be in touch soon. God bless you.</p>
                  <button onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }} className="btn-primary">
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Send a Message</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Full Name</label>
                      <input className="input-field" placeholder="Your full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="form-label">Email</label>
                      <input type="email" className="input-field" placeholder="your@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Phone (optional)</label>
                      <input className="input-field" placeholder="+233 XXX XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Subject</label>
                      <input className="input-field" placeholder="What is this about?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Message</label>
                    <textarea className="input-field resize-none" placeholder="Write your message here..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={5} />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;