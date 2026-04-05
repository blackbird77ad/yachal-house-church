// import { Link } from "react-router-dom";
// import { MapPin, Clock, Phone, ChevronRight, BookOpen, Heart, Users, ArrowRight } from "lucide-react";

// const Home = () => {
//   return (
//     <div className="min-h-screen bg-white dark:bg-slate-900">

//       <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden bg-slate-900">
//         <div className="absolute inset-0">
//           <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900" />
//           <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-green-950/40 to-transparent" />
//           <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl" />
//         </div>

//         <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
//           <div className="text-center lg:text-left animate-fade-in">
//             <span className="inline-block bg-white/10 border border-white/20 text-purple-200 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-widest mb-6">
//               Ridge, Accra, Ghana
//             </span>
//             <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
//               There is HOPE<br />
//               <span className="text-purple-300">for your life</span><br />
//               in Jesus Christ.
//             </h1>
//             <p className="text-gray-300 text-lg leading-relaxed mb-8">
//               At Yachal House, we believe the Gospel of Jesus Christ — His death, burial and resurrection — is the answer to every question the human heart is asking. You are welcome here.
//             </p>
//             <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
//               <Link to="/location" className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-bold px-7 py-4 rounded-xl shadow-lg hover:bg-gray-100 transition-all text-base">
//                 <MapPin className="w-5 h-5 text-purple-700" />
//                 Plan a Visit
//               </Link>
//               <Link to="/media" className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/10 transition-all text-base">
//                 Listen to Sermons
//                 <ArrowRight className="w-4 h-4" />
//               </Link>
//             </div>
//           </div>

//           <div className="flex justify-center lg:justify-end">
//             <div className="relative">
//               <div className="absolute inset-0 bg-purple-600/20 rounded-3xl blur-2xl scale-110" />
//               <img src="/yahal.png" alt="Yachal House" className="relative h-64 w-64 sm:h-80 sm:w-80 object-contain drop-shadow-2xl" />
//             </div>
//           </div>
//         </div>

//         <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 text-xs">
//           <span>Scroll</span>
//           <div className="w-px h-8 bg-white/20" />
//         </div>
//       </section>

//       <section className="py-20 bg-white dark:bg-slate-900">
//         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
//             {[
//               {
//                 icon: <BookOpen className="w-7 h-7" />,
//                 title: "Rooted in the Word",
//                 desc: "Rev Gilbert Ossei teaches that your number one need as a believer is knowledge. You can only be effective in your Christian walk when you know what is available to you in Christ Jesus.",
//                 accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
//               },
//               {
//                 icon: <Heart className="w-7 h-7" />,
//                 title: "The Gospel First",
//                 desc: "We preach and teach the death, burial and resurrection of Jesus Christ. This is the good news that has the power to save, heal and transform every life — including yours.",
//                 accent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
//               },
//               {
//                 icon: <Users className="w-7 h-7" />,
//                 title: "A Family, Not a Crowd",
//                 desc: "Yachal House is a community where you belong. Whether you are new to faith or have walked with God for years, there is a place and a purpose for you here.",
//                 accent: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
//               },
//             ].map((item) => (
//               <div key={item.title} className="group p-8 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-lg transition-all duration-300">
//                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${item.accent} group-hover:scale-110 transition-transform duration-300`}>
//                   {item.icon}
//                 </div>
//                 <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3">{item.title}</h3>
//                 <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       <section className="py-20 bg-gray-50 dark:bg-slate-800">
//         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
//             <div>
//               <span className="text-green-700 dark:text-green-400 text-sm font-semibold uppercase tracking-widest">Our Message</span>
//               <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mt-3 mb-6 leading-snug">
//                 The Gospel is the power of God unto salvation.
//               </h2>
//               <p className="text-gray-600 dark:text-slate-300 text-base leading-relaxed mb-5">
//                 At Yachal House, we believe every person carries a God-given potential that is unlocked through the knowledge of the Gospel. Under the leadership of Rev Gilbert Ossei (Prophet Gilbert), we are a church committed to teaching the Word of God with clarity, conviction and love.
//               </p>
//               <p className="text-gray-600 dark:text-slate-300 text-base leading-relaxed mb-8">
//                 We are not just a Sunday gathering. We are a movement of believers impacting families, communities and nations with the HOPE that is found only in Jesus Christ.
//               </p>
//               <Link to="/service-times" className="inline-flex items-center gap-2 text-purple-700 dark:text-purple-400 font-semibold hover:gap-3 transition-all">
//                 See when we meet <ChevronRight className="w-4 h-4" />
//               </Link>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               {[
//                 { value: "1 Cor 15:1-4", label: "Our Foundation" },
//                 { value: "HOPE", label: "Our Mission" },
//                 { value: "Tue and Sun", label: "Weekly Services" },
//                 { value: "Ridge, Accra", label: "Our Home" },
//               ].map((stat) => (
//                 <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 text-center shadow-sm">
//                   <p className="text-xl font-bold text-purple-700 dark:text-purple-400 mb-1">{stat.value}</p>
//                   <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wider">{stat.label}</p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="py-20 bg-slate-900 text-white">
//         <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
//           <h2 className="text-3xl sm:text-4xl font-bold mb-4">Join Us This Week</h2>
//           <p className="text-gray-400 text-lg mb-12">No matter where you are in your journey, you are welcome at Yachal House.</p>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
//             {[
//               { day: "Tuesday", time: "5:30 PM", label: "Midweek Service" },
//               { day: "Sunday", time: "8:30 AM", label: "Sunday Service" },
//             ].map((s) => (
//               <div key={s.day} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
//                 <p className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-3">{s.label}</p>
//                 <h3 className="text-2xl font-bold mb-1">{s.day}</h3>
//                 <p className="text-gray-300 text-lg">{s.time}</p>
//               </div>
//             ))}
//           </div>

//           <p className="text-gray-500 text-sm flex items-center justify-center gap-2 mb-10">
//             <MapPin className="w-4 h-4 text-green-500" />
//             13, Ridge Quarry Enclave, Behind Atlantic Computers, Ridge, Accra
//           </p>

//           <div className="flex flex-col sm:flex-row gap-4 justify-center">
//             <Link to="/location" className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all">
//               <MapPin className="w-4 h-4 text-purple-700" />
//               Get Directions
//             </Link>
//             <a href="tel:+233544600600" className="inline-flex items-center justify-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-all">
//               <Phone className="w-4 h-4" />
//               Call Us
//             </a>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// };

// export default Home;

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 px-6 text-center">
      <img src="/yahal.png" alt="Yachal House" className="h-20 w-auto mb-8 opacity-90" />
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
        Something great is coming.
      </h1>
      <p className="text-gray-500 dark:text-slate-400 text-base sm:text-lg max-w-md leading-relaxed mb-8">
        We are putting the finishing touches on our new website. Check back soon.
      </p>
      <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-slate-500">
        <span>Yachal House</span>
        <span>·</span>
        <span>Ridge, Accra</span>
        <span>·</span>
        <span>+233 544 600 600</span>
      </div>
      <p className="mt-16 text-xs text-gray-300 dark:text-slate-700">
        Built by{" "}
        <a
          href="https://thebrandhelper.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-400 transition-colors"
        >
          thebrandhelper.com
        </a>
      </p>
    </div>
  );
};

export default Home;