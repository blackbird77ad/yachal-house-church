import Metrics from "../models/metricsModel.js";
import { normalizeWeekReference } from "../utils/portalWeek.js";
import { normalizeBranchId } from "../utils/branchAccess.js";

export const SERVICE_ROLE_RULES = {
  LEADING_MAIN_CHURCH_MIN: 4,
  LEADING_MIXED_MAIN_MIN: 2,
  LEADING_MIXED_MAIN_MAX: 3,
  LEADING_CELL_MIN: 4,
  SUPPORTING_MAIN_MIN: 2,
  SUPPORTING_MAIN_MAX: 3,
  SUPPORTING_CELL_MIN: 2,
};

const toPlain = (item = {}) =>
  typeof item.toObject === "function"
    ? item.toObject({ depopulate: false })
    : item;

const getCount = (value) => Number(value || 0) || 0;

const isSubmittedEntry = (entry = {}) =>
  entry.submittedReport !== false && entry.reportSubmitted !== false;

const shouldExcludeWorker = (worker = {}) => worker?.workerId === "001";

const getBranchIdFromWorker = (worker = {}) =>
  worker?.branch?._id?.toString?.() || worker?.branch?.toString?.() || "";

const getBranchIdsFromOptions = ({ branchId, branchIds } = {}) => {
  const values = Array.isArray(branchIds) ? branchIds : [branchId];
  return [...new Set(values.map(normalizeBranchId).filter(Boolean))];
};

export const getQualificationStatus = (entry = {}) => {
  if (!isSubmittedEntry(entry)) {
    return {
      key: "not-qualified",
      label: "No Report",
      rank: 1,
    };
  }

  if (entry.isQualified) {
    return {
      key: "qualified",
      label: "Qualified",
      rank: 3,
    };
  }

  return {
    key: "almost-qualified",
    label: "Almost Qualified",
    rank: 2,
  };
};

export const getServiceRoleQualification = (metric = {}) => {
  const mainChurchCount = getCount(
    metric.mainChurchAttendeeCount ?? metric.churchAttendeeCount
  );
  const cellMeetingPeopleCount = getCount(metric.cellMeetingPeopleCount);

  const leadingByMainChurch =
    mainChurchCount >= SERVICE_ROLE_RULES.LEADING_MAIN_CHURCH_MIN;
  const leadingByMainAndCell =
    mainChurchCount >= SERVICE_ROLE_RULES.LEADING_MIXED_MAIN_MIN &&
    mainChurchCount <= SERVICE_ROLE_RULES.LEADING_MIXED_MAIN_MAX &&
    cellMeetingPeopleCount >= SERVICE_ROLE_RULES.LEADING_CELL_MIN;

  const supportingByMainChurch =
    mainChurchCount >= SERVICE_ROLE_RULES.SUPPORTING_MAIN_MIN &&
    mainChurchCount <= SERVICE_ROLE_RULES.SUPPORTING_MAIN_MAX;
  const supportingByCell =
    cellMeetingPeopleCount >= SERVICE_ROLE_RULES.SUPPORTING_CELL_MIN;

  const leadingQualified = leadingByMainChurch || leadingByMainAndCell;
  const supportingQualified = supportingByMainChurch || supportingByCell;
  const category = leadingQualified
    ? "leading"
    : supportingQualified
    ? "supporting"
    : "none";

  const ruleMatched = leadingByMainChurch
    ? "4+ people to main church services"
    : leadingByMainAndCell
    ? "2-3 people to main services and 4+ people to cell meeting"
    : supportingByMainChurch
    ? "2-3 people to main services"
    : supportingByCell
    ? "2+ people to cell meetings"
    : "Does not meet service role minimums";

  return {
    category,
    leadingQualified,
    supportingQualified,
    mainChurchCount,
    cellMeetingPeopleCount,
    ruleMatched,
  };
};

export const attachServiceRoleQualification = (entry = {}) => {
  const plainEntry = toPlain(entry);
  const serviceRoleQualification = getServiceRoleQualification(plainEntry);
  const qualificationStatus = getQualificationStatus(plainEntry);

  return {
    ...plainEntry,
    serviceRoleQualification,
    serviceRoleCategory: serviceRoleQualification.category,
    qualificationStatus: qualificationStatus.key,
    qualificationStatusLabel: qualificationStatus.label,
  };
};

export const compareServiceRoleQualification = (a, b) => {
  const categoryWeight = { leading: 2, supporting: 1, none: 0 };
  const aRole = a?.serviceRoleQualification || getServiceRoleQualification(a);
  const bRole = b?.serviceRoleQualification || getServiceRoleQualification(b);

  const categoryDiff =
    (categoryWeight[bRole.category] || 0) - (categoryWeight[aRole.category] || 0);
  if (categoryDiff !== 0) return categoryDiff;

  const mainChurchDiff =
    (Number(bRole.mainChurchCount) || 0) - (Number(aRole.mainChurchCount) || 0);
  if (mainChurchDiff !== 0) return mainChurchDiff;

  const cellDiff =
    (Number(bRole.cellMeetingPeopleCount) || 0) -
    (Number(aRole.cellMeetingPeopleCount) || 0);
  if (cellDiff !== 0) return cellDiff;

  const scoreDiff = (Number(b?.totalScore) || 0) - (Number(a?.totalScore) || 0);
  if (scoreDiff !== 0) return scoreDiff;

  return (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "");
};

export const compareRemainingQualificationRank = (a, b) => {
  const aStatus = getQualificationStatus(a);
  const bStatus = getQualificationStatus(b);
  const statusDiff = bStatus.rank - aStatus.rank;
  if (statusDiff !== 0) return statusDiff;

  const scoreDiff = (Number(b?.totalScore) || 0) - (Number(a?.totalScore) || 0);
  if (scoreDiff !== 0) return scoreDiff;

  const soulsDiff =
    (Number(b?.qualifyingSouls) || 0) - (Number(a?.qualifyingSouls) || 0);
  if (soulsDiff !== 0) return soulsDiff;

  const cellMeetingPeopleDiff =
    (Number(b?.cellMeetingPeopleCount) || 0) -
    (Number(a?.cellMeetingPeopleCount) || 0);
  if (cellMeetingPeopleDiff !== 0) return cellMeetingPeopleDiff;

  const attendeesDiff =
    (Number(b?.churchAttendeeCount) || 0) - (Number(a?.churchAttendeeCount) || 0);
  if (attendeesDiff !== 0) return attendeesDiff;

  const fellowshipDiff =
    (Number(b?.fellowshipHours) || 0) - (Number(a?.fellowshipHours) || 0);
  if (fellowshipDiff !== 0) return fellowshipDiff;

  return (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "");
};

export const buildServiceRoleQualificationSummary = (entries = []) => {
  const annotated = entries
    .filter((entry) => entry?.worker && !shouldExcludeWorker(entry.worker))
    .map(attachServiceRoleQualification);

  const leading = annotated
    .filter(
      (entry) => isSubmittedEntry(entry) && entry.serviceRoleCategory === "leading"
    )
    .sort(compareServiceRoleQualification);
  const supporting = annotated
    .filter(
      (entry) =>
        isSubmittedEntry(entry) && entry.serviceRoleCategory === "supporting"
    )
    .sort(compareServiceRoleQualification);
  const remaining = annotated
    .filter((entry) => entry.serviceRoleCategory === "none")
    .sort(compareRemainingQualificationRank);

  return {
    leading,
    supporting,
    remaining,
    notRoleQualified: remaining,
    counts: {
      leading: leading.length,
      supporting: supporting.length,
      remaining: remaining.length,
      notRoleQualified: remaining.length,
      submitted: annotated.filter(isSubmittedEntry).length,
      total: annotated.length,
    },
  };
};

export const getServiceRoleQualificationWeeks = async ({
  weekReference,
  dateFrom,
  dateTo,
  isLateSubmission = false,
  branchId,
  branchIds,
} = {}) => {
  const filter = { isLateSubmission };
  const normalizedBranchIds = getBranchIdsFromOptions({ branchId, branchIds });

  if (weekReference) {
    filter.weekReference = normalizeWeekReference(weekReference);
  } else if (dateFrom || dateTo) {
    filter.weekReference = {};
    if (dateFrom) filter.weekReference.$gte = new Date(dateFrom);
    if (dateTo) filter.weekReference.$lte = new Date(dateTo);
  }

  const metrics = await Metrics.find(filter)
    .populate({
      path: "worker",
      select: "fullName workerId department branch score isQualified",
      populate: { path: "branch", select: "name code status" },
    })
    .sort({
      weekReference: -1,
      mainChurchAttendeeCount: -1,
      cellMeetingPeopleCount: -1,
      churchAttendeeCount: -1,
      totalScore: -1,
    })
    .lean();

  const visibleMetrics = normalizedBranchIds.length
    ? metrics.filter(
        (metric) => normalizedBranchIds.includes(getBranchIdFromWorker(metric.worker))
      )
    : metrics;

  const grouped = new Map();

  visibleMetrics.forEach((metric) => {
    const key = new Date(metric.weekReference).toISOString();
    if (!grouped.has(key)) {
      grouped.set(key, {
        weekReference: metric.weekReference,
        entries: [],
      });
    }

    grouped.get(key).entries.push({
      ...metric,
      submittedReport: !!metric.reportSubmitted,
    });
  });

  return [...grouped.values()].map((week) => ({
    weekReference: week.weekReference,
    ...buildServiceRoleQualificationSummary(week.entries),
  }));
};
