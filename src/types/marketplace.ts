export type AppRole = "user" | "contractor" | "admin";

export type DamagePostStatus =
  | "open"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired";

export type JobStatus =
  | "pending_payment"
  | "funded"
  | "in_progress"
  | "completed"
  | "released"
  | "disputed";

export type MessageType = "text" | "quote" | "system";

export type DamagePost = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  location: string;
  damage_type: string;
  status: DamagePostStatus;
  ai_summary: string | null;
  ai_estimate_low: number | null;
  ai_estimate_high: number | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  post_id: string;
  homeowner_id: string;
  contractor_id: string;
  status: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  body: string;
  attachment_url: string | null;
  quote_id: string | null;
  created_at: string;
};

export type QuoteItem = {
  label: string;
  quantity: number;
  unitCost: number;
  description?: string;
};

export type Quote = {
  id: string;
  post_id: string;
  conversation_id: string;
  contractor_id: string;
  homeowner_id: string;
  currency: string;
  subtotal: number;
  total: number;
  timeline_days: number | null;
  scope_notes: string | null;
  items: QuoteItem[];
  status: QuoteStatus;
  created_at: string;
  accepted_at: string | null;
};

export type Job = {
  id: string;
  post_id: string;
  quote_id: string;
  homeowner_id: string;
  contractor_id: string;
  status: JobStatus;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole | null;
  stripe_account_id: string | null;
  created_at: string;
};

export type DamageAnalysisResult = {
  summary: string;
  estimateLow: number;
  estimateHigh: number;
  suggestedLineItems: Array<{ label: string; amount: number }>;
};
