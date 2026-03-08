/**
 * chase-pitch — AI sponsorship assistant for The Chase module.
 *
 * Modes:
 * - "pitch" (default): Generates a personalized sponsorship pitch letter
 * - "insight": Generates a "why they fit" insight for a sponsor + event combo
 *
 * Uses Lovable AI Gateway (Gemini) with structured tool calling.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode = "pitch" } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (mode === "insight") {
      // Generate a "why they fit" insight for a sponsor
      const { sponsor_name, sponsor_industry, sponsor_country, sponsor_past, event_name, event_type, event_audience, event_location } = body;

      systemPrompt = `You are an expert African event sponsorship analyst. You provide concise, actionable insights about why a specific brand would be a great sponsor for an event. Your insights are data-driven, culturally aware, and focused on mutual value.`;

      userPrompt = `Analyze the fit between this sponsor and event:

Sponsor: ${sponsor_name} (${sponsor_industry}, ${sponsor_country})
Past sponsorships: ${sponsor_past || "Unknown"}

Event: ${event_name || "An upcoming event"}
Event type: ${event_type || "conference"}
Target audience: ${event_audience || "professionals"}
Location: ${event_location || "Africa"}

Provide a brief but compelling analysis of why this sponsor is a good fit.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_sponsor_insight",
          description: "Return a sponsor fit analysis",
          parameters: {
            type: "object",
            properties: {
              fit_score: { type: "integer", description: "1-10 fit score" },
              headline: { type: "string", description: "One-line fit summary (max 15 words)" },
              reasons: { type: "array", items: { type: "string" }, description: "3 specific reasons they fit" },
              approach_tip: { type: "string", description: "One tactical tip for approaching this sponsor" },
            },
            required: ["fit_score", "headline", "reasons", "approach_tip"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_sponsor_insight" } };

    } else {
      // Pitch letter generation
      const {
        sponsor_name, sponsor_category, sponsor_country, sponsor_insight,
        event_name, event_date, event_city, event_type,
        tier, tone, focus, custom_instructions, benefits_to_highlight,
      } = body;

      systemPrompt = `You are an expert African event sponsorship consultant who writes compelling, culturally aware partnership letters. You understand the African business landscape, corporate sponsorship motivations, and how to craft pitches that resonate with brands operating in Africa.

Write professional partnership letters that:
- Feel personal and researched, not generic
- Reference the sponsor's known activities and interests
- Highlight mutual value and audience alignment
- Include specific, compelling benefits for each tier
- Use a tone that matches the request (formal, friendly, or urgent)
- Are ready to send with minimal editing
${custom_instructions ? `\nAdditional instructions from the user: ${custom_instructions}` : ""}`;

      userPrompt = `Write a sponsorship pitch letter with these details:

Sponsor: ${sponsor_name} (${sponsor_category}, ${sponsor_country})
Sponsor Insight: ${sponsor_insight || "Major brand in their sector"}
Event: ${event_name || "Our upcoming event"}
Event Date: ${event_date || "TBD"}
Event City: ${event_city || "TBD"}
Event Type: ${event_type || "conference"}
Sponsorship Tier: ${tier || "Gold"}
Tone: ${tone || "formal"}
${focus ? `Focus area: ${focus}` : ""}
${benefits_to_highlight ? `Key benefits to emphasize: ${benefits_to_highlight}` : ""}

Return the letter using the generate_pitch_letter tool.`;

      tools = [{
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
                description: "4-6 specific benefits offered to this sponsor at their tier",
              },
              follow_up_suggestion: { type: "string", description: "A suggested follow-up message for 5 days later" },
            },
            required: ["subject_line", "letter", "benefits", "follow_up_suggestion"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_pitch_letter" } };
    }

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
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
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
