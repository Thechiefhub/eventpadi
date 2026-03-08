/**
 * spark-studio — Narrative & Social Post generator for event names.
 *
 * Modes:
 * - "narrative": Generates a 3-5 sentence evocative narrative for an event name
 * - "social": Generates a tailored social media post for a specific platform/type
 * - "refine": Refines the last generated social post with a follow-up instruction
 *
 * AI prompts are constructed on the backend to keep them secure and tunable.
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
    const { mode, eventName, context, platform, postType, customInstruction, previousPost, refineInstruction } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    const briefSummary = context
      ? `Event topic: ${context.topic || "N/A"}. Type: ${context.eventType || "conference"}. Audience: ${context.audience || "professionals"}. Location: ${context.location || "Africa"}. Brand personality: ${context.brandPersonality?.join(", ") || "N/A"}. Emotional response: ${context.emotionalResponse || "inspired"}.`
      : "A professional event in Africa.";

    if (mode === "narrative") {
      systemPrompt = `You are a world-class event storyteller and brand strategist specializing in the African event industry. You craft evocative, emotionally resonant narratives that bring event concepts to life. Your writing is vivid, purposeful, and culturally aware.`;

      userPrompt = `Write a short, evocative narrative (3-5 sentences) for an event called "${eventName}".

Event brief: ${briefSummary}

The narrative should:
- Paint a vivid picture of what attendees will experience
- Evoke the emotional core of the event
- Be suitable for marketing materials and event websites
- Reflect African cultural richness where appropriate
- Be written in present tense for immediacy

Return ONLY the narrative text, no titles or labels.`;

    } else if (mode === "social") {
      const platformGuide: Record<string, string> = {
        instagram: "Use emojis, line breaks for readability, 5-10 relevant hashtags at the end. Max ~2200 chars. Visual and aspirational tone.",
        linkedin: "Professional but engaging. 1-3 hashtags max. Include a clear call-to-action. Can be longer form with line breaks for readability.",
        twitter: "Concise, punchy, max 280 characters. 1-3 hashtags. Hook in the first line.",
        facebook: "Conversational and community-focused. Medium length. Can include emojis. 3-5 hashtags.",
        whatsapp: "Brief, personal tone. No hashtags. Include a clear link placeholder [LINK]. Use emojis sparingly. Formatted for easy forwarding.",
      };

      const postTypeGuide: Record<string, string> = {
        announcement: "Announce the event with excitement and key details (name, date hint, location).",
        "speaker-highlight": "Spotlight a keynote speaker or panelist. Build anticipation around their expertise.",
        "early-bird": "Promote early-bird tickets with urgency and value proposition.",
        countdown: "Create countdown excitement. Build FOMO and anticipation.",
        "behind-the-scenes": "Share behind-the-scenes preparations. Make followers feel like insiders.",
        recap: "Post-event recap highlighting key moments and impact.",
        testimonial: "Share an attendee testimonial or quote (create a realistic one).",
      };

      systemPrompt = `You are a social media strategist for premium African events. You create platform-native content that drives engagement, ticket sales, and community building. You understand each platform's algorithm and audience behavior.`;

      userPrompt = `Create a ${postType || "announcement"} post for ${platform || "instagram"} about the event "${eventName}".

Event brief: ${briefSummary}

Platform guidelines: ${platformGuide[platform || "instagram"] || platformGuide.instagram}
Post type guidelines: ${postTypeGuide[postType || "announcement"] || postTypeGuide.announcement}
${customInstruction ? `Additional instructions: ${customInstruction}` : ""}

Return ONLY the post content, ready to copy and paste. No meta-commentary.`;

    } else if (mode === "refine") {
      systemPrompt = `You are a social media content editor. Refine the given post based on the user's instruction while maintaining the core message and platform-appropriateness.`;

      userPrompt = `Here is the current social media post:

"""
${previousPost}
"""

Refinement instruction: ${refineInstruction}

Return ONLY the refined post content, ready to copy and paste. No meta-commentary.`;

    } else {
      throw new Error(`Unknown mode: ${mode}`);
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
      throw new Error("AI generation failed. Please try again.");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI model");

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("spark-studio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
