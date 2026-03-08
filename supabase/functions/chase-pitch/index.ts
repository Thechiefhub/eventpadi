import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sponsor_name, sponsor_category, sponsor_country, sponsor_insight, event_name, event_date, event_city, event_type, tier, tone } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert African event sponsorship consultant who writes compelling, culturally aware partnership letters. You understand the African business landscape, corporate sponsorship motivations, and how to craft pitches that resonate with brands operating in Africa.

Write professional partnership letters that:
- Feel personal and researched, not generic
- Reference the sponsor's known activities and interests
- Highlight mutual value and audience alignment
- Include specific, compelling benefits for each tier
- Use a tone that matches the request (formal, friendly, or urgent)
- Are ready to send with minimal editing`;

    const userPrompt = `Write a sponsorship pitch letter with these details:

Sponsor: ${sponsor_name} (${sponsor_category}, ${sponsor_country})
Sponsor Insight: ${sponsor_insight}
Event: ${event_name || "Our upcoming event"}
Event Date: ${event_date || "TBD"}
Event City: ${event_city || "TBD"}
Event Type: ${event_type || "conference"}
Sponsorship Tier: ${tier || "Gold"}
Tone: ${tone || "formal"}

Return the letter using the generate_pitch_letter tool.`;

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
              name: "generate_pitch_letter",
              description: "Return a structured sponsorship pitch letter.",
              parameters: {
                type: "object",
                properties: {
                  subject_line: { type: "string", description: "Email subject line for the pitch" },
                  letter: { type: "string", description: "The full pitch letter body, formatted with paragraphs" },
                  benefits: {
                    type: "array",
                    items: { type: "string" },
                    description: "4-6 specific benefits offered to this sponsor at their tier"
                  },
                  follow_up_suggestion: { type: "string", description: "A suggested follow-up message for 5 days later" }
                },
                required: ["subject_line", "letter", "benefits", "follow_up_suggestion"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_pitch_letter" } },
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
    console.error("chase-pitch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
