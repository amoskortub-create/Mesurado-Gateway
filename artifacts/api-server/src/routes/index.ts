import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import keysRouter from "./keys.js";
import usageRouter from "./usage.js";
import playgroundRouter from "./playground.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/keys", keysRouter);
router.use("/user", usageRouter);
router.use("/playground", playgroundRouter);

export default router;
