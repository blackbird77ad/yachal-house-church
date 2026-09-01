import mongoose from "mongoose";
import Branch from "../models/branchModel.js";
import User from "../models/userModel.js";
import {
  ADMIN_ROLES,
  SUPER_ADMIN_WORKER_ID,
  assertCanAccessBranch,
  canAccessAllBranches,
  getAccessibleBranchIds,
  normalizeBranchId,
} from "../utils/branchAccess.js";

const branchSelect = "name code location contactEmail contactPhone status adminUsers adminCanViewAllBranches createdAt updatedAt";
const adminSelect = "fullName email phone workerId role department branch managedBranches branchRole canViewAllBranches status";

const makeBranchCode = (name = "") =>
  name
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

const getValidObjectIds = (values = []) =>
  [...new Set(values.map((value) => String(value)).filter((value) => mongoose.Types.ObjectId.isValid(value)))];

const readBranchPayload = (body = {}) => ({
  name: body.name?.toString().trim(),
  code: body.code !== undefined
    ? body.code?.toString().trim().toUpperCase() || makeBranchCode(body.name)
    : makeBranchCode(body.name),
  location: body.location !== undefined ? body.location?.toString().trim() || "" : undefined,
  contactEmail: body.contactEmail !== undefined
    ? body.contactEmail?.toString().trim().toLowerCase() || ""
    : undefined,
  contactPhone: body.contactPhone !== undefined ? body.contactPhone?.toString().trim() || "" : undefined,
  status: body.status,
  adminUsers: Array.isArray(body.adminUsers)
    ? getValidObjectIds(body.adminUsers)
    : undefined,
  workerUsers: Array.isArray(body.workerUsers)
    ? getValidObjectIds(body.workerUsers)
    : undefined,
  adminIdentifiers: [
    ...new Set(
      [
        ...(Array.isArray(body.adminIdentifiers) ? body.adminIdentifiers : []),
        body.adminIdentifier,
      ]
        .flatMap((value) => String(value || "").split(/[\n,]+/))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ],
  workerIdentifiers: [
    ...new Set(
      [
        ...(Array.isArray(body.workerIdentifiers) ? body.workerIdentifiers : []),
        body.workerIdentifier,
      ]
        .flatMap((value) => String(value || "").split(/[\n,]+/))
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ],
  adminCanViewAllBranches:
    body.adminCanViewAllBranches === undefined
      ? undefined
      : body.adminCanViewAllBranches !== false,
});

const normalizePhone = (value = "") => value.toString().replace(/[^\d+]/g, "");

const getUserSearchFields = (user = {}) => ({
  fullName: user.fullName?.toString().trim().toLowerCase() || "",
  email: user.email?.toString().trim().toLowerCase() || "",
  workerId: user.workerId?.toString().trim().toLowerCase() || "",
  rawPhone: user.phone?.toString().trim() || "",
  phone: normalizePhone(user.phone),
});

const userMatchesIdentifier = (user, identifier, { allowPartial = false } = {}) => {
  const raw = identifier?.toString().trim() || "";
  const term = raw.toLowerCase();
  const phone = normalizePhone(raw);
  const fields = getUserSearchFields(user);

  if (!term) return false;

  if (
    fields.email === term ||
    fields.fullName === term ||
    fields.workerId === term ||
    fields.rawPhone === raw ||
    (phone && fields.phone === phone)
  ) {
    return true;
  }

  if (!allowPartial) return false;

  const canMatchText = term.length >= 2;
  const canMatchPhone = phone.length >= 4;

  return (
    (canMatchText &&
      [fields.email, fields.fullName, fields.workerId]
        .filter(Boolean)
        .some((field) => field.includes(term))) ||
    (canMatchPhone && fields.phone.includes(phone))
  );
};

const resolveUserIdsFromSelection = async (selectedValues = [], identifierValues = []) => {
  const selectedIds = getValidObjectIds(selectedValues || []);
  const identifiers = [
    ...new Set(
      (identifierValues || [])
        .map((value) => value?.toString().trim())
        .filter(Boolean)
    ),
  ];
  if (identifiers.length === 0) {
    return { adminIds: selectedIds, userIds: selectedIds, unmatched: [], ambiguous: [] };
  }

  const approvedUsers = await User.find({
    status: "approved",
    workerId: { $ne: SUPER_ADMIN_WORKER_ID },
  }).select("_id fullName email phone workerId");

  const matchedIds = new Set(selectedIds);
  const unmatched = [];
  const ambiguous = [];

  identifiers.forEach((identifier) => {
    const exactMatches = approvedUsers.filter((user) =>
      userMatchesIdentifier(user, identifier)
    );

    if (exactMatches.length === 1) {
      matchedIds.add(exactMatches[0]._id.toString());
      return;
    }

    if (exactMatches.length > 1) {
      ambiguous.push(identifier);
      return;
    }

    const partialMatches = approvedUsers.filter((user) =>
      userMatchesIdentifier(user, identifier, { allowPartial: true })
    );

    if (partialMatches.length === 1) {
      matchedIds.add(partialMatches[0]._id.toString());
      return;
    }

    if (partialMatches.length > 1) {
      ambiguous.push(identifier);
      return;
    }

    unmatched.push(identifier);
  });

  return {
    adminIds: [...matchedIds],
    userIds: [...matchedIds],
    unmatched,
    ambiguous,
  };
};

const resolveAdminUserIds = async (payload = {}) =>
  resolveUserIdsFromSelection(payload.adminUsers || [], payload.adminIdentifiers || []);

const resolveWorkerUserIds = async (payload = {}) =>
  resolveUserIdsFromSelection(payload.workerUsers || [], payload.workerIdentifiers || []);

const getResolvedUserError = (label, resolved = {}) => {
  const messages = [];

  if (resolved.unmatched?.length) {
    messages.push(`No approved ${label} matched: ${resolved.unmatched.join(", ")}.`);
  }

  if (resolved.ambiguous?.length) {
    messages.push(
      `More than one approved ${label} matched: ${resolved.ambiguous.join(", ")}. Use the user list to select the exact person.`
    );
  }

  return messages.join(" ");
};

const assignWorkersToBranch = async (branch, workerIds = []) => {
  const selectedWorkerIds = getValidObjectIds(workerIds);
  if (selectedWorkerIds.length === 0) return 0;

  const result = await User.updateMany(
    {
      _id: { $in: selectedWorkerIds },
      workerId: { $ne: SUPER_ADMIN_WORKER_ID },
      status: "approved",
    },
    { $set: { branch: branch._id } }
  );

  return result.modifiedCount ?? result.nModified ?? 0;
};

const applyBranchAdminAssignments = async (branch, adminIds = [], previousAdminIds = []) => {
  const selectedAdminIds = getValidObjectIds(adminIds);
  const previous = new Set(getValidObjectIds(previousAdminIds));
  const selected = new Set(selectedAdminIds);
  const removedAdminIds = [...previous].filter((id) => !selected.has(id));

  branch.adminUsers = selectedAdminIds;
  await branch.save();

  for (const adminId of removedAdminIds) {
    const user = await User.findOne({
      _id: adminId,
      workerId: { $ne: SUPER_ADMIN_WORKER_ID },
    }).select("role managedBranches canViewAllBranches branchRole");

    if (!user) continue;

    user.managedBranches = (user.managedBranches || []).filter(
      (managedBranchId) => String(managedBranchId) !== String(branch._id)
    );

    if (!user.managedBranches.length && user.canViewAllBranches === false) {
      user.branchRole = "member";
      if (["admin", "moderator"].includes(user.role)) {
        user.role = "worker";
      }
    }

    await user.save();
  }

  if (selectedAdminIds.length === 0) return;

  const users = await User.find({
    _id: { $in: selectedAdminIds },
    workerId: { $ne: SUPER_ADMIN_WORKER_ID },
  }).select("role branch managedBranches branchRole canViewAllBranches");

  for (const user of users) {
    const wasAdminRole = ADMIN_ROLES.includes(user.role);
    const wasAllBranchAdmin = wasAdminRole && user.canViewAllBranches !== false;

    if (!wasAdminRole) {
      user.role = "admin";
    }

    if (!user.branch) {
      user.branch = branch._id;
    }

    const managedBranches = new Set(
      (user.managedBranches || []).map((managedBranchId) => String(managedBranchId))
    );
    managedBranches.add(String(branch._id));
    user.managedBranches = [...managedBranches];
    user.branchRole = "branch-admin";
    user.canViewAllBranches = wasAllBranchAdmin || branch.adminCanViewAllBranches;
    await user.save();
  }
};

const attachBranchStats = async (branches = []) => {
  const branchIds = branches.map((branch) => branch._id);

  const stats = branchIds.length
    ? await User.aggregate([
        { $match: { branch: { $in: branchIds } } },
        {
          $group: {
            _id: "$branch",
            totalWorkers: { $sum: 1 },
            approvedWorkers: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            pendingWorkers: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            suspendedWorkers: {
              $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] },
            },
            adminCount: {
              $sum: { $cond: [{ $in: ["$role", ADMIN_ROLES] }, 1, 0] },
            },
          },
        },
      ])
    : [];

  const statsByBranch = new Map(
    stats.map((item) => [String(item._id), item])
  );

  return branches.map((branch) => {
    const data = branch.toObject ? branch.toObject() : branch;
    const branchStats = statsByBranch.get(String(data._id)) || {};

    return {
      ...data,
      stats: {
        totalWorkers: branchStats.totalWorkers || 0,
        approvedWorkers: branchStats.approvedWorkers || 0,
        pendingWorkers: branchStats.pendingWorkers || 0,
        suspendedWorkers: branchStats.suspendedWorkers || 0,
        adminCount: branchStats.adminCount || 0,
      },
    };
  });
};

export const getPublicBranches = async (req, res, next) => {
  try {
    const branches = await Branch.find({ status: "active" })
      .select("name code location")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({ branches });
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    const accessibleBranchIds = getAccessibleBranchIds(req.user);

    if (["active", "suspended"].includes(status)) {
      filter.status = status;
    }

    if (!canAccessAllBranches(req.user)) {
      filter._id = { $in: accessibleBranchIds.length ? accessibleBranchIds : [] };
    }

    const branches = await Branch.find(filter)
      .select(branchSelect)
      .populate("adminUsers", adminSelect)
      .sort({ name: 1 });

    res.status(200).json({ branches: await attachBranchStats(branches) });
  } catch (error) {
    next(error);
  }
};

export const getBranchAdminCandidates = async (req, res, next) => {
  try {
    const users = await User.find({
      status: "approved",
      workerId: { $ne: SUPER_ADMIN_WORKER_ID },
    })
      .select(adminSelect)
      .populate("branch", "name code status")
      .populate("managedBranches", "name code status")
      .sort({ fullName: 1 })
      .lean();

    res.status(200).json({ admins: users, users });
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req, res, next) => {
  try {
    const payload = readBranchPayload(req.body);
    const resolvedAdmins = await resolveAdminUserIds(payload);
    const resolvedWorkers = await resolveWorkerUserIds(payload);

    if (!payload.name || !payload.code) {
      return res.status(400).json({ message: "Branch name and code are required." });
    }

    const adminResolutionError = getResolvedUserError("user", resolvedAdmins);
    if (adminResolutionError) {
      return res.status(400).json({ message: adminResolutionError });
    }

    const workerResolutionError = getResolvedUserError("worker", resolvedWorkers);
    if (workerResolutionError) {
      return res.status(400).json({ message: workerResolutionError });
    }

    const branch = await Branch.create({
      name: payload.name,
      code: payload.code,
      location: payload.location || "",
      contactEmail: payload.contactEmail || "",
      contactPhone: payload.contactPhone || "",
      status: ["active", "suspended"].includes(payload.status) ? payload.status : "active",
      adminUsers: [],
      adminCanViewAllBranches: canAccessAllBranches(req.user)
        ? payload.adminCanViewAllBranches === true
        : false,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const branchAdminIds = canAccessAllBranches(req.user)
      ? resolvedAdmins.userIds
      : [...new Set([...resolvedAdmins.userIds, req.user._id.toString()])];

    await applyBranchAdminAssignments(branch, branchAdminIds);
    await assignWorkersToBranch(branch, resolvedWorkers.userIds);

    const populated = await Branch.findById(branch._id)
      .select(branchSelect)
      .populate("adminUsers", adminSelect);

    res.status(201).json({
      message: `${branch.name} branch has been created.`,
      branch: (await attachBranchStats([populated]))[0],
    });
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    const branchId = normalizeBranchId(req.params.branchId);
    assertCanAccessBranch(req, branchId);
    const branch = await Branch.findById(branchId);

    if (!branch) {
      return res.status(404).json({ message: "Branch not found." });
    }

    const payload = readBranchPayload(req.body);
    const resolvedAdmins = await resolveAdminUserIds(payload);
    const resolvedWorkers = await resolveWorkerUserIds(payload);
    const previousAdminIds = branch.adminUsers.map((id) => String(id));

    const adminResolutionError = getResolvedUserError("user", resolvedAdmins);
    if (adminResolutionError) {
      return res.status(400).json({ message: adminResolutionError });
    }

    const workerResolutionError = getResolvedUserError("worker", resolvedWorkers);
    if (workerResolutionError) {
      return res.status(400).json({ message: workerResolutionError });
    }

    if (payload.name) branch.name = payload.name;
    if (payload.code) branch.code = payload.code;
    if (payload.location !== undefined) branch.location = payload.location;
    if (payload.contactEmail !== undefined) branch.contactEmail = payload.contactEmail;
    if (payload.contactPhone !== undefined) branch.contactPhone = payload.contactPhone;
    if (["active", "suspended"].includes(payload.status)) {
      branch.status = payload.status;
    }
    if (payload.adminCanViewAllBranches !== undefined) {
      branch.adminCanViewAllBranches = canAccessAllBranches(req.user)
        ? payload.adminCanViewAllBranches
        : false;
    }
    branch.updatedBy = req.user._id;

    if (payload.adminUsers !== undefined || payload.adminIdentifiers.length > 0) {
      const branchAdminIds = canAccessAllBranches(req.user)
        ? resolvedAdmins.userIds
        : [...new Set([...resolvedAdmins.userIds, req.user._id.toString()])];
      await applyBranchAdminAssignments(branch, branchAdminIds, previousAdminIds);
    } else {
      await branch.save();
    }
    await assignWorkersToBranch(branch, resolvedWorkers.userIds);

    const populated = await Branch.findById(branch._id)
      .select(branchSelect)
      .populate("adminUsers", adminSelect);

    res.status(200).json({
      message: `${branch.name} branch has been updated.`,
      branch: (await attachBranchStats([populated]))[0],
    });
  } catch (error) {
    next(error);
  }
};

export const suspendBranch = async (req, res, next) => {
  try {
    assertCanAccessBranch(req, req.params.branchId);
    const branch = await Branch.findByIdAndUpdate(
      req.params.branchId,
      { status: "suspended", updatedBy: req.user._id },
      { new: true }
    )
      .select(branchSelect)
      .populate("adminUsers", adminSelect);

    if (!branch) {
      return res.status(404).json({ message: "Branch not found." });
    }

    res.status(200).json({
      message: `${branch.name} branch has been suspended.`,
      branch: (await attachBranchStats([branch]))[0],
    });
  } catch (error) {
    next(error);
  }
};

export const reinstateBranch = async (req, res, next) => {
  try {
    assertCanAccessBranch(req, req.params.branchId);
    const branch = await Branch.findByIdAndUpdate(
      req.params.branchId,
      { status: "active", updatedBy: req.user._id },
      { new: true }
    )
      .select(branchSelect)
      .populate("adminUsers", adminSelect);

    if (!branch) {
      return res.status(404).json({ message: "Branch not found." });
    }

    res.status(200).json({
      message: `${branch.name} branch has been reactivated.`,
      branch: (await attachBranchStats([branch]))[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBranch = async (req, res, next) => {
  try {
    assertCanAccessBranch(req, req.params.branchId);
    const branch = await Branch.findById(req.params.branchId);

    if (!branch) {
      return res.status(404).json({ message: "Branch not found." });
    }

    const assignedUsers = await User.countDocuments({ branch: branch._id });

    await User.updateMany(
      { branch: branch._id },
      {
        $unset: { branch: "" },
        $set: { branchRole: "member" },
      }
    );

    await User.updateMany(
      { managedBranches: branch._id },
      {
        $pull: { managedBranches: branch._id },
      }
    );

    const affectedAdmins = await User.find({
      workerId: { $ne: SUPER_ADMIN_WORKER_ID },
      role: { $in: ADMIN_ROLES },
      canViewAllBranches: false,
    }).select("role managedBranches branchRole");

    for (const admin of affectedAdmins) {
      admin.branchRole = admin.managedBranches?.length ? "branch-admin" : "member";
      if (!admin.managedBranches?.length && ["admin", "moderator"].includes(admin.role)) {
        admin.role = "worker";
      }
      await admin.save();
    }

    await Branch.deleteOne({ _id: branch._id });

    res.status(200).json({
      message: `${branch.name} branch has been permanently deleted. ${assignedUsers} user${assignedUsers === 1 ? "" : "s"} were moved to no branch.`,
      unassignedUsers: assignedUsers,
    });
  } catch (error) {
    next(error);
  }
};
