import ErrorHandler from "../middleware/errorMiddleware.js";
import { User, WebsiteProject } from "../models/index.js";
import {
  geminiEnhanceResponse,
  geminiBuildResponse,
  geminiUpdateResponse,
} from "./geminiResponse.js";
import {
  enhancePrompt,
  ollamaResponse,
  updateOllamaResponse,
} from "./ollamaResponse.js";

const CREDITS_BUILD = 5;
const CREDITS_UPDATE = 3;
const isProduction = process.env.NODE_ENV === "production";

export async function build(prompt, user, next) {
  const userId = user?._id ?? user;
  const userData = await User.findById(userId);
  if (!userData || userData.credits < CREDITS_BUILD) {
    return Promise.reject(new ErrorHandler("Insufficient credits", 402));
  }

  let result;
  try {
    const enhancedPrompt = isProduction
      ? await geminiEnhanceResponse(prompt)
      : await enhancePrompt(prompt);
    result = isProduction
      ? await geminiBuildResponse(enhancedPrompt)
      : await ollamaResponse(enhancedPrompt);
  } catch (error) {
    if (error.statusCode === 503) return Promise.reject(error);
    if (error.message?.includes("timed out")) {
      return Promise.reject(
        new ErrorHandler("Ollama request timed out. Please try again.", 504),
      );
    }
    return Promise.reject(
      new ErrorHandler("Failed to build website code", 500),
    );
  }
  // The project transaction applies credit usage together with persisted code.

  return result;
}

export async function update(prompt, projectId, user, next) {
  const userId = user?._id ?? user;
  const [userData, projectData] = await Promise.all([
    User.findById(userId),
    WebsiteProject.findById(projectId),
  ]);

  if (!projectData) {
    return Promise.reject(new ErrorHandler("Project not found", 404));
  }
  if (!userData || userData.credits < CREDITS_UPDATE) {
    return Promise.reject(new ErrorHandler("Insufficient credits", 402));
  }
  let updatedCode;
  try {
    const enhancedPrompt = isProduction
      ? await geminiEnhanceResponse(prompt)
      : await enhancePrompt(prompt);
    updatedCode = isProduction
      ? await geminiUpdateResponse(enhancedPrompt, projectData.current_code)
      : await updateOllamaResponse(enhancedPrompt, projectData.current_code);
    // Credit usage is applied atomically by the project service.
  } catch (error) {
    if (error.statusCode === 503) return Promise.reject(error);
    if (error.message?.includes("timed out")) {
      return Promise.reject(
        new ErrorHandler("Ollama request timed out. Please try again.", 504),
      );
    }
    return Promise.reject(
      new ErrorHandler("Failed to update website code", 500),
    );
  }

  return updatedCode;
}
