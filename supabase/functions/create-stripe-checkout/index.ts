import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

type RequestBody = {
  quoteId: string;
  jobId: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "http://localhost:8080";
    const commissionRate = Number(Deno.env.get("PLATFORM_COMMISSION_RATE") ?? "0.12");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Missing function secrets." }, 500);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header." }, 401);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = (await request.json()) as RequestBody;

    const { data: quote, error: quoteError } = await adminClient
      .from("quotes")
      .select("id, total, post_id, homeowner_id, contractor_id, currency")
      .eq("id", body.quoteId)
      .single();
    if (quoteError || !quote) {
      return jsonResponse({ error: "Quote not found." }, 404);
    }
    if (quote.homeowner_id !== user.id) {
      return jsonResponse({ error: "Only homeowner can start checkout." }, 403);
    }

    const { data: job, error: jobError } = await adminClient
      .from("jobs")
      .select("id")
      .eq("id", body.jobId)
      .eq("quote_id", body.quoteId)
      .single();
    if (jobError || !job) {
      return jsonResponse({ error: "Job not found." }, 404);
    }

    const amountCents = Math.round(Number(quote.total) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return jsonResponse({ error: "Invalid quote amount." }, 400);
    }

    const sessionParams = new URLSearchParams();
    sessionParams.append("mode", "payment");
    sessionParams.append("success_url", `${appBaseUrl}/app/user/posts/${quote.post_id}?payment=success`);
    sessionParams.append("cancel_url", `${appBaseUrl}/app/user/posts/${quote.post_id}?payment=cancel`);
    sessionParams.append("line_items[0][quantity]", "1");
    sessionParams.append("line_items[0][price_data][currency]", quote.currency ?? "usd");
    sessionParams.append("line_items[0][price_data][unit_amount]", amountCents.toString());
    sessionParams.append("line_items[0][price_data][product_data][name]", "Storm damage repair escrow funding");
    sessionParams.append("metadata[job_id]", body.jobId);
    sessionParams.append("metadata[quote_id]", body.quoteId);
    sessionParams.append("metadata[contractor_id]", quote.contractor_id);
    sessionParams.append("metadata[homeowner_id]", quote.homeowner_id);
    sessionParams.append("metadata[commission_rate]", commissionRate.toString());
    sessionParams.append("payment_intent_data[metadata][job_id]", body.jobId);
    sessionParams.append("payment_intent_data[metadata][quote_id]", body.quoteId);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sessionParams.toString(),
    });

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      throw new Error(`Stripe error: ${errorText}`);
    }
    const stripeSession = await stripeResponse.json();

    await adminClient
      .from("jobs")
      .update({
        stripe_checkout_session_id: stripeSession.id,
        payment_status: "pending",
      })
      .eq("id", body.jobId);

    return jsonResponse({
      checkoutSessionId: stripeSession.id,
      checkoutUrl: stripeSession.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
