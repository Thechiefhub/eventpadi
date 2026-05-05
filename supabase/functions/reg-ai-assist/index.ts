/**
 * reg-ai-assist — Generates marketing copy for an event registration page using Lovable AI.
 * Modes:
 *  - "description": rich Markdown-friendly event description from title/theme/audience.
 *  - "perks": bullet perk lists for General, VIP, VVIP tiers tailored to the event.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { mode = "description", title = "", theme = "", audience = "", location = "", tone = "vibrant, professional, African-rooted" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let system = "";
    let user = "";
    let tool: any;

    if (mode === "perks") {
      system = "You craft concise, irresistible ticket perk lists for African events. Focus on tangible value, exclusivity for higher tiers, and culturally resonant language.";
      user = `Event: "${title}". Theme: ${theme || "n/a"}. Audience: ${audience || "general"}. Location: ${location || "n/a"}.\nReturn 3-5 perks per tier (General, VIP, VVIP). Each perk under 12 words, action-led, no emojis except a single optional leading icon character.`;
      tool = {
        type: "function",
        function: {
          name: "tier_perks",
          parameters: {
            type: "object",
            properties: {
              general: { type: "array", items: { type: "string" } },
              vip: { type: "array", items: { type: "string" } },
              vvip: { type: "array", items: { type: "string" } },
            },
            required: ["general", "vip", "vvip"],
            additionalProperties: false,
          },
        },
      };
    } else {
      system = "You write powerful event registration page descriptions. Tone: " + tone + ". Output 120-220 words, 3 short paragraphs, plain text (no markdown headings).";
      user = `Write the public 'About this event' description for: "${title}". Theme/angle: ${theme || "celebrate, learn, connect"}. Audience: ${audience || "diverse professionals"}. Location: ${location || "Africa"}. Convey purpose, what attendees gain, and an inspiring call to register.`;
      tool = {
        type: "function",
        function: {
          name: "event_description",
          parameters: {
            type: "object",
            properties: { description: { type: "string" }, tagline: { type: "string" } },
            required: ["description", "tagline"],
            additionalProperties: false,
          },
        },
      };
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `AI error ${r.status}: ${t.slice(0, 200)}` }), { status: r.status === 429 || r.status === 402 ? r.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No AI response");
    return new Response(args, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});