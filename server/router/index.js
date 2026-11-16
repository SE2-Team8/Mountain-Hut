import express from "express";
import authRouter from "./authRouter.js";
import usersRouter from "./usersRouter.js";
import timeSlotsRouter from "./timeSlotsRouter.js";
import reservationsRouter from "./reservationsRouter.js";

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/timeslots', timeSlotsRouter);
router.use('/reservations', reservationsRouter);

export default router;
