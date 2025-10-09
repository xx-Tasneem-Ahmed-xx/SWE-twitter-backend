// src/api/controllers/user.controller.ts

import { Request, Response } from "express";
import { UserService } from "../../application/services/user.service";

const userService = new UserService();

// GET /api/users/:username
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await userService.getUserProfile(username);

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/users/:id
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const updatedUser = await userService.updateUserProfile(id, updatedData);
    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
