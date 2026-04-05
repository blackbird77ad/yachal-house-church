import PortalWindow from "../models/portalWindowModel.js";

const getNextFriday = () => {
  const now = new Date();
  const day = now.getDay();
  const daysUntilFriday = day === 5 ? 7 : (5 - day + 7) % 7 || 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);
  return friday;
};

export const getPortalStatus = async (req, res, next) => {
  try {
    const now = new Date();

    const portal = await PortalWindow.findOne({
      isOpen: true,
      opensAt: { $lte: now },
      closesAt: { $gte: now },
    });

    if (!portal) {
      const nextPortal = await PortalWindow.findOne({
        opensAt: { $gte: now },
      }).sort({ opensAt: 1 });

      const nextOpenAt = nextPortal?.opensAt || getNextFriday();

      return res.status(200).json({
        isOpen: false,
        nextOpenAt,
        message: "Portal is closed. Opens every Friday at midnight.",
      });
    }

    const timeLeftMs = new Date(portal.closesAt) - now;
    const hoursLeft = Math.max(0, Math.floor(timeLeftMs / (1000 * 60 * 60)));
    const minutesLeft = Math.max(0, Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)));

    res.status(200).json({
      isOpen: true,
      opensAt: portal.opensAt,
      closesAt: portal.closesAt,
      weekReference: portal.weekReference,
      timeLeft: { hours: hoursLeft, minutes: minutesLeft },
      message: `Portal is open. Closes in ${hoursLeft}h ${minutesLeft}m.`,
    });
  } catch (error) {
    next(error);
  }
};

export const getPortalHistory = async (req, res, next) => {
  try {
    const portals = await PortalWindow.find()
      .populate("overriddenBy", "fullName role")
      .sort({ createdAt: -1 })
      .limit(12);

    res.status(200).json({ portals });
  } catch (error) {
    next(error);
  }
};