import ReportType from "../models/reportTypeModel.js";

export const createReportType = async (req, res, next) => {
  try {
    const { name, description, fields } = req.body;

    const existing = await ReportType.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
    if (existing) {
      return res.status(400).json({ message: "A report type with this name already exists." });
    }

    const reportType = await ReportType.create({
      name,
      description,
      fields,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Report type created.", reportType });
  } catch (error) {
    next(error);
  }
};

export const getAllReportTypes = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const reportTypes = await ReportType.find(filter)
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    res.status(200).json({ reportTypes });
  } catch (error) {
    next(error);
  }
};

export const getReportTypeById = async (req, res, next) => {
  try {
    const reportType = await ReportType.findById(req.params.reportTypeId).populate("createdBy", "fullName");
    if (!reportType) {
      return res.status(404).json({ message: "Report type not found." });
    }
    res.status(200).json({ reportType });
  } catch (error) {
    next(error);
  }
};

export const updateReportType = async (req, res, next) => {
  try {
    const reportType = await ReportType.findById(req.params.reportTypeId);
    if (!reportType) {
      return res.status(404).json({ message: "Report type not found." });
    }

    const { name, description, fields, isActive } = req.body;
    if (name) reportType.name = name;
    if (description) reportType.description = description;
    if (fields) reportType.fields = fields;
    if (isActive !== undefined) reportType.isActive = isActive;

    await reportType.save();
    res.status(200).json({ message: "Report type updated.", reportType });
  } catch (error) {
    next(error);
  }
};

export const deleteReportType = async (req, res, next) => {
  try {
    await ReportType.findByIdAndDelete(req.params.reportTypeId);
    res.status(200).json({ message: "Report type deleted." });
  } catch (error) {
    next(error);
  }
};