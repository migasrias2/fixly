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

type Body = {
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return jsonResponse({ error: "Missing function secrets." }, 500);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header." }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const body = (await request.json()) as Body;
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: job, error: jobError } = await adminClient
      .from("jobs")
      .select("id, homeowner_id, contractor_id, status")
      .eq("id", body.jobId)
      .single();
    if (jobError || !job) {
      return jsonResponse({ error: "Job not found." }, 404);
    }
    if (job.homeowner_id !== user.id) {
      return jsonResponse({ error: "Only homeowner can release payment." }, 403);
    }
    if (job.status !== "completed") {
      return jsonResponse({ error: "Job must be completed before release." }, 400);
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, payout_amount, currency, status")
      .eq("job_id", body.jobId)
      .eq("status", "held")
      .single();
    if (paymentError || !payment) {
      return jsonResponse({ error: "Held payment not found." }, 404);
    }

    const { data: contractor, error: contractorError } = await adminClient
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", job.contractor_id)
      .single();
    if (contractorError || !contractor?.stripe_account_id) {
      return jsonResponse({ error: "Contractor Stripe account not connected." }, 400);
    }

    const transferParams = new URLSearchParams();
    transferParams.append("amount", Math.round(Number(payment.payout_amount) * 100).toString());
    transferParams.append("currency", payment.currency ?? "usd");
    transferParams.append("destination", contractor.stripe_account_id);
    transferParams.append("metadata[job_id]", body.jobId);
    transferParams.append("description", "Storm repair job payout");

    const stripeResponse = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: transferParams.toString(),
    });
    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text();
      throw new Error(`Stripe transfer failed: ${errorText}`);
    }
    const transfer = await stripeResponse.json();

    await adminClient
      .from("payments")
      .update({
        status: "released",
        stripe_transfer_id: transfer.id,
      })
      .eq("id", payment.id);

    await adminClient
      .from("jobs")
      .update({
        status: "released",
        payment_status: "released",
        payout_released_at: new Date().toISOString(),
      })
      .eq("id", body.jobId);

    await adminClient.from("notifications").insert([
      {
        user_id: job.homeowner_id,
        type: "payment_released",
        title: "Payment released",
        body: "Contractor payout has been released successfully.",
        metadata: { jobId: body.jobId },
      },
      {
        user_id: job.contractor_id,
        type: "payment_released",
        title: "Payout sent",
        body: "Your payout for the completed job is on the way.",
        metadata: { jobId: body.jobId },
      },
    ]);

    return jsonResponse({ released: true, transferId: transfer.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
