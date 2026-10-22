import { GoogleGenAI } from "@google/genai";
import { config } from "../config/index.js";
import ErrorHandler from "../middleware/errorMiddleware.js";

let client;
function getAi() {
  if (!config.ai?.apiKey) return null;
  try {
    client ||= new GoogleGenAI({
      apiKey: config.ai.apiKey,
      httpOptions: { timeout: config.ai.timeout },
    });
    return client;
  } catch {
    return null;
  }
}
const unavailable = () =>
  new ErrorHandler(
    "AI generation is temporarily unavailable. Please try again later.",
    503,
  );

const MODEL = process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-flash-lite";

const ENHANCE_PROMPT_SYSTEM = `You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed, comprehensive prompt that will help create the best possible website.

Enhance this prompt by:
1. Adding specific design details (layout, color scheme, typography)
2. Specifying key sections and features
3. Describing the user experience and interactions
4. Including modern web design best practices
5. Mentioning responsive design requirements
6. Adding any missing but important elements
7. Make the json promot clear and detailed for the next step of building the website


Return ONLY the enhanced prompt, nothing else. Make it detailed but concise (2-3 paragraphs max).`;

const BUILD_PROMPT_SYSTEM = `You are an expert web developer. Create a complete, production-ready, single-page website based on this request:

CRITICAL REQUIREMENTS:
- You MUST output valid HTML ONLY.
- Use Tailwind CSS for ALL styling
- Include this EXACT script in the <head>: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
- Use Tailwind utility classes extensively for styling, animations, and responsiveness
- Make it fully functional and interactive with JavaScript in <script> tag before closing </body>
- Use modern, beautiful design with great UX using Tailwind classes
- Make it responsive using Tailwind responsive classes (sm:, md:, lg:, xl:)
- Use Tailwind animations and transitions (animate-*, transition-*)
- Include all necessary meta tags
- Make sure to complete the html
- Add some functionality with JavaScript (e.g: darkmodetogle , interactive form validation, etc.)
- If the prompt includes simple games (e.g: tic tac toe, snake, etc.) make sure to implement them fully with JavaScript and Tailwind styling
- Use Google Fonts CDN if needed for custom fonts
- Use placeholder images from https://placehold.co/600x400
- Use Tailwind gradient classes for beautiful backgrounds
- Make sure all buttons, cards, and components use Tailwind styling
-make sure not to repeat code

CRITICAL HARD RULES:
1. You MUST output ONLY HTML.
2. Do NOT include markdown, comments, explanations, or code fences.

The HTML should be complete and ready to render as-is with Tailwind CSS.`;

export async function geminiEnhanceResponse(prompt) {
  const ai = getAi();
  if (!ai) return Promise.reject(unavailable());
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${ENHANCE_PROMPT_SYSTEM}\n\nUser Request:\n${prompt}`,
            },
          ],
        },
      ],
    });

    const text = result.text;

    if (!text || text.trim() === "") {
      throw new Error("Empty enhance response");
    }

    return text.trim();
  } catch (error) {
    console.error("Enhance Error:", error.message);
    throw error;
  }
}

export async function geminiBuildResponse(prompt) {
  const ai = getAi();
  if (!ai) return Promise.reject(unavailable());
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${BUILD_PROMPT_SYSTEM}\n\n${prompt}`,
            },
          ],
        },
      ],
    });

    console.log("RAW GEMINI RESPONSE:", result.promptTokensDetails);

    let code = result.text;

    if (!code || code.trim() === "") {
      throw new Error("Gemini returned empty response");
    }

    code = code.replace(/```html|```/g, "").trim();

    return code;
  } catch (error) {
    console.error("Build Error:", error.message);
    throw error;
  }
}

export async function geminiUpdateResponse(prompt, currentCode) {
  const ai = getAi();
  if (!ai) return Promise.reject(unavailable());
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${BUILD_PROMPT_SYSTEM}

Update the website with:
${prompt}

Current HTML:
${currentCode}`,
            },
          ],
        },
      ],
    });

    let code = result.text;

    if (!code || code.trim() === "") {
      throw new Error("Empty update response");
    }

    return code.replace(/```html|```/g, "").trim();
  } catch (error) {
    console.error("Update Error:", error.message);
    throw error;
  }
}
