import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const timingSafeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
};

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const verifyStripeSignature = async (payload: string, signature: string, secret: string) => {
  const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) {
    throw new Error("Malformed stripe-signature header.");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signedPayload = `${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = encoder.encode(toHex(digest));
  const provided = encoder.encode(v1);
  if (!timingSafeEqual(expected, provided)) {
    throw new Error("Invalid Stripe signature.");
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const commissionRate = Number(Deno.env.get("PLATFORM_COMMISSION_RATE") ?? "0.12");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Missing Supabase configuration." }, 500);
    }

    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (stripeWebhookSecret && signature) {
      await verifyStripeSignature(payload, signature, stripeWebhookSecret);
    } else if (stripeWebhookSecret && !signature) {
      return jsonResponse({ error: "Missing stripe-signature header." }, 400);
    }

    const event = JSON.parse(payload);
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata ?? {};
      const jobId = metadata.job_id;
      const quoteId = metadata.quote_id;
      const homeownerId = metadata.homeowner_id;
      const contractorId = metadata.contractor_id;
      const amount = Number(session.amount_total ?? 0) / 100;
      const commissionAmount = Number((amount * commissionRate).toFixed(2));
      const payoutAmount = Number((amount - commissionAmount).toFixed(2));

      if (!jobId || !quoteId) {
        return jsonResponse({ error: "Missing metadata.job_id or metadata.quote_id." }, 400);
      }

      await adminClient
        .from("jobs")
        .update({
          status: "funded",
          payment_status: "held",
          stripe_payment_intent_id: session.payment_intent ?? null,
          stripe_checkout_session_id: session.id,
        })
        .eq("id", jobId);

      await adminClient.from("payments").insert({
        job_id: jobId,
        homeowner_id: homeownerId,
        contractor_id: contractorId,
        amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        payout_amount: payoutAmount,
        currency: session.currency ?? "usd",
        status: "held",
        stripe_payment_intent_id: session.payment_intent ?? null,
      });

      await adminClient.from("notifications").insert([
        {
          user_id: homeownerId,
          type: "payment_held",
          title: "Escrow funded",
          body: "Your payment is secured and held by the platform.",
          metadata: { jobId, quoteId },
        },
        {
          user_id: contractorId,
          type: "payment_held",
          title: "Job funded",
          body: "Homeowner funded the job. Start work when ready.",
          metadata: { jobId, quoteId },
        },
      ]);
    }

    if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      const paymentIntentId = dispute.payment_intent;
      const { data: payments } = await adminClient
        .from("payments")
        .select("id, job_id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .limit(1);

      const payment = payments?.[0];
      if (payment) {
        await adminClient.from("payments").update({ status: "disputed" }).eq("id", payment.id);
        await adminClient.from("jobs").update({ status: "disputed", payment_status: "disputed" }).eq("id", payment.job_id);
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
