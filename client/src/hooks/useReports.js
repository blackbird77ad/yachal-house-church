import { useState, useCallback } from "react";
import { saveDraft, submitReport, editReport, getMyReports, getMyDraft, getAllReports, getReportById } from "../services/reportService";

export const useReports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRequest = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveDraft = useCallback((data) => handleRequest(() => saveDraft(data)), [handleRequest]);
  const handleSubmit = useCallback((data) => handleRequest(() => submitReport(data)), [handleRequest]);
  const handleEdit = useCallback((id, data) => handleRequest(() => editReport(id, data)), [handleRequest]);
  const fetchMyReports = useCallback((params) => handleRequest(() => getMyReports(params)), [handleRequest]);
  const fetchMyDraft = useCallback((params) => handleRequest(() => getMyDraft(params)), [handleRequest]);
  const fetchAllReports = useCallback((params) => handleRequest(() => getAllReports(params)), [handleRequest]);
  const fetchReportById = useCallback((id) => handleRequest(() => getReportById(id)), [handleRequest]);

  return {
    loading,
    error,
    setError,
    handleSaveDraft,
    handleSubmit,
    handleEdit,
    fetchMyReports,
    fetchMyDraft,
    fetchAllReports,
    fetchReportById,
  };
};