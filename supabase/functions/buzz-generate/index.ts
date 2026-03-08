import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, platform, phase, eventName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a social media content expert specializing in African events and culture. You create engaging, culturally authentic captions for event promotion across social media platforms. You understand African audiences, trending formats, and platform-specific best practices.

Platform guidelines:
- Instagram: Visual-first, use emojis, 3-5 relevant hashtags, engaging hooks
- LinkedIn: Professional tone, thought leadership angle, 2-3 hashtags
- Twitter: Concise, punchy, 1-2 hashtags, conversation starters
- WhatsApp: Casual, personal, use emojis, call-to-action
- Facebook: Community-focused, longer form OK, 2-3 hashtags
- All: Create a versatile caption that works across platforms`;

    const userPrompt = `Generate a social media caption for this event post:
- Post Title: ${title}
- Platform: ${platform || "All"}
- Campaign Phase: ${phase || "launch"}
- Event Name: ${eventName || "Our Event"}

Return using the generate_caption tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_caption",
              description: "Return a social media caption with hashtags for an event post.",
              parameters: {
                type: "object",
                properties: {
                  caption: {
                    type: "string",
                    description: "The full social media caption text (without hashtags)"
                  },
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-7 relevant hashtags (without the # symbol)"
                  },
                },
                required: ["caption", "hashtags"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_caption" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("buzz-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
