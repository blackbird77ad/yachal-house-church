import Home from "../pages/public/Home";
import ServiceTimes from "../pages/public/ServiceTimes";
import Location from "../pages/public/Location";
import Contact from "../pages/public/Contact";
import Media from "../pages/public/Media";

const publicRoutes = [
  { path: "/", element: <Home /> },
  { path: "/service-times", element: <ServiceTimes /> },
  { path: "/location", element: <Location /> },
  { path: "/contact", element: <Contact /> },
  { path: "/media", element: <Media /> },
];

export default publicRoutes;
