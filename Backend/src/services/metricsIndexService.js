import Metrics from "../models/metricsModel.js";

export const ensureMetricsIndexes = async () => {
  try {
    const indexes = await Metrics.collection.indexes();

    const legacyUniqueIndex = indexes.find(
      (index) =>
        index.unique === true &&
        index.key?.worker === 1 &&
        index.key?.weekReference === 1 &&
        index.key?.isLateSubmission !== 1
    );

    if (legacyUniqueIndex) {
      await Metrics.collection.dropIndex(legacyUniqueIndex.name);
      console.log(`Metrics index repair: dropped ${legacyUniqueIndex.name}`);
    }

    await Metrics.collection.createIndex(
      { worker: 1, weekReference: 1, isLateSubmission: 1 },
      {
        unique: true,
        name: "worker_1_weekReference_1_isLateSubmission_1",
      }
    );
  } catch (error) {
    console.error("Metrics index repair error:", error.message);
  }
};
