import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Heart, Mic, Music } from "lucide-react";

const Footer = () => {
  return (
    <footer
      className="mt-auto text-gray-200"
      style={{
        background: "linear-gradient(135deg, #1e0a3c 0%, #3b0764 30%, #4c1d95 60%, #1a3a0a 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          <div className="sm:col-span-2 lg:col-span-1">
            <img src="/yahal.png" alt="Yachal House" className="h-16 w-auto rounded-xl mb-5 shadow-lg" />
            <p className="text-sm text-purple-200 leading-relaxed">
              A New Testament Bible believing church that seeks to impact the world with HOPE under the leadership of Rev Gilbert Ossei (Prophet Gilbert).
            </p>
            <p className="text-xs text-purple-300/70 italic leading-relaxed mt-4 border-l-2 border-purple-500 pl-3">
              "Moreover, brethren, I declare unto you the gospel..." — 1 Cor 15:1-4
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Quick Links</h3>
            <ul className="space-y-2.5">
              {[
                { to: "/", label: "Home" },
                { to: "/service-times", label: "Service Times" },
                { to: "/location", label: "Find Us" },
                { to: "/contact", label: "Contact" },
                { to: "/media", label: "Media" },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-purple-200 hover:text-white transition-colors flex items-center gap-1.5 group">
                    <span className="w-1 h-1 rounded-full bg-purple-500 group-hover:bg-green-400 transition-colors" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Listen</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://podcasts.apple.com/us/podcast/yachal-house/id1497164301"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-purple-200 hover:text-white transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-800/60 flex items-center justify-center group-hover:bg-purple-700 transition-colors">
                    <Mic className="w-4 h-4" />
                  </div>
                  Apple Podcasts
                </a>
              </li>
              <li>
                <a
                  href="https://open.spotify.com/show/398jMeSYUVygBDrQhz88oX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-purple-200 hover:text-green-400 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-900/40 flex items-center justify-center group-hover:bg-green-800/60 transition-colors">
                    <Music className="w-4 h-4 text-green-400" />
                  </div>
                  Spotify
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-purple-200">
                <div className="w-8 h-8 rounded-lg bg-purple-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="leading-relaxed">13, Ridge Quarry Enclave, Behind Atlantic Computers, Ridge, Accra, Ghana</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-purple-200">
                <div className="w-8 h-8 rounded-lg bg-purple-800/60 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <a href="tel:+233544600600" className="hover:text-white transition-colors">+233 544 600 600</a>
              </li>
              <li className="flex items-center gap-3 text-sm text-purple-200">
                <div className="w-8 h-8 rounded-lg bg-purple-800/60 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <a href="mailto:yachalhouse@gmail.com" className="hover:text-white transition-colors">yachalhouse@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-purple-300/60">&copy; {new Date().getFullYear()} Yachal House. All rights reserved.</p>
          <p className="text-xs text-purple-300/60 flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-red-400 mx-1" /> for the Kingdom
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;