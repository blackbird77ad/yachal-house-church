import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    message: "Media microservice integration point. Connect external MERN sermon/media service here.",
    status: "ready",
  });
});

export default router;