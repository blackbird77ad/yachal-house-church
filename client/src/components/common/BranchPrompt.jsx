import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getPublicBranches } from "../../services/branchService";
import { updateMyProfile } from "../../services/workerService";
import Modal from "./Modal";
import { ToastContainer, useToast } from "./Toast";

const BranchPrompt = () => {
  const { user, updateUser } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);

  const shouldAsk =
    user &&
    user.status === "approved" &&
    user.workerId !== "001" &&
    !user.branch;

  useEffect(() => {
    let cancelled = false;

    if (!shouldAsk) {
      setBooted(true);
      return () => {
        cancelled = true;
      };
    }

    getPublicBranches()
      .then(({ branches: nextBranches = [] }) => {
        if (cancelled) return;
        setBranches(nextBranches);
        setSelectedBranch(nextBranches[0]?._id || "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBooted(true);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldAsk]);

  const handleSave = async () => {
    if (!selectedBranch) {
      toast.error("Branch required", "Select your current branch.");
      return;
    }

    setLoading(true);
    try {
      const { worker } = await updateMyProfile({ branchId: selectedBranch });
      updateUser(worker);
      toast.success("Branch saved", "Your branch has been updated.");
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not save your branch."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!shouldAsk || !booted || branches.length === 0) return null;

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <Modal
        isOpen
        onClose={() => {}}
        showClose={false}
        title="Select your branch"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              Choose your current branch. Administration will be notified and can edit this later if needed.
            </p>
          </div>

          <div>
            <label className="form-label">Current Branch</label>
            <select
              className="input-field"
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                  {branch.location ? ` - ${branch.location}` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Branch"}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default BranchPrompt;
