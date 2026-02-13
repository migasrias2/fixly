const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AnalyzeInput = {
  imagesBase64?: Array<{ mimeType: string; data: string }>;
  damageType?: string;
  description?: string;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const mockEstimate = (input: AnalyzeInput) => {
  const base = 4000;
  const multiplier = input.damageType === "roof" ? 3 : input.damageType === "flooding" ? 2.5 : 1.8;
  const estimateLow = Math.round(base * multiplier);
  const estimateHigh = Math.round(estimateLow * 1.8);
  return {
    summary:
      "Preliminary AI estimate based on submitted description and photos. A licensed contractor should confirm onsite.",
    estimateLow,
    estimateHigh,
    suggestedLineItems: [
      { label: "Emergency mitigation", amount: Math.round(estimateLow * 0.2) },
      { label: "Material replacement", amount: Math.round(estimateLow * 0.55) },
      { label: "Labor and cleanup", amount: Math.round(estimateLow * 0.25) },
    ],
  };
};

const parseJsonFromText = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object returned by model.");
  }
  return JSON.parse(text.slice(start, end + 1));
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as AnalyzeInput;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!body?.imagesBase64?.length) {
      return jsonResponse({ error: "imagesBase64 is required." }, 400);
    }

    if (!anthropicApiKey) {
      return jsonResponse(mockEstimate(body));
    }

    const content = [
      {
        type: "text",
        text: `You are an insurance-aware storm damage estimator.
Return strict JSON with keys:
summary (string),
estimateLow (number),
estimateHigh (number),
suggestedLineItems (array of {label:string, amount:number}).
Context:
- Damage type: ${body.damageType ?? "unknown"}
- Description: ${body.description ?? "n/a"}
Keep estimates conservative and realistic for US market rates.`,
      },
      ...body.imagesBase64.map((image) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimeType,
          data: image.data,
        },
      })),
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic error: ${errorText}`);
    }

    const data = await response.json();
    const textBlock = data?.content?.find((item: { type: string }) => item.type === "text")?.text;
    if (!textBlock) {
      throw new Error("Anthropic response missing text.");
    }

    const parsed = parseJsonFromText(textBlock);
    return jsonResponse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
