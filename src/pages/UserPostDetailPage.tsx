import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptQuote,
  createContractorReview,
  createInAppNotification,
  createStripeCheckoutSession,
  fetchConversationsForUser,
  fetchJobByQuoteId,
  fetchMessages,
  fetchPostById,
  fetchQuotesByPost,
  releaseJobPayment,
  sendMessage,
  uploadChatAttachment,
} from "@/lib/marketplace-api";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/sonner";
import type { Conversation, Job, Message, Profile, Quote } from "@/types/marketplace";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

const UserPostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Awaited<ReturnType<typeof fetchPostById>>>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobsByQuoteId, setJobsByQuoteId] = useState<Record<string, Job | null>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const selectedJob = useMemo(() => {
    const acceptedQuote = quotes.find((quote) => quote.status === "accepted");
    if (!acceptedQuote) return null;
    return jobsByQuoteId[acceptedQuote.id] ?? null;
  }, [jobsByQuoteId, quotes]);

  const loadPageData = async () => {
    if (!user || !postId) return;
    setLoading(true);
    try {
      const [postRow, quoteRows, conversationRows] = await Promise.all([
        fetchPostById(postId),
        fetchQuotesByPost(postId),
        fetchConversationsForUser(user.id, "user"),
      ]);
      setPost(postRow);
      setQuotes(quoteRows);

      const postConversations = conversationRows.filter((conversation) => conversation.post_id === postId);
      setConversations(postConversations);
      if (postConversations[0] && !selectedConversationId) {
        setSelectedConversationId(postConversations[0].id);
      }

      const contractorIds = Array.from(
        new Set([...quoteRows.map((quote) => quote.contractor_id), ...postConversations.map((row) => row.contractor_id)]),
      );
      if (contractorIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, role, stripe_account_id, created_at")
          .in("id", contractorIds);
        if (profileError) throw profileError;
        const map = Object.fromEntries((profileRows ?? []).map((profile) => [profile.id, profile]));
        setProfilesById(map);
      }

      const jobsEntries = await Promise.all(
        quoteRows.map(async (quote) => {
          const job = await fetchJobByQuoteId(quote.id);
          return [quote.id, job] as const;
        }),
      );
      setJobsByQuoteId(Object.fromEntries(jobsEntries));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load post details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  useEffect(() => {
    const run = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }
      try {
        const rows = await fetchMessages(selectedConversationId);
        setMessages(rows);
      } catch (error) {
        console.error(error);
      }
    };
    void run();
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const channel = supabase
      .channel(`conversation:${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedConversationId]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversationId || !user || (!messageText.trim() && !attachment)) return;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachment) {
        attachmentUrl = await uploadChatAttachment(attachment, user.id, selectedConversationId);
      }

      await sendMessage({
        conversationId: selectedConversationId,
        senderId: user.id,
        body: messageText.trim() || "Attachment uploaded",
        attachmentUrl,
      });

      if (selectedConversation) {
        await createInAppNotification({
          userId: selectedConversation.contractor_id,
          type: "new_message",
          title: "New message from homeowner",
          body: messageText.slice(0, 120) || "Attachment shared in chat",
          metadata: { conversationId: selectedConversationId },
        });
      }

      setMessageText("");
      setAttachment(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptQuote = async (quote: Quote) => {
    try {
      const job = await acceptQuote(quote);
      await createInAppNotification({
        userId: quote.contractor_id,
        type: "quote_accepted",
        title: "Quote accepted",
        body: "A homeowner accepted your quote. Payment is pending.",
        metadata: { quoteId: quote.id, postId: quote.post_id },
      });
      setJobsByQuoteId((current) => ({ ...current, [quote.id]: job }));
      await loadPageData();
      toast.success("Quote accepted. Proceed to payment.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept quote.";
      toast.error(message);
    }
  };

  const handlePay = async (quote: Quote) => {
    try {
      const job = jobsByQuoteId[quote.id];
      if (!job) {
        toast.error("No job found for this quote.");
        return;
      }
      const session = await createStripeCheckoutSession({ jobId: job.id, quoteId: quote.id });

      if (stripePromise) {
        const stripe = await stripePromise;
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId: session.checkoutSessionId });
          if (error) throw error;
          return;
        }
      }

      window.location.href = session.checkoutUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start payment.";
      toast.error(message);
    }
  };

  const handleReleasePayment = async () => {
    if (!selectedJob) return;
    try {
      await releaseJobPayment({ jobId: selectedJob.id });
      toast.success("Payment released to contractor.");
      await loadPageData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to release payment.";
      toast.error(message);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedJob || !post || !user) return;
    try {
      await createContractorReview({
        jobId: selectedJob.id,
        postId: post.id,
        homeownerId: user.id,
        contractorId: selectedJob.contractor_id,
        rating: Number(reviewRating),
        comment: reviewComment,
      });
      toast.success("Review submitted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit review.";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!post) {
    return <p className="text-sm text-muted-foreground">Post not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <p className="text-sm text-muted-foreground">
          {post.location} • {post.damage_type} • status: {post.status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quote Comparison</CardTitle>
          <CardDescription>Compare itemized quotes side-by-side and choose one contractor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quotes.length === 0 && <p className="text-sm text-muted-foreground">No quotes yet.</p>}
          {quotes.map((quote) => {
            const contractor = profilesById[quote.contractor_id];
            const job = jobsByQuoteId[quote.id];
            return (
              <div key={quote.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{contractor?.full_name ?? "Contractor"}</p>
                  <Badge variant={quote.status === "accepted" ? "default" : "outline"}>{quote.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {quote.timeline_days ? `${quote.timeline_days} days` : "Timeline TBD"} • ${quote.total.toLocaleString()}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  {(quote.items ?? []).map((item) => (
                    <div key={`${quote.id}-${item.label}`} className="flex justify-between">
                      <span>{item.label}</span>
                      <span>${(item.quantity * item.unitCost).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{quote.scope_notes}</p>
                {quote.status === "pending" && (
                  <Button className="mt-3 w-full" onClick={() => handleAcceptQuote(quote)}>
                    Accept Quote
                  </Button>
                )}
                {quote.status === "accepted" && (
                  <div className="mt-3 space-y-2">
                    <Button className="w-full" onClick={() => handlePay(quote)}>
                      Fund Job (Escrow)
                    </Button>
                    <p className="text-xs text-muted-foreground">Job status: {job?.status ?? "pending_payment"}</p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle>Completion and Payout</CardTitle>
            <CardDescription>Release payment once repair work is completed and reviewed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Job status: <span className="font-medium text-foreground">{selectedJob.status}</span>
            </p>
            <Button onClick={handleReleasePayment} disabled={selectedJob.status !== "completed"}>
              Release Payment to Contractor
            </Button>
            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <div className="space-y-1.5">
                <Label>Rating</Label>
                <Select value={reviewRating} onValueChange={setReviewRating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Review</Label>
                <Textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Share your experience with this contractor."
                />
              </div>
            </div>
            <Button variant="secondary" onClick={handleSubmitReview}>
              Submit Review
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Chat with Contractors</CardTitle>
          <CardDescription>Real-time messaging for quote clarifications and updates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {conversations.map((conversation) => (
              <Button
                key={conversation.id}
                variant={selectedConversationId === conversation.id ? "default" : "outline"}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                {profilesById[conversation.contractor_id]?.full_name ?? "Contractor"}
              </Button>
            ))}
          </div>
          {selectedConversation && (
            <>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
                {messages.map((message) => (
                  <div key={message.id} className={`rounded-md p-2 text-sm ${message.sender_id === user?.id ? "bg-primary/10" : "bg-muted"}`}>
                    <p>{message.body}</p>
                    {message.attachment_url && (
                      <a className="text-xs underline" href={message.attachment_url} target="_blank" rel="noreferrer">
                        Open attachment
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="space-y-2">
                <Input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Type your message..."
                />
                <Input type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
                <Button type="submit" disabled={sending}>
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Message
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserPostDetailPage;
