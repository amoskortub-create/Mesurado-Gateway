import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import keysRouter from "./keys.js";
import usageRouter from "./usage.js";
import playgroundRouter from "./playground.js";
import conversationsRouter from "./conversations.js";
import paymentsRouter from "./payments.js";
import adminPaymentsRouter from "./admin-payments.js";
import adminQueueRouter from "./admin-queue.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/keys", keysRouter);
router.use("/user", usageRouter);
router.use("/playground", playgroundRouter);
router.use("/playground", conversationsRouter);
router.use("/payments", paymentsRouter);
router.use("/admin", adminPaymentsRouter);
router.use("/admin", adminQueueRouter);

export default router;
