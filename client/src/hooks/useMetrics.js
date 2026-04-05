import { useState, useCallback } from "react";
import { getMyMetrics, getMyMetricsHistory, getAllMetrics, getQualifiedWorkers, getDisqualifiedWorkers, getLateMetrics, triggerManualProcessing } from "../services/metricsService";

export const useMetrics = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRequest = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyMetrics = useCallback((params) => handleRequest(() => getMyMetrics(params)), [handleRequest]);
  const fetchMyMetricsHistory = useCallback(() => handleRequest(() => getMyMetricsHistory()), [handleRequest]);
  const fetchAllMetrics = useCallback((params) => handleRequest(() => getAllMetrics(params)), [handleRequest]);
  const fetchQualifiedWorkers = useCallback((params) => handleRequest(() => getQualifiedWorkers(params)), [handleRequest]);
  const fetchDisqualifiedWorkers = useCallback((params) => handleRequest(() => getDisqualifiedWorkers(params)), [handleRequest]);
  const fetchLateMetrics = useCallback((params) => handleRequest(() => getLateMetrics(params)), [handleRequest]);
  const handleManualProcessing = useCallback((data) => handleRequest(() => triggerManualProcessing(data)), [handleRequest]);

  return {
    loading,
    error,
    setError,
    fetchMyMetrics,
    fetchMyMetricsHistory,
    fetchAllMetrics,
    fetchQualifiedWorkers,
    fetchDisqualifiedWorkers,
    fetchLateMetrics,
    handleManualProcessing,
  };
};