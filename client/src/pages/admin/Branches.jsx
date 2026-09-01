import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle,
  Edit2,
  Link2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import Modal from "../../components/common/Modal";
import { ToastContainer, useToast } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import { useAuth } from "../../hooks/useAuth";
import {
  createBranch,
  deleteBranch,
  getBranchAdminCandidates,
  getBranches,
  reinstateBranch,
  suspendBranch,
  updateBranch,
} from "../../services/branchService";
import { canManageAllBranches } from "../../utils/branchAccess";
import { cn } from "../../utils/scoreHelpers";

const emptyForm = {
  name: "",
  code: "",
  location: "",
  contactEmail: "",
  contactPhone: "",
  status: "active",
  adminUsers: [],
  adminIdentifiers: [],
  workerUsers: [],
  workerIdentifiers: [],
  adminCanViewAllBranches: false,
};

const makeCode = (name = "") =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

const normalizePhone = (value = "") => value.toString().replace(/[^\d+]/g, "");

const getAdminId = (admin) => admin?._id || admin;

const Branches = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [branches, setBranches] = useState([]);
  const [adminCandidates, setAdminCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [adminIdentifier, setAdminIdentifier] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [workerIdentifier, setWorkerIdentifier] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canGrantGlobal = canManageAllBranches(user);

  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch._id, branch])),
    [branches]
  );

  const selectedAdminIds = useMemo(
    () => new Set(form.adminUsers.map((adminId) => String(adminId))),
    [form.adminUsers]
  );
  const selectedWorkerIds = useMemo(
    () => new Set(form.workerUsers.map((workerId) => String(workerId))),
    [form.workerUsers]
  );

  const selectedAdmins = useMemo(
    () =>
      adminCandidates.filter((admin) =>
        selectedAdminIds.has(String(admin._id))
      ),
    [adminCandidates, selectedAdminIds]
  );
  const selectedWorkers = useMemo(
    () =>
      adminCandidates.filter((candidate) =>
        selectedWorkerIds.has(String(candidate._id))
      ),
    [adminCandidates, selectedWorkerIds]
  );

  const filteredAdminCandidates = useMemo(() => {
    const term = candidateSearch.trim().toLowerCase();
    const list = adminCandidates.filter(
      (admin) => !selectedAdminIds.has(String(admin._id))
    );

    if (!term) return list.slice(0, 8);

    return list
      .filter((admin) =>
        [
          admin.fullName,
          admin.email,
          admin.phone,
          admin.workerId,
          admin.role,
          admin.department,
          admin.branch?.name,
          admin.branch?.code,
          ...(admin.managedBranches || []).map((branch) => branch?.name),
          ...(admin.managedBranches || []).map((branch) => branch?.code),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 8);
  }, [adminCandidates, candidateSearch, selectedAdminIds]);

  const filteredWorkerCandidates = useMemo(() => {
    const term = workerSearch.trim().toLowerCase();
    const list = adminCandidates.filter(
      (candidate) =>
        candidate.workerId !== "001" &&
        !selectedWorkerIds.has(String(candidate._id))
    );

    if (!term) return list.slice(0, 8);

    return list
      .filter((candidate) =>
        [
          candidate.fullName,
          candidate.email,
          candidate.phone,
          candidate.workerId,
          candidate.role,
          candidate.department,
          candidate.branch?.name,
          candidate.branch?.code,
          ...(candidate.managedBranches || []).map((branch) => branch?.name),
          ...(candidate.managedBranches || []).map((branch) => branch?.code),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 8);
  }, [adminCandidates, selectedWorkerIds, workerSearch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchRes, adminRes] = await Promise.all([
        getBranches(),
        getBranchAdminCandidates(),
      ]);
      setBranches(branchRes?.branches || []);
      setAdminCandidates(adminRes?.users || adminRes?.admins || []);
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not load branches."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAdminInputs = () => {
    setAdminIdentifier("");
    setCandidateSearch("");
    setWorkerIdentifier("");
    setWorkerSearch("");
  };

  const openCreate = () => {
    setEditingBranch(null);
    setForm({
      ...emptyForm,
      adminUsers: [],
      adminIdentifiers: [],
      workerUsers: [],
      workerIdentifiers: [],
    });
    resetAdminInputs();
    setModalOpen(true);
  };

  const openEdit = (branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name || "",
      code: branch.code || "",
      location: branch.location || "",
      contactEmail: branch.contactEmail || "",
      contactPhone: branch.contactPhone || "",
      status: branch.status || "active",
      adminUsers: (branch.adminUsers || []).map((admin) => getAdminId(admin)),
      adminIdentifiers: [],
      workerUsers: [],
      workerIdentifiers: [],
      adminCanViewAllBranches: branch.adminCanViewAllBranches !== false,
    });
    resetAdminInputs();
    setModalOpen(true);
  };

  const updateField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !editingBranch && !prev.code) {
        next.code = makeCode(value);
      }
      return next;
    });
  };

  const addAdminId = (adminId) => {
    if (!adminId) return;
    setForm((prev) => ({
      ...prev,
      adminUsers: prev.adminUsers.some((id) => String(id) === String(adminId))
        ? prev.adminUsers
        : [...prev.adminUsers, adminId],
    }));
  };

  const removeAdminId = (adminId) => {
    setForm((prev) => ({
      ...prev,
      adminUsers: prev.adminUsers.filter((id) => String(id) !== String(adminId)),
    }));
  };

  const addWorkerId = (workerId) => {
    if (!workerId) return;
    setForm((prev) => ({
      ...prev,
      workerUsers: prev.workerUsers.some((id) => String(id) === String(workerId))
        ? prev.workerUsers
        : [...prev.workerUsers, workerId],
    }));
  };

  const removeWorkerId = (workerId) => {
    setForm((prev) => ({
      ...prev,
      workerUsers: prev.workerUsers.filter((id) => String(id) !== String(workerId)),
    }));
  };

  const toggleAdmin = (adminId) => {
    if (selectedAdminIds.has(String(adminId))) {
      removeAdminId(adminId);
    } else {
      addAdminId(adminId);
    }
  };

  const toggleWorker = (workerId) => {
    if (selectedWorkerIds.has(String(workerId))) {
      removeWorkerId(workerId);
    } else {
      addWorkerId(workerId);
    }
  };

  const removeAdminIdentifier = (identifier) => {
    setForm((prev) => ({
      ...prev,
      adminIdentifiers: prev.adminIdentifiers.filter(
        (item) => item !== identifier
      ),
    }));
  };

  const removeWorkerIdentifier = (identifier) => {
    setForm((prev) => ({
      ...prev,
      workerIdentifiers: prev.workerIdentifiers.filter(
        (item) => item !== identifier
      ),
    }));
  };

  const resolveCandidateIdentifier = (value) => {
    const raw = value.trim();
    const term = raw.toLowerCase();
    const phone = normalizePhone(value);
    if (!term) return { candidate: null, ambiguous: false, count: 0 };

    const exactMatches = adminCandidates.filter((admin) => {
      const adminPhone = normalizePhone(admin.phone);
      return (
        admin.email?.toLowerCase() === term ||
        admin.fullName?.toLowerCase() === term ||
        admin.workerId?.toLowerCase() === term ||
        admin.phone === raw ||
        (phone && adminPhone === phone)
      );
    });

    if (exactMatches.length === 1) {
      return { candidate: exactMatches[0], ambiguous: false, count: 1 };
    }

    if (exactMatches.length > 1) {
      return { candidate: null, ambiguous: true, count: exactMatches.length };
    }

    const partialMatches = adminCandidates.filter((admin) => {
      const adminPhone = normalizePhone(admin.phone);
      const textMatches =
        term.length >= 2 &&
        [admin.fullName, admin.email, admin.workerId]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(term));
      const phoneMatches = phone.length >= 4 && adminPhone.includes(phone);

      return textMatches || phoneMatches;
    });

    if (partialMatches.length === 1) {
      return { candidate: partialMatches[0], ambiguous: false, count: 1 };
    }

    return {
      candidate: null,
      ambiguous: partialMatches.length > 1,
      count: partialMatches.length,
    };
  };

  const linkAdminIdentifier = () => {
    const value = adminIdentifier.trim();
    if (!value) return;

    const { candidate: matchedAdmin, ambiguous, count } =
      resolveCandidateIdentifier(value);
    if (matchedAdmin) {
      addAdminId(matchedAdmin._id);
      setAdminIdentifier("");
      toast.success("Linked", `${matchedAdmin.fullName} added as a branch admin.`);
      return;
    }

    if (ambiguous) {
      toast.warning(
        "Choose exact user",
        `${count} approved users match this entry. Use Search User List to select the right person.`
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      adminIdentifiers: prev.adminIdentifiers.includes(value)
        ? prev.adminIdentifiers
        : [...prev.adminIdentifiers, value],
    }));
    setAdminIdentifier("");
    toast.info("Ready to link", "This email, name, contact, or Worker ID/code will be matched when you save.");
  };

  const linkWorkerIdentifier = () => {
    const value = workerIdentifier.trim();
    if (!value) return;

    const { candidate: matchedWorker, ambiguous, count } =
      resolveCandidateIdentifier(value);
    if (matchedWorker) {
      addWorkerId(matchedWorker._id);
      setWorkerIdentifier("");
      toast.success("Linked", `${matchedWorker.fullName} will be added to this branch.`);
      return;
    }

    if (ambiguous) {
      toast.warning(
        "Choose exact user",
        `${count} approved users match this entry. Use Search User List to select the right worker.`
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      workerIdentifiers: prev.workerIdentifiers.includes(value)
        ? prev.workerIdentifiers
        : [...prev.workerIdentifiers, value],
    }));
    setWorkerIdentifier("");
    toast.info("Ready to link", "This worker will be matched by email, name, contact, or Worker ID/code when you save.");
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Required", "Branch name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        adminCanViewAllBranches: canGrantGlobal
          ? form.adminCanViewAllBranches
          : false,
      };

      if (editingBranch) {
        await updateBranch(editingBranch._id, payload);
        toast.success("Updated", "Branch has been updated.");
      } else {
        await createBranch(payload);
        toast.success("Created", "Branch has been created.");
      }

      setModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not save branch."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (branch) => {
    try {
      if (branch.status === "active") {
        await suspendBranch(branch._id);
        toast.success("Suspended", `${branch.name} has been suspended.`);
      } else {
        await reinstateBranch(branch._id);
        toast.success("Active", `${branch.name} has been reactivated.`);
      }
      await loadData();
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not update branch status."
      );
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete || deleteConfirm !== branchToDelete.name) return;

    setDeleting(true);
    try {
      const data = await deleteBranch(branchToDelete._id);
      toast.success("Deleted", data.message || "Branch permanently deleted.");
      setBranchToDelete(null);
      setDeleteConfirm("");
      await loadData();
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not delete branch."
      );
    } finally {
      setDeleting(false);
    }
  };

  const getAdminBranchLabel = (admin) => {
    const ownBranchId = admin.branch?._id || admin.branch;
    const ownBranch = branchById.get(ownBranchId);
    const branchNames = [
      ownBranch?.name || admin.branch?.name,
      ...(admin.managedBranches || []).map((branch) => branch?.name),
    ].filter(Boolean);
    return [...new Set(branchNames)].join(", ");
  };

  const BranchActions = ({ branch }) => (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => openEdit(branch)}
        title="Edit branch"
        className="rounded-lg p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20"
      >
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => handleToggleStatus(branch)}
        title={branch.status === "active" ? "Suspend branch" : "Reactivate branch"}
        className={cn(
          "rounded-lg p-1.5",
          branch.status === "active"
            ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
        )}
      >
        {branch.status === "active" ? (
          <UserX className="h-4 w-4" />
        ) : (
          <UserCheck className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setBranchToDelete(branch)}
        title="Delete branch"
        className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const BranchStatus = ({ branch }) =>
    branch.status === "active" ? (
      <span className="badge-success text-xs">Active</span>
    ) : (
      <span className="badge-danger text-xs">Suspended</span>
    );

  const BranchVisibility = ({ branch }) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
        branch.adminCanViewAllBranches !== false
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
      )}
    >
      <Shield className="h-3 w-3" />
      {branch.adminCanViewAllBranches !== false
        ? "All branches"
        : "Own branch only"}
    </span>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title">Branches</h1>
          <p className="section-subtitle">
            Create branch portals and control branch admin visibility
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={loadData}
            className="btn-ghost flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Branch
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Loading branches..." />
      ) : branches.length === 0 ? (
        <div className="card p-8 text-center sm:p-12">
          <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-slate-600" />
          <h3 className="mb-2 font-semibold text-gray-900 dark:text-slate-100">
            No branches yet
          </h3>
          <p className="mx-auto max-w-md text-sm text-gray-500 dark:text-slate-400">
            Add a branch before asking workers to choose their current branch.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {branches.map((branch) => (
              <div key={branch._id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-slate-100">
                          {branch.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {branch.code || "No code"}
                          {branch.location ? ` - ${branch.location}` : ""}
                        </p>
                      </div>
                      <BranchActions branch={branch} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <BranchStatus branch={branch} />
                      <BranchVisibility branch={branch} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800">
                        <p className="font-semibold text-gray-900 dark:text-slate-100">
                          {branch.stats?.approvedWorkers || 0}
                        </p>
                        <p className="text-gray-500 dark:text-slate-400">Active workers</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800">
                        <p className="font-semibold text-gray-900 dark:text-slate-100">
                          {branch.adminUsers?.length || 0}
                        </p>
                        <p className="text-gray-500 dark:text-slate-400">Branch admins</p>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-slate-400">
                      {branch.adminUsers?.length
                        ? branch.adminUsers.map((admin) => admin.fullName).join(", ")
                        : "No branch admin linked"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="table-container hidden md:block">
            <table className="w-full">
              <thead>
                <tr>
                  {["Branch", "Admins", "Workers", "Visibility", "Status", ""].map((heading) => (
                    <th key={heading} className="table-header">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr
                    key={branch._id}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-slate-100">
                            {branch.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">
                            {branch.code || "No code"}
                            {branch.location ? ` - ${branch.location}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="max-w-xs truncate text-xs text-gray-600 dark:text-slate-300">
                        {branch.adminUsers?.length
                          ? branch.adminUsers.map((admin) => admin.fullName).join(", ")
                          : "No branch admin"}
                      </div>
                    </td>
                    <td className="table-cell text-xs">
                      <span className="font-semibold text-gray-900 dark:text-slate-100">
                        {branch.stats?.approvedWorkers || 0}
                      </span>{" "}
                      active
                      {branch.stats?.pendingWorkers > 0 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          {branch.stats.pendingWorkers} pending
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <BranchVisibility branch={branch} />
                    </td>
                    <td className="table-cell">
                      <BranchStatus branch={branch} />
                    </td>
                    <td className="table-cell">
                      <BranchActions branch={branch} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBranch ? "Edit Branch" : "Add Branch"}
        size="2xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Branch Name</label>
              <input
                className="input-field"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Accra Central"
              />
            </div>
            <div>
              <label className="form-label">Branch Code</label>
              <input
                className="input-field"
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="ACCRA-CENTRAL"
              />
            </div>
            <div>
              <label className="form-label">Location</label>
              <input
                className="input-field"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="City or area"
              />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input
                className="input-field"
                value={form.contactPhone}
                onChange={(event) => updateField("contactPhone", event.target.value)}
                placeholder="+233 XXX XXX XXX"
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                className="input-field"
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                placeholder="branch@example.com"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Branch Admins
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Link by email, name, contact, Worker ID/code, or select from approved users.
                </p>
              </div>
              <Users className="h-4 w-4 text-purple-600" />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
              <div className="space-y-3">
                <div>
                  <label className="form-label">Email, Name, Contact, or Worker ID/code</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input-field pl-9"
                        value={adminIdentifier}
                        onChange={(event) => setAdminIdentifier(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            linkAdminIdentifier();
                          }
                        }}
                        placeholder="admin@email.com, name, or +233..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={linkAdminIdentifier}
                      className="btn-outline flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Link
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Search User List</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input-field pl-9"
                      value={candidateSearch}
                      onChange={(event) => setCandidateSearch(event.target.value)}
                      placeholder="Search name, email, contact, code..."
                    />
                  </div>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {filteredAdminCandidates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-slate-700 dark:text-slate-500">
                      No matching approved users.
                    </p>
                  ) : (
                    filteredAdminCandidates.map((admin) => (
                      <button
                        key={admin._id}
                        type="button"
                        onClick={() => toggleAdmin(admin._id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition-colors hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {admin.fullName?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                            {admin.fullName}
                          </p>
                          <p className="truncate text-xs text-gray-400 dark:text-slate-500">
                            {admin.workerId || "No ID"} - {admin.email || admin.phone || admin.role}
                          </p>
                          {getAdminBranchLabel(admin) && (
                            <p className="truncate text-xs text-purple-500 dark:text-purple-300">
                              {getAdminBranchLabel(admin)}
                            </p>
                          )}
                        </div>
                        <Plus className="h-4 w-4 flex-shrink-0 text-purple-500" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900/60">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                  Selected
                </p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {selectedAdmins.length === 0 && form.adminIdentifiers.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500">
                      No branch admin selected yet.
                    </p>
                  ) : (
                    <>
                      {selectedAdmins.map((admin) => (
                        <div
                          key={admin._id}
                          className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {admin.fullName}
                            </p>
                            <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                              {admin.email && (
                                <p className="flex min-w-0 items-center gap-1">
                                  <Mail className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{admin.email}</span>
                                </p>
                              )}
                              {admin.phone && (
                                <p className="flex min-w-0 items-center gap-1">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{admin.phone}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAdminId(admin._id)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Remove branch admin"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {form.adminIdentifiers.map((identifier) => (
                        <div
                          key={identifier}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-purple-200 bg-white p-3 text-sm dark:border-purple-800 dark:bg-slate-800"
                        >
                          <Link2 className="h-4 w-4 flex-shrink-0 text-purple-500" />
                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-slate-200">
                            {identifier}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAdminIdentifier(identifier)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Remove identifier"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <details className="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Add Branch Workers
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Add more than one worker by email, name, contact, Worker ID/code, or user list.
                </p>
              </div>
              <Users className="h-4 w-4 flex-shrink-0 text-purple-600" />
            </summary>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)]">
              <div className="space-y-3">
                <div>
                  <label className="form-label">Email, Name, Contact, or Worker ID/code</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input-field pl-9"
                        value={workerIdentifier}
                        onChange={(event) => setWorkerIdentifier(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            linkWorkerIdentifier();
                          }
                        }}
                        placeholder="worker@email.com, name, or ID"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={linkWorkerIdentifier}
                      className="btn-outline flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Search User List</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="input-field pl-9"
                      value={workerSearch}
                      onChange={(event) => setWorkerSearch(event.target.value)}
                      placeholder="Search name, email, contact, code..."
                    />
                  </div>
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredWorkerCandidates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-slate-700 dark:text-slate-500">
                      No matching approved users.
                    </p>
                  ) : (
                    filteredWorkerCandidates.map((candidate) => (
                      <button
                        key={candidate._id}
                        type="button"
                        onClick={() => toggleWorker(candidate._id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left transition-colors hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          {candidate.fullName?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                            {candidate.fullName}
                          </p>
                          <p className="truncate text-xs text-gray-400 dark:text-slate-500">
                            {candidate.workerId || "No ID"} - {candidate.email || candidate.phone || candidate.role}
                          </p>
                          {getAdminBranchLabel(candidate) && (
                            <p className="truncate text-xs text-purple-500 dark:text-purple-300">
                              {getAdminBranchLabel(candidate)}
                            </p>
                          )}
                        </div>
                        <Plus className="h-4 w-4 flex-shrink-0 text-green-500" />
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900/60">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
                  Workers To Add
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {selectedWorkers.length === 0 && form.workerIdentifiers.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500">
                      No workers selected yet.
                    </p>
                  ) : (
                    <>
                      {selectedWorkers.map((worker) => (
                        <div
                          key={worker._id}
                          className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                              {worker.fullName}
                            </p>
                            <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                              {worker.workerId || "No ID"} - {worker.email || worker.phone || worker.role}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeWorkerId(worker._id)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Remove worker"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {form.workerIdentifiers.map((identifier) => (
                        <div
                          key={identifier}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-green-200 bg-white p-3 text-sm dark:border-green-800 dark:bg-slate-800"
                        >
                          <Link2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                          <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-slate-200">
                            {identifier}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeWorkerIdentifier(identifier)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Remove identifier"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </details>

          <label
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              canGrantGlobal
                ? "cursor-pointer border-gray-100 dark:border-slate-700"
                : "border-gray-100 opacity-70 dark:border-slate-700"
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-purple-600"
              checked={form.adminCanViewAllBranches}
              disabled={!canGrantGlobal}
              onChange={(event) =>
                updateField("adminCanViewAllBranches", event.target.checked)
              }
            />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Give selected branch admins oversight of all branches
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                When off, new branch admins only see and manage the branches assigned to them.
              </p>
            </div>
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-ghost flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {saving ? "Saving..." : "Save Branch"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!branchToDelete}
        onClose={() => {
          if (!deleting) {
            setBranchToDelete(null);
            setDeleteConfirm("");
          }
        }}
        title="Delete Branch"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <p className="text-sm font-bold">Permanent deletion</p>
            <p className="mt-1 text-sm">
              This branch portal will be deleted permanently and cannot be restored.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <p className="text-sm font-bold">Second caution</p>
            <p className="mt-1 text-sm">
              Workers and admins assigned to this branch will be moved to no branch until an admin assigns them again.
            </p>
          </div>
          <div>
            <label className="form-label">
              Type {branchToDelete?.name} to confirm
            </label>
            <input
              className="input-field"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setBranchToDelete(null);
                setDeleteConfirm("");
              }}
              disabled={deleting}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== branchToDelete?.name}
              className="btn-danger flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Branches;
