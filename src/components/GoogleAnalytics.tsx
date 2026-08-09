import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = "G-NV4VX8QH6D";

let initialized = false;

/**
 * Initializes Google Analytics and tracks page views on route changes.
 * Must be rendered inside <BrowserRouter> since it uses useLocation().
 * Only active in production to avoid polluting analytics during development.
 */
const GoogleAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (!initialized && import.meta.env.PROD) {
      ReactGA.initialize(GA_MEASUREMENT_ID);
      initialized = true;
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      ReactGA.send({
        hitType: "pageview",
        page: location.pathname + location.search,
      });
    }
  }, [location]);

  return null;
};

export default GoogleAnalytics;
