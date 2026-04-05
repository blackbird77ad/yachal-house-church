import { useState, useCallback } from "react";
import { getAllWorkers, getWorkerById, getWorkerByWorkerId, searchWorkers, updateWorker, getMyProfile, updateMyProfile } from "../services/workerService";

export const useWorkers = () => {
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

  const fetchAllWorkers = useCallback((params) => handleRequest(() => getAllWorkers(params)), [handleRequest]);
  const fetchWorkerById = useCallback((id) => handleRequest(() => getWorkerById(id)), [handleRequest]);
  const fetchWorkerByWorkerId = useCallback((id) => handleRequest(() => getWorkerByWorkerId(id)), [handleRequest]);
  const handleSearchWorkers = useCallback((name) => handleRequest(() => searchWorkers(name)), [handleRequest]);
  const handleUpdateWorker = useCallback((id, data) => handleRequest(() => updateWorker(id, data)), [handleRequest]);
  const fetchMyProfile = useCallback(() => handleRequest(() => getMyProfile()), [handleRequest]);
  const handleUpdateMyProfile = useCallback((data) => handleRequest(() => updateMyProfile(data)), [handleRequest]);

  return {
    loading,
    error,
    setError,
    fetchAllWorkers,
    fetchWorkerById,
    fetchWorkerByWorkerId,
    handleSearchWorkers,
    handleUpdateWorker,
    fetchMyProfile,
    handleUpdateMyProfile,
  };
};