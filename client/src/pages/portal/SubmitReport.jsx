import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Calendar,
  ChevronRight,
  Edit2,
  Lock,
  FolderOpen,
} from "lucide-react";
import { getPortalStatus } from "../../services/portalService";
import { getMyReports } from "../../services/reportService";
import { REPORT_TYPES } from "../../utils/constants";
import EvangelismForm from "../../components/forms/EvangelismForm";
import CellForm from "../../components/forms/CellForm";
import ProductionForm from "../../components/forms/ProductionForm";
import FellowshipForm from "../../components/forms/FellowshipForm";
import BriefForm from "../../components/forms/BriefForm";
import DepartmentalForm from "../../components/forms/DepartmentalForm";
import Loader from "../../components/common/Loader";
import { cn } from "../../utils/scoreHelpers";
import { getPreviousWeekReference, getWeekLabel, getWeekReference } from "../../utils/formatDate";

const FORMS = {
  evangelism: EvangelismForm,
  cell: CellForm,
  production: ProductionForm,
  "fellowship-prayer": FellowshipForm,
  brief: BriefForm,
  departmental: DepartmentalForm,
};

const WeekModal = ({ onSelect, onClose }) => {
  const prevWeek = getPreviousWeekReference();
  const [lateDate, setLateDate] = useState(prevWeek.toISOString().split("T")[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 animate-slide-up">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
          Which week is this report for?
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Previous week reports cannot be edited after submission.
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => onSelect("current", null)}
            className="w-full p-4 border-2 border-green-200 dark:border-green-800 rounded-xl text-left hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">Current week</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {getWeekLabel(getWeekReference())}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Editable until Monday 2:59pm. One submission per report type.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </div>
          </button>

          <div className="p-4 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-slate-100">
                  Previous week (arrears)
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Once submitted this cannot be edited. Select the Monday of the week.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="form-label">Week starting (Monday)</label>
                <input
                  type="date"
                  className="input-field"
                  value={lateDate}
                  onChange={(e) => setLateDate(e.target.value)}
                  max={prevWeek.toISOString().split("T")[0]}
                />
              </div>

              <button
                onClick={() => lateDate && onSelect("late", lateDate)}
                disabled={!lateDate}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                Continue with Previous Week
              </button>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="btn-ghost w-full text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
};

const SubmitReport = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [portal, setPortal] = useState(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [submittedThisWeek, setSubmittedThisWeek] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [weekType, setWeekType] = useState(null);
  const [lateWeekDate, setLateWeekDate] = useState(null);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [pendingType, setPendingType] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [fromDraft, setFromDraft] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);

  const fetchPortal = async () => {
    try {
      const data = await getPortalStatus();
      setPortal(data);
    } catch {
      setPortal({ isOpen: false });
    } finally {
      setPortalLoading(false);
    }
  };

  const fetchSubmitted = async () => {
    try {
      const { reports } = await getMyReports({
        weekType: "current",
        status: "submitted",
        limit: 100,
      });
      setSubmittedThisWeek(reports || []);
    } catch {}
  };

  useEffect(() => {
    fetchPortal();
    fetchSubmitted();

    const interval = setInterval(fetchPortal, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const reportType = searchParams.get("reportType");
    const qpWeekType = searchParams.get("weekType");
    const qpWeekDate = searchParams.get("weekDate");
    const draft = searchParams.get("draft");
    const edit = searchParams.get("edit");
    const reportId = searchParams.get("reportId");

    if (!reportType) return;
    if (!FORMS[reportType]) return;

    setSelectedType(reportType);
    setWeekType(qpWeekType === "late" ? "late" : "current");
    setLateWeekDate(qpWeekDate || null);
    setEditMode(edit === "1");
    setFromDraft(draft === "1");
    setSelectedReportId(reportId || null);
  }, [searchParams]);

  const getSubmittedReport = (typeValue) =>
    submittedThisWeek.find((r) => r.reportType === typeValue && !r.isLateSubmission);

  const handleTypeClick = (type) => {
    const existing = getSubmittedReport(type);

    if (existing && !editMode) {
      setShowWeekModal(false);
      setSelectedType(type);
      setWeekType("current");
      setLateWeekDate(null);
      setEditMode(true);
      setSelectedReportId(existing._id);
      setFromDraft(false);
      setSearchParams({
        reportType: type,
        weekType: "current",
        edit: "1",
        reportId: existing._id,
      });
    } else {
      setPendingType(type);
      setShowWeekModal(true);
    }
  };

  const handleWeekSelect = (type, date) => {
    setWeekType(type);
    setLateWeekDate(date);
    setSelectedType(pendingType);
    setEditMode(false);
    setShowWeekModal(false);
    setPendingType(null);
    setFromDraft(false);
    setSelectedReportId(null);

    const params = new URLSearchParams();
    params.set("reportType", pendingType);
    params.set("weekType", type);
    if (date) params.set("weekDate", date);
    setSearchParams(params);
  };

  const handleBack = () => {
    setSelectedType(null);
    setWeekType(null);
    setLateWeekDate(null);
    setPendingType(null);
    setEditMode(false);
    setFromDraft(false);
    setSelectedReportId(null);
    setSearchParams({});
    fetchSubmitted();
  };

  if (portalLoading) return <Loader text="Checking portal status..." />;

  const FormComponent = selectedType ? FORMS[selectedType] : null;
  const currentWeekLabel = getWeekLabel(getWeekReference());
  const resolvedWeekReference = lateWeekDate
    ? new Date(lateWeekDate).toISOString()
    : portal?.weekReference
    ? new Date(portal.weekReference).toISOString()
    : getWeekReference().toISOString();

  return (
    <div className="space-y-6 animate-fade-in">
      {showWeekModal && (
        <WeekModal
          onSelect={handleWeekSelect}
          onClose={() => {
            setShowWeekModal(false);
            setPendingType(null);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Submit Report</h1>
          <p className="section-subtitle">
            Drafts save automatically. Submit during the open window.
          </p>
        </div>

        <button onClick={fetchPortal} className="btn-ghost text-xs py-1.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div
        className={cn(
          "rounded-xl border px-5 py-4 flex items-start gap-3",
          portal?.isOpen
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
        )}
      >
        {portal?.isOpen ? (
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        )}

        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              portal?.isOpen
                ? "text-green-800 dark:text-green-300"
                : "text-amber-800 dark:text-amber-300"
            )}
          >
            {portal?.isOpen
              ? `Portal is open. ${
                  portal.timeLeft
                    ? `Closes in ${portal.timeLeft.hours}h ${portal.timeLeft.minutes}m.`
                    : ""
                }`
              : "Portal is currently closed. Drafts are still saved."}
          </p>
          <p
            className={cn(
              "text-xs mt-0.5",
              portal?.isOpen
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {portal?.isOpen
              ? `Select a report type below. ${currentWeekLabel}.`
              : "Fill your report anytime. Submission opens every Friday."}
          </p>
        </div>
      </div>

      {!selectedType && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-2">Select Report Type</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
            Types with a green tick have already been submitted this week. Click to edit them.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((type) => {
              const submitted = getSubmittedReport(type.value);

              return (
                <button
                  key={type.value}
                  onClick={() => handleTypeClick(type.value)}
                  className={cn(
                    "p-4 border-2 rounded-xl text-left transition-all hover:shadow-sm group relative",
                    submitted
                      ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 hover:border-green-400"
                      : "border-gray-100 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <FileText
                      className={cn(
                        "w-5 h-5",
                        submitted
                          ? "text-green-600 dark:text-green-400"
                          : "text-purple-600 dark:text-purple-400"
                      )}
                    />

                    {submitted ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Submitted
                      </span>
                    ) : !portal?.isOpen ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Draft only
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {type.label}
                  </p>

                  {submitted && portal?.isOpen && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                      <Edit2 className="w-3 h-3" />
                      Click to edit
                    </p>
                  )}

                  {submitted && !portal?.isOpen && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Portal closed
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedType && FormComponent && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button onClick={handleBack} className="btn-ghost text-sm py-1.5">
              Back
            </button>

            <h2 className="font-bold text-gray-900 dark:text-slate-100">
              {REPORT_TYPES.find((t) => t.value === selectedType)?.label}
            </h2>

            {weekType === "late" ? (
              <span className="badge-warning">
                Arrears: {lateWeekDate ? getWeekLabel(new Date(lateWeekDate)) : "Previous week"}
              </span>
            ) : (
              <span className="badge-success">Current week</span>
            )}

            {editMode && (
              <span className="badge-info flex items-center gap-1">
                <Edit2 className="w-3 h-3" />
                Editing
              </span>
            )}

            {fromDraft && (
              <span className="badge-warning flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                Draft
              </span>
            )}

            {!portal?.isOpen && <span className="badge-warning">Draft mode</span>}
          </div>

          <FormComponent
            weekType={weekType || "current"}
            weekDate={lateWeekDate || null}
            weekReference={resolvedWeekReference}
            portalOpen={portal?.isOpen}
            isArrears={weekType === "late"}
            isEditMode={editMode}
            existingReportId={selectedReportId}
            weekLabel={
              lateWeekDate
                ? getWeekLabel(new Date(lateWeekDate))
                : currentWeekLabel
            }
          />
        </div>
      )}
    </div>
  );
};

export default SubmitReport;
