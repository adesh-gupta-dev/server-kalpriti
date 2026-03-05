import { User } from "../models/index.js";

export const checkIsVerified = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { verified: false, message: "User not found" };
    }
    if (!user.verified) {
      return { verified: false, message: "User is not verified" };
    }
    return { verified: true, message: "User is verified" };
  } catch (error) {
    console.error("Error checking user verification:", error);
    return { verified: false, message: "Server error" };
  }
};
