import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import Modal from "../common/Modal";

const REQUIRED_CONFIRMATION = "DELETE";

const WorkerDeleteModal = ({ worker, deleting = false, onClose, onDelete }) => {
  const [confirmation, setConfirmation] = useState("");

  if (!worker) return null;

  const confirmed = confirmation.trim().toUpperCase() === REQUIRED_CONFIRMATION;
  const handleClose = () => {
    if (deleting) return;
    setConfirmation("");
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!confirmed || deleting) return;
    setConfirmation("");
    onDelete();
  };

  return (
    <Modal isOpen={!!worker} onClose={handleClose} title="Delete Worker" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-300 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Permanent deletion</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              This will permanently delete {worker.fullName}'s worker account.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Cannot be restored</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Reports, metrics, attendance, permissions, notifications, and saved access records linked to this worker will be removed and cannot be restored.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 dark:bg-slate-900/60 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500">Worker</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{worker.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {worker.email} {worker.workerId ? `- ID ${worker.workerId}` : "- Pending ID"}
            </p>
          </div>
          <div>
            <label className="form-label">Type DELETE to confirm</label>
            <input
              className="input-field"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button type="button" onClick={handleClose} disabled={deleting} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!confirmed || deleting}
            className="btn-danger flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default WorkerDeleteModal;
