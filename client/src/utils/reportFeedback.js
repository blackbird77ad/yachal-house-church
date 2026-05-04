export const getNoDraftYetMessage = () =>
  "Start filling the form first. Once a field is touched, autosave starts, and you can press Save Draft Now below at any time.";

export const getReportSuccessMessage = (response, fallbackMessage) => {
  const message = response?.warningMessage || response?.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return fallbackMessage;
};

export const getFriendlyReportError = (error, options = {}) => {
  const { action = "submit", fallbackMessage } =
    typeof options === "string" ? { fallbackMessage: options } : options;

  const actionLabel =
    action === "draft"
      ? "Draft save"
      : action === "update"
        ? "Report update"
        : "Report submission";

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return `${actionLabel} stopped because this device is offline. Reconnect and try again.`;
  }

  const serverMessage = error?.response?.data?.message;
  if (typeof serverMessage === "string" && serverMessage.trim()) {
    return serverMessage.trim();
  }

  const status = error?.response?.status;
  const rawMessage = `${error?.message || ""}`.toLowerCase();

  if (error?.code === "ECONNABORTED" || rawMessage.includes("timeout")) {
    if (action === "draft") {
      return "Draft save stopped because the server took too long to respond. Press Save Draft Now again after the connection settles.";
    }

    if (action === "update") {
      return "Report update stopped because the server took too long to respond. Save the draft first if needed, then try Update Report again.";
    }

    return "Report submission stopped because the server took too long to respond. Save the draft first if needed, wait a moment, and try Submit Report again.";
  }

  if (status === 400) {
    return `${actionLabel} stopped because some form data is missing or invalid. Check the form and try again.`;
  }

  if (status === 401) {
    return `${actionLabel} stopped because your session expired. Log in again and retry.`;
  }

  if (status === 403) {
    return `${actionLabel} is not allowed for your current account or report state.`;
  }

  if (status === 404) {
    return `${actionLabel} stopped because the report target was not found. Refresh the page and try again.`;
  }

  if (status === 409) {
    return `${actionLabel} stopped because this report already exists or was already submitted for this week.`;
  }

  if (status === 413) {
    return `${actionLabel} stopped because the form data is too large to send.`;
  }

  if (status >= 500) {
    return `${actionLabel} stopped because the server hit an internal error. Try again in a moment.`;
  }

  return (
    fallbackMessage ||
    `${actionLabel} stopped, but the system did not return a clear reason. Try again.`
  );
};
