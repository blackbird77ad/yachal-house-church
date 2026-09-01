export const canManageAllBranches = (user) =>
  user?.workerId === "001" || user?.canViewAllBranches !== false;

export const getManagedBranches = (user) =>
  Array.isArray(user?.managedBranches) ? user.managedBranches.filter(Boolean) : [];

export const canChooseBranchScope = (user) =>
  canManageAllBranches(user) || getManagedBranches(user).length > 1;

export const getOwnBranchLabel = (user, fallback = "Own branch") =>
  user?.branch?.name || getManagedBranches(user)[0]?.name || fallback;

export const getBranchAllOptionLabel = (user) =>
  canManageAllBranches(user) ? "All branches" : "Assigned branches";
