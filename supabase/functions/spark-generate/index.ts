/**
 * spark-generate — Enhanced AI event naming engine.
 * Accepts rich context (event fundamentals, brand personality, creative direction,
 * constraints, competitor landscape, cultural guidance) and returns categorized
 * name suggestions with rationales, taglines, and ratings.
 *
 * Also supports a "theme" mode that generates full narrative frameworks
 * for selected names.
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
    const { mode = "names", context, selectedNames } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (mode === "theme") {
      // Theme & narrative generation for selected names
      systemPrompt = `You are a world-class event strategist and brand architect specializing in African events. Create compelling themes and narrative frameworks that resonate with African audiences while appealing globally.`;

      userPrompt = `Generate full event themes and narrative frameworks for these selected event names:
${selectedNames?.map((n: string) => `- "${n}"`).join("\n")}

Event context: ${JSON.stringify(context)}

For each name, create a complete theme package.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_themes",
          description: "Return theme packages for selected event names",
          parameters: {
            type: "object",
            properties: {
              themes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    theme_statement: { type: "string", description: "2-3 sentence theme statement" },
                    narrative_hook: { type: "string", description: "Opening narrative for marketing" },
                    key_pillars: { type: "array", items: { type: "string" }, description: "3-4 content pillars" },
                    hashtag: { type: "string" },
                    color_mood: { type: "string", description: "Suggested color palette mood" },
                    audience_promise: { type: "string", description: "What attendees will gain" },
                  },
                  required: ["name", "theme_statement", "narrative_hook", "key_pillars", "hashtag", "color_mood", "audience_promise"],
                },
              },
            },
            required: ["themes"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_themes" } };
    } else {
      // Name generation mode
      const c = context || {};
      systemPrompt = `You are an elite event naming consultant with deep expertise in African cultures, languages (Swahili, Yoruba, Hausa, Igbo, Zulu, Amharic, Twi, Lingala, Wolof, etc.), and the vibrant event industry across Africa and the diaspora.

Your approach:
- Create names that are memorable, pronounceable, and culturally resonant
- Blend African linguistic elements naturally (not forced or tokenistic)
- Consider how names sound spoken aloud, look on posters, and work as hashtags
- Think about domain availability and social media handle potential
- Avoid clichés and overused event naming patterns
- Generate names across multiple creative categories for maximum choice`;

      userPrompt = `Generate creative, culturally-rich event name suggestions using this detailed brief:

## EVENT FUNDAMENTALS
- Topic/Subject: ${c.topic || "Not specified"}
- Event Type: ${c.eventType || "Conference"}
- Expected Audience Size: ${c.audienceSize || "Not specified"}
- Location: ${c.location || "Africa"}
- Target Audience: ${c.audience || "Professionals"}

## BRAND PERSONALITY
- Selected traits: ${c.brandPersonality?.length ? c.brandPersonality.join(", ") : "Not specified"}

## CREATIVE DIRECTION
- Key dimensions: ${c.creativeDimensions || "Not specified"}
- Desired emotional response: ${c.emotionalResponse || "Inspired and energized"}

## STRATEGIC CONSTRAINTS
- Words/phrases to AVOID: ${c.wordsToAvoid || "Innovation, Summit, Future, Africa, Connect, Tech, Disrupt, Empower, Nexus, Synergy"}
- Name length preference: ${c.lengthPreference || "2-4 words"}
- Languages to incorporate: ${c.languages || "English with optional African language elements"}

## COMPETITOR LANDSCAPE
${c.competitors || "No specific competitors mentioned"}

## NAME PREFERENCES
- Names they love: ${c.lovedNames || "Not specified"}
- Names they dislike: ${c.dislikedNames || "Not specified"}
- Why: ${c.namePreferenceReason || "Not specified"}

## CULTURAL GUIDANCE
- Cultural concepts to explore: ${c.culturalConcepts || "Open to all African cultural references"}
- Sensitivities to be aware of: ${c.sensitivities || "Standard cultural sensitivity"}

Generate 15+ names across 5 categories. Each name should feel distinct and ownable.`;

      tools = [{
        type: "function",
        function: {
          name: "suggest_event_names",
          description: "Return categorized event name suggestions with full details",
          parameters: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    category: { type: "string", description: "Category name e.g. 'African Language Blends', 'Metaphorical', 'Bold & Modern', 'Cultural Heritage', 'Playful & Unexpected'" },
                    names: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          rationale: { type: "string", description: "Why this name works (1-2 sentences)" },
                          tagline: { type: "string", description: "A complementary tagline" },
                          rating: { type: "integer", description: "Confidence rating 1-5 based on brief fit" },
                          language_note: { type: "string", description: "If using African language elements, explain meaning" },
                        },
                        required: ["name", "rationale", "tagline", "rating"],
                      },
                    },
                  },
                  required: ["category", "names"],
                },
              },
            },
            required: ["categories"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "suggest_event_names" } };
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
      return new Response(JSON.stringify({ error: "AI generation failed. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No response from AI model" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("spark-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
