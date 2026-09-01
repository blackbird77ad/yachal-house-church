import User from "../models/userModel.js";

export const SUPER_ADMIN_WORKER_ID = "001";
export const ADMIN_ROLES = ["pastor", "admin", "moderator"];
export const UNMATCHABLE_BRANCH_ID = "000000000000000000000000";

export const normalizeBranchId = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return "";

  const branchId = String(raw).trim();
  if (!branchId) return "";

  const lowered = branchId.toLowerCase();
  if (["all", "none", "null", "undefined"].includes(lowered)) return "";

  return branchId;
};

export const getUserBranchId = (user) => {
  const branch = user?.branch;
  if (!branch) return "";

  return branch?._id?.toString?.() || branch?.toString?.() || "";
};

export const getManagedBranchIds = (user) => {
  const branches = Array.isArray(user?.managedBranches)
    ? user.managedBranches
    : [];

  return [
    ...new Set(
      branches
        .map((branch) => branch?._id?.toString?.() || branch?.toString?.() || "")
        .filter(Boolean)
    ),
  ];
};

export const getAccessibleBranchIds = (user) => {
  const ids = [getUserBranchId(user), ...getManagedBranchIds(user)].filter(Boolean);
  return [...new Set(ids)];
};

export const isSuperAdminUser = (user) =>
  String(user?.workerId || "").trim() === SUPER_ADMIN_WORKER_ID;

export const isAdminLevelUser = (user) => ADMIN_ROLES.includes(user?.role);

export const canAccessAllBranches = (user) =>
  isSuperAdminUser(user) ||
  (isAdminLevelUser(user) && user?.canViewAllBranches !== false);

export const createBranchAccessError = (
  message = "You can only access records for your assigned branch."
) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

export const resolveBranchScope = (req) => {
  const requestedBranchId = normalizeBranchId(
    req.query?.branchId ?? req.body?.branchId
  );

  if (canAccessAllBranches(req.user)) {
    const branchIds = requestedBranchId ? [requestedBranchId] : [];

    return {
      branchId: requestedBranchId,
      branchIds,
      requestedBranchId,
      isAllBranches: !requestedBranchId,
      canViewAllBranches: true,
      userBranchId: getUserBranchId(req.user),
      managedBranchIds: getManagedBranchIds(req.user),
    };
  }

  const accessibleBranchIds = getAccessibleBranchIds(req.user);
  const requestedIsAllowed =
    requestedBranchId && accessibleBranchIds.includes(requestedBranchId);
  const branchIds = requestedBranchId
    ? requestedIsAllowed
      ? [requestedBranchId]
      : [UNMATCHABLE_BRANCH_ID]
    : accessibleBranchIds.length
    ? accessibleBranchIds
    : [UNMATCHABLE_BRANCH_ID];

  return {
    branchId: branchIds.length === 1 ? branchIds[0] : "",
    branchIds,
    requestedBranchId,
    isAllBranches: false,
    canViewAllBranches: false,
    userBranchId: getUserBranchId(req.user),
    managedBranchIds: getManagedBranchIds(req.user),
  };
};

export const applyBranchScopeToUserFilter = (req, filter = {}) => {
  const scope = resolveBranchScope(req);
  if (scope.branchIds?.length > 1) {
    filter.branch = { $in: scope.branchIds };
  } else if (scope.branchId) {
    filter.branch = scope.branchId;
  }
  return filter;
};

export const getBranchScopedUserIds = async (req, baseFilter = {}) =>
  User.find(applyBranchScopeToUserFilter(req, { ...baseFilter })).distinct("_id");

export const assertCanAccessBranch = (req, branchId) => {
  if (canAccessAllBranches(req.user)) return;

  const requestedBranchId = normalizeBranchId(branchId);
  const accessibleBranchIds = getAccessibleBranchIds(req.user);

  if (!requestedBranchId || !accessibleBranchIds.includes(requestedBranchId)) {
    throw createBranchAccessError();
  }
};

export const assertCanAccessWorkerBranch = (req, worker) => {
  if (canAccessAllBranches(req.user)) return;

  const workerBranchId = getUserBranchId(worker);
  const accessibleBranchIds = getAccessibleBranchIds(req.user);

  if (!workerBranchId || !accessibleBranchIds.includes(workerBranchId)) {
    throw createBranchAccessError();
  }
};

export const getBranchScopeMeta = (req, scope = resolveBranchScope(req)) => ({
  selectedBranchId: scope.isAllBranches ? "all" : scope.branchId || null,
  selectedBranchIds: scope.isAllBranches ? [] : scope.branchIds || [],
  requestedBranchId: scope.requestedBranchId || null,
  userBranchId: scope.userBranchId || null,
  managedBranchIds: scope.managedBranchIds || [],
  canViewAllBranches: scope.canViewAllBranches,
  isAllBranches: scope.isAllBranches,
});
