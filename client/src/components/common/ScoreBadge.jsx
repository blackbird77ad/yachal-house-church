import { cn, getScoreColor, getScoreBgColor, getScoreLabel } from "../../utils/scoreHelpers";
import { Trophy } from "lucide-react";

const ScoreBadge = ({ score = 0, isQualified = false, showLabel = true, size = "md" }) => {
  const sizes = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full font-medium", sizes[size], getScoreBgColor(score), getScoreColor(score))}>
      <Trophy className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      <span>{score}</span>
      {showLabel && <span className="opacity-75">- {getScoreLabel(score)}</span>}
      {isQualified && (
        <span className="ml-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          Qualified
        </span>
      )}
    </div>
  );
};

export default ScoreBadge;