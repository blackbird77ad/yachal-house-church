import { useState, useEffect } from "react";
import { Clock, MapPin, Calendar, Phone, AlertCircle } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";

const defaultTimes = [
  { _id: "1", day: "Tuesday", time: "5:30 PM", label: "Midweek Service", description: "Come midweek and be refreshed in the Word of God.", serviceType: "tuesday" },
  { _id: "2", day: "Sunday", time: "8:30 AM", label: "Sunday Service", description: "Our main weekly gathering. Come with family, come with friends, come expectant.", serviceType: "sunday" },
];

const ServiceTimes = () => {
  const [times, setTimes] = useState(defaultTimes);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/service-times")
      .then(({ data }) => {
        if (data.times?.length > 0) setTimes(data.times);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const colors = {
    tuesday: { accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    sunday: { accent: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
    special: { accent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-7 h-7" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Service Times</h1>
          <p className="text-gray-300 text-lg max-w-xl mx-auto">
            We gather regularly to worship, hear the Word and build one another up in faith. You are always welcome.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 mb-10">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Service times may change for special services. Always confirm with us on <a href="tel:+233544600600" className="font-semibold underline">+233 544 600 600</a> or follow our announcements.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {(loading ? defaultTimes : times).map((s) => {
              const c = colors[s.serviceType] || colors.special;
              return (
                <div key={s._id} className={`rounded-2xl border-2 ${c.border} p-8 hover:shadow-md transition-all`}>
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.accent}`}>
                      <Calendar className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${c.accent}`}>{s.label}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">{s.day}</h2>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-4">{s.time}</p>
                  {s.description && <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">{s.description}</p>}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-6 flex items-start gap-4">
              <div className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1">Location</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                  13, Ridge Quarry Enclave, Behind Atlantic Computers, Ridge, Accra, Ghana
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-6 flex items-start gap-4">
              <div className="w-11 h-11 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-green-700 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1">Questions?</h3>
                <a href="tel:+233544600600" className="text-sm text-green-700 dark:text-green-400 font-medium hover:underline">
                  +233 544 600 600
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiceTimes;