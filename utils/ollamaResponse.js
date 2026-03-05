import ollama from "ollama";

const ENHANCE_MODEL = "gemini-3-flash-preview:cloud";
const BUILD_MODEL = "gemini-3-flash-preview:cloud";
const OLLAMA_URL = "http://localhost:11434/api/generate";
const ENHANCE_TIMEOUT_MS = 120000;
const BUILD_TIMEOUT_MS = 180000;

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

CRITICAL HARD RULES:
1. You MUST output ONLY HTML.
2. Do NOT include markdown, comments, explanations, or code fences.

The HTML should be complete and ready to render as-is with Tailwind CSS.`;

export async function enhancePrompt(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENHANCE_TIMEOUT_MS);

  const response = await ollama.chat({
    model: ENHANCE_MODEL,
    messages: [
      {
        role: "system",
        content: ENHANCE_PROMPT_SYSTEM,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: false,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  return response.message?.content?.trim() ?? "";
}

export async function ollamaResponse(enhancedPrompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);

  try {
    const response = await ollama.chat({
      model: BUILD_MODEL,
      messages: [
        {
          role: "system",
          content: BUILD_PROMPT_SYSTEM,
        },
        {
          role: "user",
          content: enhancedPrompt,
        },
      ],
      stream: false,
      signal: controller.signal,
    });

    return response.message?.content?.trim() ?? "";
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function updateOllamaResponse(enhancedPrompt, currentCode) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);

  try {
    const response = await ollama.chat({
      model: BUILD_MODEL,
      messages: [
        {
          role: "system",
          content: BUILD_PROMPT_SYSTEM,
        },
        {
          role: "user",
          content:
            currentCode +
            "\n/* Update the above code based on this prompt: " +
            enhancedPrompt +
            " */",
        },
      ],
      stream: false,
      signal: controller.signal,
    });

    return response.message?.content?.trim() ?? "";
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
