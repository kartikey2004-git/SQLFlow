import { Router } from "express";
import { assignmentController } from "../controllers/assignment.controller";

const router = Router();

router.get("/", assignmentController.getAllAssignments);

router.get("/:id", assignmentController.getAssignmentById);

export default router;
