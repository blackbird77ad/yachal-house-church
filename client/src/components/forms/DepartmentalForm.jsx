// import { useState, useEffect } from "react";
// import { Save, Send, CheckCircle } from "lucide-react";
// import { useReports } from "../../hooks/useReports";
// import { useToast, ToastContainer } from "../../components/common/Toast";
// import { cn } from "../../utils/scoreHelpers";

// const ProductionForm = ({
//   weekType,
//   portalOpen,
//   weekDate,
//   isArrears,
//   isEditMode,
//   existingReportId,
// }) => {
//   const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
//   const { toasts, toast, removeToast } = useToast();
//   const [submitted, setSubmitted] = useState(false);

//   const [form, setForm] = useState({
//     meeting: "",
//     meetingDate: "",
//     reportingTime: "",

//     prayer: "",
//     songMinistration: "",
//     media: "",
//     ushering: "",
//     frontDesk: "",
//     serviceCoordination: "",
//     briefWriting: "",
//     security: "",
//     sundaySchool: "",
//     otherDepartment: "",

//     // keep backend-compatible keys
//     preServicePrayers: {
//       thirtyToSixtyMins: "",
//       tenToThirtyMins: "",
//     },

//     duringService: {
//       lateDuty: "",
//     },

//     permissionsSought: "",
//     observations: "",
//     challenges: "",
//     suggestions: "",
//   });

//   const set = (field, value) =>
//     setForm((prev) => ({ ...prev, [field]: value }));

//   const setNested = (group, field, value) =>
//     setForm((prev) => ({
//       ...prev,
//       [group]: {
//         ...prev[group],
//         [field]: value,
//       },
//     }));

//   useEffect(() => {
//     fetchMyDraft({ reportType: "production", weekType, weekDate })
//       .then(({ draft }) => {
//         if (!draft) return;

//         if (draft.status === "submitted" && !isEditMode) {
//           setSubmitted(true);
//           return;
//         }

//         if (draft.productionData) {
//           setForm((prev) => ({
//             ...prev,
//             ...draft.productionData,
//             preServicePrayers: {
//               ...prev.preServicePrayers,
//               ...(draft.productionData.preServicePrayers || {}),
//             },
//             duringService: {
//               ...prev.duringService,
//               ...(draft.productionData.duringService || {}),
//             },
//           }));
//         }
//       })
//       .catch(() => {});
//   }, [weekType, weekDate, isEditMode, fetchMyDraft]);

//   const buildPayload = () => ({
//     reportType: "production",
//     weekType,
//     weekDate,
//     isEdit: isEditMode,
//     productionData: { ...form },
//   });

//   const handleDraft = async () => {
//     try {
//       await handleSaveDraft(buildPayload());
//       toast.success("Draft saved", "Your progress has been saved.");
//     } catch {
//       toast.error("Error", "Could not save draft.");
//     }
//   };

//   const handleFinalSubmit = async () => {
//     if (!portalOpen) {
//       toast.warning("Portal closed", "The portal is not open.");
//       return;
//     }

//     if (!form.meeting) {
//       toast.warning("Required", "Please select the service type.");
//       return;
//     }

//     try {
//       if (isEditMode && existingReportId) {
//         await handleEdit(existingReportId, buildPayload());
//       } else {
//         await handleSubmit(buildPayload());
//       }

//       setSubmitted(true);
//       toast.success(
//         isEditMode ? "Updated" : "Submitted",
//         isEditMode ? "Production report updated." : "Production report submitted."
//       );
//     } catch (err) {
//       toast.error("Error", err.response?.data?.message || "Could not submit.");
//     }
//   };

//   if (submitted) {
//     return (
//       <div className="card p-12 text-center space-y-4">
//         <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
//         <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
//           Production Report Submitted
//         </h3>
//         <p className="text-gray-500 dark:text-slate-400 text-sm">
//           {isArrears ? "Submitted and locked permanently." : "Editable until Monday 2:59pm."}
//         </p>
//         {!isArrears && portalOpen && (
//           <button
//             type="button"
//             onClick={() => setSubmitted(false)}
//             className="btn-outline"
//           >
//             Edit Report
//           </button>
//         )}
//       </div>
//     );
//   }

//   const TextArea = ({ label, value, onChange, placeholder, rows = 2 }) => (
//     <div>
//       <label className="form-label">{label}</label>
//       <textarea
//         className="input-field resize-none"
//         rows={rows}
//         placeholder={placeholder}
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//       />
//     </div>
//   );

//   return (
//     <div className="space-y-6">
//       <ToastContainer toasts={toasts} onClose={removeToast} />

//       <div className="card p-5 space-y-4">
//         <h3 className="font-bold text-gray-900 dark:text-slate-100">Service Details</h3>
//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//           <div>
//             <label className="form-label">
//               Service Type <span className="text-red-400">*</span>
//             </label>
//             <select
//               className="input-field"
//               value={form.meeting}
//               onChange={(e) => set("meeting", e.target.value)}
//             >
//               <option value="">Select service</option>
//               <option value="tuesday">Tuesday Service</option>
//               <option value="sunday">Sunday Service</option>
//               <option value="special">Special Service</option>
//             </select>
//           </div>

//           <div>
//             <label className="form-label">Date</label>
//             <input
//               type="date"
//               className="input-field"
//               value={form.meetingDate}
//               onChange={(e) => set("meetingDate", e.target.value)}
//             />
//           </div>

//           <div>
//             <label className="form-label">Service Coordinator Reporting Time</label>
//             <input
//               type="time"
//               className="input-field"
//               value={form.reportingTime}
//               onChange={(e) => set("reportingTime", e.target.value)}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="card p-5 space-y-4">
//         <h3 className="font-bold text-gray-900 dark:text-slate-100">Department Assignments</h3>
//         <p className="text-xs text-gray-400 dark:text-slate-500">
//           For each department, enter the worker name(s) and time they reported for duty.
//         </p>
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           {[
//             { label: "Prayer", field: "prayer", placeholder: "e.g. Pastor John Doe — 4:00 PM" },
//             { label: "Song Ministration", field: "songMinistration", placeholder: "e.g. Sis Jane Smith (Lead) — 4:15 PM" },
//             { label: "Media", field: "media", placeholder: "e.g. Bro Kwame York — 4:30 PM" },
//             { label: "Ushering", field: "ushering", placeholder: "e.g. Sis Mary Boateng, Sis Abena Mensah — 4:00 PM" },
//             { label: "Front Desk", field: "frontDesk", placeholder: "e.g. Bro Samuel Osei, Grace Adu — 4:00 PM" },
//             { label: "Service Coordination", field: "serviceCoordination", placeholder: "e.g. Pastor Ama Darko — 3:45 PM" },
//             { label: "Brief Writing", field: "briefWriting", placeholder: "e.g. Bro Daniel Tetteh — 4:00 PM" },
//             { label: "Security", field: "security", placeholder: "e.g. Bro Isaac Asare, Bro Emmanuel Ofori — 3:30 PM" },
//             { label: "Sunday School", field: "sundaySchool", placeholder: "e.g. Sis Rejoice Acquah — 4:00 PM" },
//             { label: "Other Departments", field: "otherDepartment", placeholder: "Department name, worker(s), and reporting time" },
//           ].map(({ label, field, placeholder }) => (
//             <TextArea
//               key={field}
//               label={label}
//               value={form[field] || ""}
//               onChange={(v) => set(field, v)}
//               placeholder={placeholder}
//             />
//           ))}
//         </div>
//       </div>

//       <div className="card p-5 space-y-4">
//         <h3 className="font-bold text-gray-900 dark:text-slate-100">Prayer Observation</h3>
//         <p className="text-xs text-gray-400 dark:text-slate-500">
//           List workers on duty who were seen praying into their roles before service.
//         </p>

//         <TextArea
//           label="Workers on duty seen praying 1 hour or more before service"
//           value={form.preServicePrayers.thirtyToSixtyMins}
//           onChange={(v) => setNested("preServicePrayers", "thirtyToSixtyMins", v)}
//           placeholder="Names of workers"
//         />

//         <TextArea
//           label="Workers on duty seen praying at least 30 minutes before service"
//           value={form.preServicePrayers.tenToThirtyMins}
//           onChange={(v) => setNested("preServicePrayers", "tenToThirtyMins", v)}
//           placeholder="Names of workers"
//         />
//       </div>

//       <div className="card p-5 space-y-4">
//         <h3 className="font-bold text-gray-900 dark:text-slate-100">Late Reporting During Service</h3>
//         <p className="text-xs text-gray-400 dark:text-slate-500">
//           Workers who arrived after the service had already started.
//         </p>
//         <TextArea
//           label="Workers who reported late for duty"
//           value={form.duringService.lateDuty}
//           onChange={(v) => setNested("duringService", "lateDuty", v)}
//           placeholder="Names of workers and the time they arrived"
//           rows={3}
//         />
//       </div>

//       <div className="card p-5 space-y-4">
//         <h3 className="font-bold text-gray-900 dark:text-slate-100">
//           Permissions, Observations and Remarks
//         </h3>
//         <TextArea
//           label="Permissions Sought"
//           value={form.permissionsSought}
//           onChange={(v) => set("permissionsSought", v)}
//           placeholder="Worker names and reasons permission was granted"
//         />
//         <TextArea
//           label="Observations and Comments"
//           value={form.observations}
//           onChange={(v) => set("observations", v)}
//           placeholder="General observations about the service..."
//           rows={3}
//         />
//         <TextArea
//           label="Challenges"
//           value={form.challenges}
//           onChange={(v) => set("challenges", v)}
//           placeholder="Any challenges encountered during the service..."
//         />
//         <TextArea
//           label="Suggestions"
//           value={form.suggestions}
//           onChange={(v) => set("suggestions", v)}
//           placeholder="Suggestions for improvement..."
//         />
//       </div>

//       <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
//         <button
//           type="button"
//           onClick={handleDraft}
//           disabled={loading}
//           className="btn-outline flex items-center justify-center gap-2"
//         >
//           <Save className="w-4 h-4" />
//           {loading ? "Saving..." : "Save Draft"}
//         </button>

//         <button
//           type="button"
//           onClick={handleFinalSubmit}
//           disabled={loading || !portalOpen || (weekType === "past" && !weekDate)}
//           className={cn(
//             "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
//             portalOpen && (weekType !== "past" || weekDate)
//               ? "btn-primary"
//               : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
//           )}
//         >
//           <Send className="w-4 h-4" />
//           {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
//         </button>
//       </div>
//     </div>
//   );
// };

// export default ProductionForm;

import React from "react";

const DepartmentalForm = () => {
  return (
    <div className="card p-8 text-center space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
        Form Update in Progress
      </h2>
      <p className="text-sm text-gray-600 dark:text-slate-400">
        This form is currently being updated. Kindly check back within 2 to 24 hours.
      </p>
    </div>
  );
};

export default DepartmentalForm;