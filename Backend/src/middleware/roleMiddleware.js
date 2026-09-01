import { canAccessAllBranches } from "../utils/branchAccess.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. This action requires one of the following roles: ${roles.join(", ")}.`,
      });
    }

    next();
  };
};

export const isAdminLevel = authorizeRoles("pastor", "admin", "moderator");
export const isAdmin = authorizeRoles("pastor", "admin");
export const isPastor = authorizeRoles("pastor");
export const isWorker = authorizeRoles("pastor", "admin", "moderator", "worker");

export const hasAllBranchOversight = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized." });
  }

  if (!canAccessAllBranches(req.user)) {
    return res.status(403).json({
      message: "Portal control requires all-branch oversight.",
    });
  }

  next();
};
