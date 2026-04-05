import { QUALIFICATION_CRITERIA } from "./constants.js";

export const getScoreColor = (score) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

export const getScoreBgColor = (score) => {
  if (score >= 80) return "bg-green-100 dark:bg-green-900";
  if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900";
  if (score >= 40) return "bg-orange-100 dark:bg-orange-900";
  return "bg-red-100 dark:bg-red-900";
};

export const getQualificationBadge = (isQualified) => {
  return isQualified
    ? { label: "Qualified", className: "badge-success" }
    : { label: "Not Qualified", className: "badge-danger" };
};

export const getCriteriaStatus = (breakdown) => {
  if (!breakdown) return [];
  return [
    {
      key: "soulsQualified",
      label: `Souls preached to (min ${QUALIFICATION_CRITERIA.MIN_SOULS})`,
      passed: breakdown.soulsQualified,
    },
    {
      key: "fellowshipQualified",
      label: `Fellowship prayer (min ${QUALIFICATION_CRITERIA.MIN_FELLOWSHIP_HOURS}hrs)`,
      passed: breakdown.fellowshipQualified,
    },
    {
      key: "cellQualified",
      label: `Cell prayer (min ${QUALIFICATION_CRITERIA.MIN_CELL_HOURS}hrs)`,
      passed: breakdown.cellQualified,
    },
    {
      key: "attendanceQualified",
      label: `Service attendance (min ${QUALIFICATION_CRITERIA.MIN_SERVICE_ATTENDANCE} counts)`,
      passed: breakdown.attendanceQualified,
    },
    {
      key: "reportQualified",
      label: "Report submitted on time",
      passed: breakdown.reportQualified,
    },
  ];
};

export const calculateClosenessToQualification = (breakdown) => {
  if (!breakdown) return 0;
  const criteria = Object.values(breakdown);
  const passed = criteria.filter(Boolean).length;
  return Math.round((passed / criteria.length) * 100);
};

export const getScoreLabel = (score) => {
  if (score >= 100) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
};

export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};