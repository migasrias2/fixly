import { supabase } from "@/lib/supabase";
import type { DamageAnalysisResult, DamagePost, Job, Message, Quote, QuoteItem } from "@/types/marketplace";

export type PostFilters = {
  location?: string;
  damageType?: string;
};

export const fetchOpenPosts = async (filters: PostFilters = {}): Promise<DamagePost[]> => {
  let query = supabase
    .from("damage_posts")
    .select("id, owner_id, title, description, location, damage_type, status, ai_summary, ai_estimate_low, ai_estimate_high, created_at")
    .in("status", ["open", "quoted", "accepted", "in_progress"])
    .order("created_at", { ascending: false });

  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }
  if (filters.damageType) {
    query = query.eq("damage_type", filters.damageType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const fetchUserPosts = async (userId: string): Promise<DamagePost[]> => {
  const { data, error } = await supabase
    .from("damage_posts")
    .select("id, owner_id, title, description, location, damage_type, status, ai_summary, ai_estimate_low, ai_estimate_high, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const fetchPostById = async (postId: string): Promise<DamagePost | null> => {
  const { data, error } = await supabase
    .from("damage_posts")
    .select("id, owner_id, title, description, location, damage_type, status, ai_summary, ai_estimate_low, ai_estimate_high, created_at")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createDamagePost = async (input: {
  ownerId: string;
  title: string;
  description: string;
  location: string;
  damageType: string;
  aiSummary?: string;
  aiEstimateLow?: number;
  aiEstimateHigh?: number;
}) => {
  const { data, error } = await supabase
    .from("damage_posts")
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      description: input.description,
      location: input.location,
      damage_type: input.damageType,
      ai_summary: input.aiSummary ?? null,
      ai_estimate_low: input.aiEstimateLow ?? null,
      ai_estimate_high: input.aiEstimateHigh ?? null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
};

export const uploadDamagePhoto = async (args: {
  file: File;
  postId: string;
  ownerId: string;
}) => {
  const extension = args.file.name.split(".").pop() ?? "jpg";
  const filePath = `${args.ownerId}/${args.postId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("damage-photos").upload(filePath, args.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("damage-photos").getPublicUrl(filePath);

  const { error: dbError } = await supabase.from("post_photos").insert({
    post_id: args.postId,
    owner_id: args.ownerId,
    storage_path: filePath,
    public_url: publicUrl,
  });
  if (dbError) throw dbError;
};

export const startOrGetConversation = async (input: {
  postId: string;
  homeownerId: string;
  contractorId: string;
}) => {
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("id, post_id, homeowner_id, contractor_id, status, created_at")
    .eq("post_id", input.postId)
    .eq("contractor_id", input.contractorId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      post_id: input.postId,
      homeowner_id: input.homeownerId,
      contractor_id: input.contractorId,
      status: "active",
    })
    .select("id, post_id, homeowner_id, contractor_id, status, created_at")
    .single();
  if (error) throw error;
  return data;
};

export const fetchConversationsForUser = async (userId: string, role: "user" | "contractor") => {
  const column = role === "contractor" ? "contractor_id" : "homeowner_id";
  const { data, error } = await supabase
    .from("conversations")
    .select("id, post_id, homeowner_id, contractor_id, status, created_at")
    .eq(column, userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, type, body, attachment_url, quote_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const sendMessage = async (input: {
  conversationId: string;
  senderId: string;
  body: string;
  type?: "text" | "quote" | "system";
  attachmentUrl?: string;
  quoteId?: string;
}) => {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    body: input.body,
    type: input.type ?? "text",
    attachment_url: input.attachmentUrl ?? null,
    quote_id: input.quoteId ?? null,
  });
  if (error) throw error;
};

export const uploadChatAttachment = async (file: File, userId: string, conversationId: string) => {
  const extension = file.name.split(".").pop() ?? "bin";
  const filePath = `${userId}/${conversationId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);
  return publicUrl;
};

export const createQuote = async (input: {
  postId: string;
  conversationId: string;
  contractorId: string;
  homeownerId: string;
  items: QuoteItem[];
  timelineDays: number;
  scopeNotes: string;
}) => {
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      post_id: input.postId,
      conversation_id: input.conversationId,
      contractor_id: input.contractorId,
      homeowner_id: input.homeownerId,
      items: input.items,
      subtotal,
      total: subtotal,
      timeline_days: input.timelineDays,
      scope_notes: input.scopeNotes,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("damage_posts").update({ status: "quoted" }).eq("id", input.postId);
  return { quoteId: data.id as string, total: subtotal };
};

export const fetchQuotesByPost = async (postId: string): Promise<Quote[]> => {
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, post_id, conversation_id, contractor_id, homeowner_id, currency, subtotal, total, timeline_days, scope_notes, items, status, created_at, accepted_at",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Quote[];
};

export const acceptQuote = async (quote: Quote) => {
  const { error: quoteError } = await supabase
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", quote.id);
  if (quoteError) throw quoteError;

  await supabase
    .from("quotes")
    .update({ status: "rejected" })
    .eq("post_id", quote.post_id)
    .neq("id", quote.id)
    .eq("status", "pending");

  const { error: postError } = await supabase.from("damage_posts").update({ status: "accepted" }).eq("id", quote.post_id);
  if (postError) throw postError;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      post_id: quote.post_id,
      quote_id: quote.id,
      homeowner_id: quote.homeowner_id,
      contractor_id: quote.contractor_id,
      status: "pending_payment",
      payment_status: "pending",
    })
    .select("id, post_id, quote_id, homeowner_id, contractor_id, status, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, created_at")
    .single();
  if (jobError) throw jobError;
  return job as Job;
};

export const fetchJobByQuoteId = async (quoteId: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, post_id, quote_id, homeowner_id, contractor_id, status, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, created_at",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (error) throw error;
  return data as Job | null;
};

export const fetchJobsForContractor = async (contractorId: string): Promise<Job[]> => {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, post_id, quote_id, homeowner_id, contractor_id, status, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, created_at",
    )
    .eq("contractor_id", contractorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Job[];
};

export const updateJobStatus = async (jobId: string, status: Job["status"]) => {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) throw error;

  if (status === "in_progress" || status === "completed") {
    const job = await fetchJob(jobId);
    if (job?.post_id) {
      await supabase
        .from("damage_posts")
        .update({ status: status === "in_progress" ? "in_progress" : "completed" })
        .eq("id", job.post_id);
    }
  }
};

export const fetchJob = async (jobId: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, post_id, quote_id, homeowner_id, contractor_id, status, payment_status, stripe_checkout_session_id, stripe_payment_intent_id, created_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data as Job | null;
};

export const createContractorReview = async (input: {
  jobId: string;
  postId: string;
  homeownerId: string;
  contractorId: string;
  rating: number;
  comment: string;
}) => {
  const { error } = await supabase.from("contractor_reviews").upsert(
    {
      job_id: input.jobId,
      post_id: input.postId,
      homeowner_id: input.homeownerId,
      contractor_id: input.contractorId,
      rating: input.rating,
      comment: input.comment,
    },
    { onConflict: "job_id" },
  );
  if (error) throw error;
};

export const createInAppNotification = async (input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) => {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
};

export const fetchMyNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, type, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return data ?? [];
};

export const analyzeDamageWithAI = async (input: {
  imagesBase64: Array<{ mimeType: string; data: string }>;
  damageType: string;
  description: string;
}): Promise<DamageAnalysisResult> => {
  const { data, error } = await supabase.functions.invoke("analyze-damage", {
    body: input,
  });
  if (error) throw error;
  return data as DamageAnalysisResult;
};

export const createStripeCheckoutSession = async (input: { jobId: string; quoteId: string }) => {
  const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
    body: input,
  });
  if (error) throw error;
  return data as { checkoutSessionId: string; checkoutUrl: string };
};

export const releaseJobPayment = async (input: { jobId: string }) => {
  const { data, error } = await supabase.functions.invoke("release-job-payment", {
    body: input,
  });
  if (error) throw error;
  return data as { released: boolean };
};

export const createStripeConnectOnboarding = async () => {
  const { data, error } = await supabase.functions.invoke("create-connect-onboarding", {
    body: {},
  });
  if (error) throw error;
  return data as { accountId: string; url: string };
};
