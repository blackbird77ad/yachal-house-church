export const TOUR_KEY = (role) => `yahal_tour_done_${role}`;

export const UPDATE_TOUR_VERSION = "2026-07-service-role-worker-analysis";
export const UPDATE_TOUR_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const UPDATE_TOUR_KEY = (audience) =>
  `yahal_update_tour_done_${UPDATE_TOUR_VERSION}_${audience}`;

export const UPDATE_TOUR_FIRST_SEEN_KEY = (audience) =>
  `yahal_update_tour_first_seen_${UPDATE_TOUR_VERSION}_${audience}`;

export const getTourAudience = (role) =>
  ["pastor", "admin", "moderator"].includes(role) ? "admin" : "worker";

export const clearTourStorageForRole = (role) => {
  const audience = getTourAudience(role);

  localStorage.removeItem(TOUR_KEY(role));
  localStorage.removeItem(UPDATE_TOUR_KEY(audience));
  localStorage.removeItem(UPDATE_TOUR_FIRST_SEEN_KEY(audience));
};
