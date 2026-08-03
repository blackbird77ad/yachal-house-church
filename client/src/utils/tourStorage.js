export const TOUR_KEY = (role) => `yahal_tour_done_${role}`;

export const clearTourStorageForRole = (role) => {
  localStorage.removeItem(TOUR_KEY(role));
};
