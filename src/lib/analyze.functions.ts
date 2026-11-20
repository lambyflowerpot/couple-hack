import { createServerFn } from "@tanstack/react-start";
import { generateMessage } from "@lovable.dev/ai-gateway";

export const analyzeFrames = createServerFn({ method: "POST" })
  .inputValidator((input: { image: string; instruction: string }) => input)
  .handler(async ({ data }) => {
    const base64 = data.image.replace(/^data:image\/\w+;base64,/, "");
    const res = await generateMessage({
      model: "anthropic/claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: data.instruction },
          ],
        },
      ],
    });
    const result = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return { result };
  });
