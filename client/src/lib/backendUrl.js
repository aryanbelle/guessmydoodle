const productionDefault = "https://guessmydoodle-2.onrender.com";
const configuredSocketUrl = process.env.REACT_APP_SOCKET_URL;
const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL;

const configuredProductionUrl = [configuredSocketUrl, configuredBackendUrl].find((url) => url && !/localhost|127\.0\.0\.1/i.test(url));

export const backendUrl = process.env.NODE_ENV === "production"
  ? configuredProductionUrl || productionDefault
  : configuredSocketUrl || configuredBackendUrl || "http://localhost:5000";
