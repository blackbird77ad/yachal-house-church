import { MapPin, Phone, Clock, Navigation, Mail } from "lucide-react";

const Location = () => {
  const lat = 5.5662809;
  const lng = -0.2036118;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-7 h-7" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Find Us</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            We are tucked in the heart of Ridge, Accra. Come find a community that will feel like home.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: <MapPin className="w-5 h-5" />,
                title: "Address",
                content: "13, Ridge Quarry Enclave, Behind Atlantic Computers, Ridge, Accra, Ghana",
                accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
              },
              {
                icon: <Clock className="w-5 h-5" />,
                title: "Service Times",
                content: "Tuesday 5:30 PM and Sunday 8:30 AM",
                accent: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
              },
              {
                icon: <Phone className="w-5 h-5" />,
                title: "Phone",
                content: "+233 544 600 600",
                href: "tel:+233544600600",
                accent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-6 flex items-start gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${item.accent}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">{item.title}</p>
                  {item.href ? (
                    <a href={item.href} className="text-sm text-gray-700 dark:text-slate-300 hover:text-purple-700 font-medium transition-colors">{item.content}</a>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{item.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm mb-6">
            <div className="w-full h-96 bg-gray-100 dark:bg-slate-800">
              <iframe
                title="Yachal House Location"
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-slate-700 dark:hover:bg-gray-100 transition-all shadow-md"
            >
              <Navigation className="w-4 h-4" />
              Open in Google Maps
            </a>
            <a
              href="mailto:yachalhouse@gmail.com"
              className="inline-flex items-center justify-center gap-2 border-2 border-slate-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-semibold px-8 py-4 rounded-xl hover:border-purple-400 hover:text-purple-700 transition-all"
            >
              <Mail className="w-4 h-4" />
              Send Us an Email
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Location;