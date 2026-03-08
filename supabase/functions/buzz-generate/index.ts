/**
 * buzz-generate — AI content engine for The Buzz module.
 *
 * Modes:
 * - "ideas": Generate 12-15 content ideas grouped by category
 * - "post": Generate a single platform-specific post
 * - "refine": Refine/tweak an existing post
 * - "hashtags": Generate hashtags from keywords
 * - "caption" (legacy): Generate a caption for a post title
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
    const { mode = "caption" } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (mode === "ideas") {
      const { event_name, event_theme, event_date, event_location, audience, key_messages, speakers_sponsors, special_features } = body;

      systemPrompt = `You are a creative social media strategist specializing in events and conferences across Africa. Your role is to generate engaging, platform-appropriate content ideas that will excite attendees, attract sponsors, and build buzz. You understand the nuances of different social platforms and what resonates with African audiences (professionals, youth, diaspora).`;

      userPrompt = `Generate a list of 15 creative social media content ideas for the following event:

EVENT DETAILS:
- Event Name: ${event_name || "An upcoming event"}
- Theme: ${event_theme || "Not specified"}
- Date: ${event_date || "TBD"}
- Location: ${event_location || "Africa"}
- Target Audience: ${audience || "professionals and enthusiasts"}
- Key Messages: ${key_messages || "innovation, community, growth"}
- Confirmed speakers/sponsors: ${speakers_sponsors || "TBD"}
- Special Features: ${special_features || "networking, exhibitions"}

For each idea, provide a title, description, best platforms, visual suggestion, hashtags, and category.
Organize into these categories: Announcements, Educational, Engagement, Behind-the-Scenes, Countdown, Post-Event.
Be original, avoid clichés, and tailor to the African context.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_content_ideas",
          description: "Return a list of content ideas grouped by category",
          parameters: {
            type: "object",
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short catchy title" },
                    description: { type: "string", description: "Brief description of the post concept" },
                    platforms: { type: "array", items: { type: "string" }, description: "Best platforms: Instagram, LinkedIn, Twitter, Facebook, WhatsApp" },
                    visual: { type: "string", description: "Suggested visual element" },
                    hashtags: { type: "array", items: { type: "string" }, description: "3-5 relevant hashtags without #" },
                    category: { type: "string", enum: ["Announcements", "Educational", "Engagement", "Behind-the-Scenes", "Countdown", "Post-Event"] },
                  },
                  required: ["title", "description", "platforms", "visual", "hashtags", "category"],
                  additionalProperties: false,
                },
              },
            },
            required: ["ideas"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_content_ideas" } };

    } else if (mode === "post") {
      const { event_name, event_theme, event_date, event_location, audience, platform, post_type, user_prompt, tone, use_emojis, hashtag_count, cta } = body;

      systemPrompt = `You are an expert social media copywriter for events and conferences, with deep knowledge of what works on Instagram, LinkedIn, Twitter/X, Facebook, and WhatsApp. You write in a way that is engaging, platform-appropriate, and culturally relevant to African audiences. You respect character limits and platform norms.`;

      userPrompt = `Write a social media post based on the following:

EVENT CONTEXT:
- Event Name: ${event_name || "Our Event"}
- Theme: ${event_theme || "Not specified"}
- Date: ${event_date || "TBD"}
- Location: ${event_location || "TBD"}
- Target Audience: ${audience || "professionals"}

PLATFORM: ${platform || "Instagram"}
POST TYPE: ${post_type || "Announcement"}
USER REQUEST: ${user_prompt || "Write an engaging post about this event"}

ADDITIONAL INSTRUCTIONS:
- Tone: ${tone || "Professional"}
- Use emojis: ${use_emojis !== false ? "Yes" : "No"}
- Number of hashtags: ${hashtag_count || 5}
- Call to action: ${cta || "none specified"}

Write the post exactly as it should appear on ${platform || "Instagram"}, including line breaks. If character limits apply, ensure the post fits (Twitter 280 chars). Provide only the post content.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_post",
          description: "Return a platform-specific social media post",
          parameters: {
            type: "object",
            properties: {
              content: { type: "string", description: "The full post content exactly as it should appear" },
              hashtags: { type: "array", items: { type: "string" }, description: "Hashtags without #" },
              character_count: { type: "integer", description: "Character count of the post" },
            },
            required: ["content", "hashtags", "character_count"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_post" } };

    } else if (mode === "refine") {
      const { original_post, refinement, platform, event_name, event_theme } = body;

      systemPrompt = `You are a social media copywriter assistant. Your task is to take an existing post and modify it according to the user's request. Keep the core message intact but adjust tone, length, or style as instructed.`;

      userPrompt = `Original Post:
${original_post}

Event Context:
- Event Name: ${event_name || "Our Event"}
- Theme: ${event_theme || "Not specified"}

User Refinement Request: ${refinement}

Platform: ${platform || "Instagram"}

Generate the revised post.`;

      tools = [{
        type: "function",
        function: {
          name: "refine_post",
          description: "Return a refined version of the social media post",
          parameters: {
            type: "object",
            properties: {
              content: { type: "string", description: "The refined post content" },
              hashtags: { type: "array", items: { type: "string" }, description: "Updated hashtags without #" },
            },
            required: ["content", "hashtags"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "refine_post" } };

    } else if (mode === "hashtags") {
      const { keywords, platform } = body;

      systemPrompt = `You are a social media hashtag specialist for African events. Generate relevant, trending hashtags based on keywords.`;

      userPrompt = `Generate 15-20 relevant hashtags for these keywords: ${keywords || "event"}
Platform: ${platform || "Instagram"}
Include a mix of popular, niche, and location-specific hashtags relevant to African events.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_hashtags",
          description: "Return a list of hashtags with popularity tiers",
          parameters: {
            type: "object",
            properties: {
              hashtags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tag: { type: "string", description: "Hashtag without #" },
                    tier: { type: "string", enum: ["trending", "popular", "niche"], description: "Popularity tier" },
                  },
                  required: ["tag", "tier"],
                  additionalProperties: false,
                },
              },
            },
            required: ["hashtags"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_hashtags" } };

    } else {
      // Legacy "caption" mode
      const { title, platform, phase, eventName } = body;

      systemPrompt = `You are a social media content expert specializing in African events and culture. You create engaging, culturally authentic captions for event promotion across social media platforms.

Platform guidelines:
- Instagram: Visual-first, use emojis, 3-5 relevant hashtags, engaging hooks
- LinkedIn: Professional tone, thought leadership angle, 2-3 hashtags
- Twitter: Concise, punchy, 1-2 hashtags, conversation starters
- WhatsApp: Casual, personal, use emojis, call-to-action
- Facebook: Community-focused, longer form OK, 2-3 hashtags
- All: Create a versatile caption that works across platforms`;

      userPrompt = `Generate a social media caption for this event post:
- Post Title: ${title}
- Platform: ${platform || "All"}
- Campaign Phase: ${phase || "launch"}
- Event Name: ${eventName || "Our Event"}

Return using the generate_caption tool.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_caption",
          description: "Return a social media caption with hashtags for an event post.",
          parameters: {
            type: "object",
            properties: {
              caption: { type: "string", description: "The full social media caption text (without hashtags)" },
              hashtags: { type: "array", items: { type: "string" }, description: "3-7 relevant hashtags (without the # symbol)" },
            },
            required: ["caption", "hashtags"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_caption" } };
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
    console.error("buzz-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
