import { Mic, Music, ExternalLink, Headphones, BookOpen } from "lucide-react";

const platforms = [
  {
    name: "Apple Podcasts",
    desc: "Available on Apple Podcasts. Subscribe and never miss a message.",
    url: "https://podcasts.apple.com/us/podcast/yachal-house/id1497164301",
    icon: <Mic className="w-7 h-7" />,
    accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    btn: "bg-purple-700 hover:bg-purple-800 text-white",
  },
  {
    name: "Spotify",
    desc: "Stream our messages on Spotify. Listen while you commute, exercise or rest.",
    url: "https://open.spotify.com/show/398jMeSYUVygBDrQhz88oX",
    icon: <Music className="w-7 h-7" />,
    accent: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    btn: "bg-green-700 hover:bg-green-800 text-white",
  },
];

const Media = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <section className="bg-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Headphones className="w-7 h-7" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Messages and Teachings</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            The Word of God preached with clarity and power by Rev Gilbert Ossei (Prophet Gilbert). Listen wherever you are.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-8 mb-12 flex items-start gap-5">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-2">The Gospel We Preach</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">
                Rev Gilbert Ossei teaches the Gospel of Jesus Christ — His death, burial and resurrection (1 Corinthians 15:1-4). He believes your number one need as a believer is knowledge. You can only be effective in your Christian walk when you know what is available to you in Christ Jesus. Every message is designed to build your faith and equip you for life.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2 text-center">Listen on Your Platform</h2>
          <p className="text-gray-500 dark:text-slate-400 text-center text-sm mb-10">Choose your preferred platform and start listening today.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
            {platforms.map((p) => (
              <div key={p.name} className="border border-gray-100 dark:border-slate-700 rounded-2xl p-8 hover:shadow-md transition-all group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${p.accent} group-hover:scale-110 transition-transform duration-300`}>
                  {p.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">{p.name}</h3>
                <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed mb-6">{p.desc}</p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 ${p.btn} font-semibold px-6 py-3 rounded-xl transition-all shadow-sm text-sm`}
                >
                  <ExternalLink className="w-4 h-4" />
                  Listen Now
                </a>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold mb-3">More Content Coming Soon</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
              We are working on a full media library with sermons, series and teachings. Subscribe to our podcast so you are notified the moment new messages are released.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Media;