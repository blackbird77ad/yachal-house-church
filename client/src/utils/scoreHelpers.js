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

const getScoreValue = (scoreBreakdown, key, fallbackPassed, fullWeight) => {
  if (scoreBreakdown && typeof scoreBreakdown[key] === "number") {
    return scoreBreakdown[key];
  }
  return fallbackPassed ? fullWeight : 0;
};

export const getCriteriaStatus = (breakdown, scoreBreakdown = null) => {
  if (!breakdown) return [];

  const minSouls = QUALIFICATION_CRITERIA.MIN_SOULS ?? 10;
  const minFellowshipHours = QUALIFICATION_CRITERIA.MIN_FELLOWSHIP_HOURS ?? 2;
  const minChurchAttendees = QUALIFICATION_CRITERIA.MIN_CHURCH_ATTENDEES ?? 4;
  const minCellPrayerHours = QUALIFICATION_CRITERIA.MIN_CELL_PRAYER_HOURS ?? 2;

  const cellAttendancePassed =
    typeof breakdown.cellAttendanceQualified === "boolean"
      ? breakdown.cellAttendanceQualified
      : !!breakdown.cellQualified;

  const cellPrayerPassed =
    typeof breakdown.cellPrayerQualified === "boolean"
      ? breakdown.cellPrayerQualified
      : false;

  return [
    {
      key: "soulsQualified",
      label: `Souls preached to — min ${minSouls}`,
      weight: 30,
      passed: !!breakdown.soulsQualified,
      score: getScoreValue(scoreBreakdown, "soulsScore", !!breakdown.soulsQualified, 30),
      reason: !breakdown.soulsQualified ? "Minimum of 10 souls required" : null,
    },
    {
      key: "tuesdayQualified",
      label: "Tuesday service attended",
      weight: 10,
      passed: !!breakdown.tuesdayQualified,
      score: getScoreValue(scoreBreakdown, "tuesdayScore", !!breakdown.tuesdayQualified, 10),
      reason: !breakdown.tuesdayQualified ? "Did not attend Tuesday service" : null,
    },
    {
      key: "sundayQualified",
      label: "Sunday service attended",
      weight: 10,
      passed: !!breakdown.sundayQualified,
      score: getScoreValue(scoreBreakdown, "sundayScore", !!breakdown.sundayQualified, 10),
      reason: !breakdown.sundayQualified ? "Did not attend Sunday service" : null,
    },
    {
      key: "fellowshipQualified",
      label: `Fellowship prayer — min ${minFellowshipHours} hours`,
      weight: 10,
      passed: !!breakdown.fellowshipQualified,
      score: getScoreValue(scoreBreakdown, "fellowshipScore", !!breakdown.fellowshipQualified, 10),
      reason: !breakdown.fellowshipQualified
        ? `Fellowship prayer less than ${minFellowshipHours} hours`
        : null,
    },
    {
      key: "cellAttendanceQualified",
      label: "Cell meeting — attended at least once",
      weight: 10,
      passed: cellAttendancePassed,
      score: getScoreValue(scoreBreakdown, "cellAttendanceScore", cellAttendancePassed, 10),
      reason: !cellAttendancePassed ? "Did not attend cell meeting" : null,
    },
    {
      key: "cellPrayerQualified",
      label: `Cell prayer — min ${minCellPrayerHours} hours`,
      weight: 10,
      passed: cellPrayerPassed,
      score: getScoreValue(scoreBreakdown, "cellPrayerScore", cellPrayerPassed, 10),
      reason: !cellPrayerPassed
        ? `Cell prayer less than ${minCellPrayerHours} hours`
        : null,
    },
    {
      key: "attendanceQualified",
      label: `People 12+ brought to church — min ${minChurchAttendees}`,
      weight: 20,
      passed: !!breakdown.attendanceQualified,
      score: getScoreValue(scoreBreakdown, "attendeesScore", !!breakdown.attendanceQualified, 20),
      reason: !breakdown.attendanceQualified
        ? `Minimum of ${minChurchAttendees} people required`
        : null,
    },
  ];
};

export const calculateClosenessToQualification = (breakdown, scoreBreakdown = null) => {
  if (!breakdown) return 0;

  if (scoreBreakdown) {
    const total =
      (Number(scoreBreakdown.soulsScore) || 0) +
      (Number(scoreBreakdown.tuesdayScore) || 0) +
      (Number(scoreBreakdown.sundayScore) || 0) +
      (Number(scoreBreakdown.fellowshipScore) || 0) +
      (Number(scoreBreakdown.cellAttendanceScore) || 0) +
      (Number(scoreBreakdown.cellPrayerScore) || 0) +
      (Number(scoreBreakdown.attendeesScore) || 0);

    return Math.round(total);
  }

  const criteria = [
    !!breakdown.soulsQualified,
    !!breakdown.tuesdayQualified,
    !!breakdown.sundayQualified,
    !!breakdown.fellowshipQualified,
    typeof breakdown.cellAttendanceQualified === "boolean"
      ? breakdown.cellAttendanceQualified
      : !!breakdown.cellQualified,
    typeof breakdown.cellPrayerQualified === "boolean"
      ? breakdown.cellPrayerQualified
      : false,
    !!breakdown.attendanceQualified,
  ];

  const passed = criteria.filter(Boolean).length;
  return Math.round((passed / criteria.length) * 100);
};

export const compareQualificationRank = (a, b) => {
  const scoreDiff = (Number(b?.totalScore) || 0) - (Number(a?.totalScore) || 0);
  if (scoreDiff !== 0) return scoreDiff;

  const soulsDiff =
    (Number(b?.qualifyingSouls) || 0) - (Number(a?.qualifyingSouls) || 0);
  if (soulsDiff !== 0) return soulsDiff;

  const attendeesDiff =
    (Number(b?.churchAttendeeCount) || 0) - (Number(a?.churchAttendeeCount) || 0);
  if (attendeesDiff !== 0) return attendeesDiff;

  const fellowshipDiff =
    (Number(b?.fellowshipHours) || 0) - (Number(a?.fellowshipHours) || 0);
  if (fellowshipDiff !== 0) return fellowshipDiff;

  return (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "");
};

export const getScoreLabel = (score) => {
  if (score >= 100) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
};

export const cn = (...classes) => classes.filter(Boolean).join(" ");
