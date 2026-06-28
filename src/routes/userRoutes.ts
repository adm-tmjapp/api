import { NextFunction, Router, Request, Response } from "express";
import { UserController } from "../controllers/userController";

const router = Router();

const asyncHandler = (
  fn: (req: Request, res: Response, next?: NextFunction) => any
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

router.post("/users", asyncHandler(UserController.createUser));
router.get("/users/:id", asyncHandler(UserController.getUserById));
router.put("/users/:id", asyncHandler(UserController.updateUser));
router.put("/users/:id/photo", asyncHandler(UserController.updateProfilePhoto));
router.put("/users/:id/block", asyncHandler(UserController.blockUser));

export default router;
