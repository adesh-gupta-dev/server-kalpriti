import ErrorHandler from "../middleware/errorMiddleware.js";
import { User, WebsiteProject } from "../models/index.js";
import {
  enhancePrompt,
  ollamaResponse,
  updateOllamaResponse,
} from "./ollamaResponse.js";

const CREDITS_BUILD = 5;
const CREDITS_UPDATE = 3;

export async function build(prompt, user, next) {
  const userData = await User.findById(user._id);
  if (!userData || userData.credits <= 0) {
    return next(new ErrorHandler("Insufficient credits", 402));
  }

  userData.credits -= CREDITS_BUILD;
  userData.totalCreation += 1;
  await userData.save();

  const enhancedPrompt = await enhancePrompt(prompt);
  return ollamaResponse(enhancedPrompt);
}

export async function update(prompt, projectId, user, next) {
  const [userData, projectData] = await Promise.all([
    User.findById(user),
    WebsiteProject.findById(projectId),
  ]);

  if (!projectData) {
    return next(new ErrorHandler("Project not found", 404));
  }
  if (!userData || userData.credits <= 0) {
    return next(new ErrorHandler("Insufficient credits", 402));
  }

  userData.credits -= CREDITS_UPDATE;
  userData.totalCreation += 1;
  await userData.save();
  const enhancedPrompt = await enhancePrompt(prompt);

  return updateOllamaResponse(enhancedPrompt, projectData?.current_code);
}
