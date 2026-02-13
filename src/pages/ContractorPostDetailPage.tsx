import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  createInAppNotification,
  createQuote,
  fetchJob,
  fetchMessages,
  fetchPostById,
  sendMessage,
  startOrGetConversation,
  updateJobStatus,
  uploadChatAttachment,
} from "@/lib/marketplace-api";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/sonner";
import type { Conversation, Message, QuoteItem } from "@/types/marketplace";

const emptyItem = (): QuoteItem => ({ label: "", quantity: 1, unitCost: 0 });

const ContractorPostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();

  const [post, setPost] = useState<Awaited<ReturnType<typeof fetchPostById>>>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([emptyItem()]);
  const [timelineDays, setTimelineDays] = useState("14");
  const [scopeNotes, setScopeNotes] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [loading, setLoading] = useState(true);

  const quoteTotal = useMemo(
    () => quoteItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [quoteItems],
  );

  const initialize = async () => {
    if (!user || !postId) return;
    setLoading(true);
    try {
      const postRow = await fetchPostById(postId);
      if (!postRow) {
        setPost(null);
        return;
      }
      setPost(postRow);

      const conversationRow = await startOrGetConversation({
        postId: postRow.id,
        homeownerId: postRow.owner_id,
        contractorId: user.id,
      });
      setConversation(conversationRow);

      const messageRows = await fetchMessages(conversationRow.id);
      setMessages(messageRows);

      const { data: quoteRows } = await supabase
        .from("quotes")
        .select("id")
        .eq("post_id", postRow.id)
        .eq("contractor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const quoteId = quoteRows?.[0]?.id as string | undefined;
      if (quoteId) {
        const job = await fetchJobByQuoteIdLocal(quoteId);
        setJobStatus(job?.status ?? null);
      } else {
        setJobStatus(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load post details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchJobByQuoteIdLocal = async (quoteId: string) => {
    const { data } = await supabase.from("jobs").select("id").eq("quote_id", quoteId).maybeSingle();
    if (!data?.id) return null;
    return fetchJob(data.id as string);
  };

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase
      .channel(`conversation:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!conversation || !user || (!messageText.trim() && !attachment)) return;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachment) {
        attachmentUrl = await uploadChatAttachment(attachment, user.id, conversation.id);
      }
      await sendMessage({
        conversationId: conversation.id,
        senderId: user.id,
        body: messageText.trim() || "Attachment uploaded",
        attachmentUrl,
      });
      await createInAppNotification({
        userId: conversation.homeowner_id,
        type: "new_message",
        title: "New contractor message",
        body: messageText.slice(0, 120) || "Attachment shared in chat",
        metadata: { conversationId: conversation.id },
      });
      setMessageText("");
      setAttachment(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleQuoteItemChange = (index: number, key: keyof QuoteItem, value: string) => {
    setQuoteItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: key === "label" || key === "description" ? value : Number(value),
            }
          : item,
      ),
    );
  };

  const handleSubmitQuote = async () => {
    if (!conversation || !post || !user) return;
    const validItems = quoteItems.filter((item) => item.label && item.quantity > 0 && item.unitCost > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one valid quote line item.");
      return;
    }
    setSubmittingQuote(true);
    try {
      const { quoteId, total } = await createQuote({
        postId: post.id,
        conversationId: conversation.id,
        contractorId: user.id,
        homeownerId: conversation.homeowner_id,
        items: validItems,
        timelineDays: Number(timelineDays) || 0,
        scopeNotes,
      });

      await sendMessage({
        conversationId: conversation.id,
        senderId: user.id,
        type: "quote",
        body: `Submitted quote: $${total.toLocaleString()} total`,
        quoteId,
      });

      await createInAppNotification({
        userId: conversation.homeowner_id,
        type: "new_quote",
        title: "New quote received",
        body: `A contractor submitted a quote for ${post.title}.`,
        metadata: { postId: post.id, quoteId },
      });

      toast.success("Quote submitted.");
      setQuoteItems([emptyItem()]);
      setScopeNotes("");
      setTimelineDays("14");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit quote.";
      toast.error(message);
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleUpdateJobStatus = async (status: "in_progress" | "completed") => {
    if (!post || !user) return;
    try {
      const { data: quoteRows } = await supabase
        .from("quotes")
        .select("id")
        .eq("post_id", post.id)
        .eq("contractor_id", user.id)
        .eq("status", "accepted")
        .limit(1);
      const quoteId = quoteRows?.[0]?.id;
      if (!quoteId) {
        toast.error("No accepted quote found.");
        return;
      }
      const { data: jobRow } = await supabase.from("jobs").select("id").eq("quote_id", quoteId).maybeSingle();
      if (!jobRow?.id) {
        toast.error("No job found for this accepted quote.");
        return;
      }
      await updateJobStatus(jobRow.id as string, status);
      setJobStatus(status);
      if (conversation) {
        await createInAppNotification({
          userId: conversation.homeowner_id,
          type: "job_status",
          title: "Job status updated",
          body: `Contractor marked job as ${status.replace("_", " ")}.`,
          metadata: { postId: post.id, status },
        });
      }
      toast.success(`Job marked ${status.replace("_", " ")}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status.";
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
  if (!post || !conversation) {
    return <p className="text-sm text-muted-foreground">Post not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        <p className="text-sm text-muted-foreground">
          {post.location} • {post.damage_type}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>{post.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Badge variant="outline">Status: {post.status}</Badge>
          {post.ai_summary && <p className="text-sm text-muted-foreground">AI summary: {post.ai_summary}</p>}
          {(post.ai_estimate_low || post.ai_estimate_high) && (
            <p className="text-sm text-muted-foreground">
              AI range: ${post.ai_estimate_low?.toLocaleString()} - ${post.ai_estimate_high?.toLocaleString()}
            </p>
          )}
          {jobStatus && <p className="text-sm text-muted-foreground">Current job status: {jobStatus}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleUpdateJobStatus("in_progress")}>
              Mark In Progress
            </Button>
            <Button variant="outline" onClick={() => handleUpdateJobStatus("completed")}>
              Mark Completed
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Structured Quote</CardTitle>
          <CardDescription>Itemize costs to help homeowners compare quotes easily.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {quoteItems.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-[2fr_100px_120px_auto]">
              <Input
                placeholder="Line item (e.g. Roof tear-off)"
                value={item.label}
                onChange={(event) => handleQuoteItemChange(index, "label", event.target.value)}
              />
              <Input
                type="number"
                min={1}
                placeholder="Qty"
                value={item.quantity}
                onChange={(event) => handleQuoteItemChange(index, "quantity", event.target.value)}
              />
              <Input
                type="number"
                min={0}
                placeholder="Unit $"
                value={item.unitCost}
                onChange={(event) => handleQuoteItemChange(index, "unitCost", event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setQuoteItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                disabled={quoteItems.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setQuoteItems((current) => [...current, emptyItem()])}>
            <Plus className="mr-2 h-4 w-4" />
            Add line item
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Timeline (days)</Label>
              <Input type="number" min={1} value={timelineDays} onChange={(event) => setTimelineDays(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <Input value={`$${quoteTotal.toLocaleString()}`} readOnly />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Scope notes</Label>
            <Textarea value={scopeNotes} onChange={(event) => setScopeNotes(event.target.value)} rows={3} />
          </div>
          <Button onClick={handleSubmitQuote} disabled={submittingQuote}>
            {submittingQuote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Quote Proposal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>Real-time conversation with the homeowner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractorPostDetailPage;
