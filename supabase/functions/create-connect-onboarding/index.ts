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
    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "http://localhost:8080";

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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, stripe_account_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return jsonResponse({ error: "Profile not found." }, 404);
    }
    if (profile.role !== "contractor" && profile.role !== "admin") {
      return jsonResponse({ error: "Only contractors can connect payouts." }, 403);
    }

    let accountId = profile.stripe_account_id as string | null;
    if (!accountId) {
      const accountParams = new URLSearchParams();
      accountParams.append("type", "express");
      accountParams.append("country", "US");
      accountParams.append("business_type", "individual");
      accountParams.append("capabilities[transfers][requested]", "true");
      accountParams.append("metadata[user_id]", user.id);
      if (profile.full_name) {
        accountParams.append("business_profile[name]", profile.full_name);
      }

      const accountResponse = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: accountParams.toString(),
      });
      if (!accountResponse.ok) {
        const errorText = await accountResponse.text();
        throw new Error(`Stripe account creation failed: ${errorText}`);
      }
      const account = await accountResponse.json();
      accountId = account.id as string;

      await adminClient.from("profiles").update({ stripe_account_id: accountId }).eq("id", user.id);
    }

    const accountLinkParams = new URLSearchParams();
    accountLinkParams.append("account", accountId);
    accountLinkParams.append("type", "account_onboarding");
    accountLinkParams.append("refresh_url", `${appBaseUrl}/app/contractor?connect=retry`);
    accountLinkParams.append("return_url", `${appBaseUrl}/app/contractor?connect=done`);

    const linkResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: accountLinkParams.toString(),
    });
    if (!linkResponse.ok) {
      const errorText = await linkResponse.text();
      throw new Error(`Stripe onboarding link failed: ${errorText}`);
    }
    const link = await linkResponse.json();

    return jsonResponse({ accountId, url: link.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse({ error: message }, 500);
  }
});
