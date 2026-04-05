import PortalWindow from "../models/portalWindowModel.js";

export const checkPortalOpen = async (req, res, next) => {
  try {
    const now = new Date();

    const portalWindow = await PortalWindow.findOne({
      opensAt: { $lte: now },
      closesAt: { $gte: now },
      isOpen: true,
    });

    if (!portalWindow) {
      return res.status(403).json({
        message: "The submission portal is currently closed. It opens every Friday and closes Monday at 2:59pm.",
        portalOpen: false,
      });
    }

    req.portalWindow = portalWindow;
    next();
  } catch (error) {
    return res.status(500).json({ message: "Error checking portal status." });
  }
};

export const checkSubmissionEditable = async (req, res, next) => {
  try {
    const now = new Date();

    const portalWindow = await PortalWindow.findOne({
      closesAt: { $gte: now },
      isOpen: true,
    });

    if (!portalWindow) {
      return res.status(403).json({
        message: "The editing window has closed. Reports can no longer be edited.",
        portalOpen: false,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Error checking portal status." });
  }
};