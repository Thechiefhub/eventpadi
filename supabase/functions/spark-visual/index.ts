/**
 * spark-visual — AI event poster/visual concept generator.
 * Uses Gemini image generation model to create event visuals
 * based on user descriptions and pattern style preferences.
 * Uploads results to storage and returns public URLs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode = "generate" } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId = "anonymous";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (anonKey && token !== anonKey) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: { user } } = await userClient.auth.getUser(token);
        if (user) userId = user.id;
      }
    }

    if (mode === "edit") {
      // Edit an existing image with a follow-up prompt
      const { sourceUrl, editInstruction } = body;
      if (!sourceUrl || !editInstruction) throw new Error("sourceUrl and editInstruction are required for edit mode");

      const result = await editAndStore(LOVABLE_API_KEY, supabase, userId, sourceUrl, editInstruction);
      return new Response(JSON.stringify({ image: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate mode
    const { description, patternStyle, colorMood, eventName, count = 3 } = body;
    const prompt = buildPrompt(description, patternStyle, colorMood, eventName);

    const imagePromises = Array.from({ length: Math.min(count, 4) }, (_, i) =>
      generateAndStore(LOVABLE_API_KEY, supabase, userId, prompt, i)
    );

    const results = await Promise.allSettled(imagePromises);
    const images = results
      .filter((r): r is PromiseFulfilledResult<{ url: string; path: string }> => r.status === "fulfilled")
      .map((r) => r.value);

    if (images.length === 0) {
      const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw new Error(firstError?.reason?.message || "All image generations failed");
    }

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("spark-visual error:", e);

    if (e instanceof Error && e.message.includes("429")) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e instanceof Error && e.message.includes("402")) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildPrompt(description: string, patternStyle: string, colorMood: string, eventName?: string): string {
  return `Create a professional, visually striking event poster concept.

Event description: ${description || "A modern professional event in Africa"}
Visual pattern style: ${patternStyle || "Contemporary geometric"} (incorporate this as a design motif)
Color mood: ${colorMood || "Warm sunset tones with deep indigo accents"}
${eventName ? `Event name to feature: "${eventName}"` : ""}

Design requirements:
- Professional event poster layout (portrait orientation)
- Bold, modern typography placeholder areas
- Incorporate African-inspired ${patternStyle || "geometric"} patterns as decorative elements
- Rich, vibrant color palette matching the mood
- Clean composition with clear visual hierarchy
- Include space for event details (date, venue, speakers)
- High visual impact suitable for social media and print
- Do NOT include any text or words on the poster — leave text areas blank or use abstract shapes as placeholders`;
}

async function generateAndStore(
  apiKey: string,
  supabase: any,
  userId: string,
  prompt: string,
  index: number
): Promise<{ url: string; path: string }> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI generation failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageData) throw new Error("No image returned from AI model");

  // Extract base64 data
  const base64Match = imageData.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!base64Match) throw new Error("Invalid image data format");

  const mimeType = base64Match[1];
  const base64 = base64Match[2];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const filePath = `${userId}/${Date.now()}_${index}.${mimeType === "jpeg" ? "jpg" : mimeType}`;

  const { error: uploadError } = await supabase.storage
    .from("generated-visuals")
    .upload(filePath, bytes, { contentType: `image/${mimeType}`, upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from("generated-visuals").getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

async function editAndStore(
  apiKey: string,
  supabase: any,
  userId: string,
  sourceUrl: string,
  editInstruction: string
): Promise<{ url: string; path: string }> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Edit this event poster image: ${editInstruction}. Keep the overall composition and layout intact. Only apply the requested changes.` },
            { type: "image_url", image_url: { url: sourceUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI edit failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageData) throw new Error("No edited image returned from AI model");

  const base64Match = imageData.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!base64Match) throw new Error("Invalid image data format");

  const mimeType = base64Match[1];
  const base64 = base64Match[2];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const filePath = `${userId}/${Date.now()}_edit.${mimeType === "jpeg" ? "jpg" : mimeType}`;

  const { error: uploadError } = await supabase.storage
    .from("generated-visuals")
    .upload(filePath, bytes, { contentType: `image/${mimeType}`, upsert: false });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from("generated-visuals").getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}
