import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { fetchConversationsForUser, fetchMyNotifications, fetchUserPosts } from "@/lib/marketplace-api";
import type { Conversation, DamagePost } from "@/types/marketplace";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const UserDashboardPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<DamagePost[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [postRows, conversationRows, notificationRows] = await Promise.all([
          fetchUserPosts(user.id),
          fetchConversationsForUser(user.id, "user"),
          fetchMyNotifications(user.id),
        ]);
        setPosts(postRows);
        setConversations(conversationRows);
        setNotifications(notificationRows as NotificationItem[]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [user]);

  const openPosts = useMemo(() => posts.filter((post) => post.status !== "completed" && post.status !== "cancelled"), [posts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">User Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage storm damage posts, quotes, and active jobs.</p>
        </div>
        <Button asChild>
          <Link to="/app/user/posts/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Damage Post
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open posts</CardDescription>
            <CardTitle>{openPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversations</CardDescription>
            <CardTitle>{conversations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Notifications</CardDescription>
            <CardTitle>{notifications.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Damage Posts</CardTitle>
          <CardDescription>Click a post to review quotes and chat with contractors.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
          {posts.map((post) => (
            <Link key={post.id} to={`/app/user/posts/${post.id}`} className="block rounded-md border p-3 hover:bg-muted/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{post.title}</p>
                  <p className="text-sm text-muted-foreground">{post.location}</p>
                </div>
                <Badge variant="outline">{post.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>In-app alerts for new quotes, messages, and payment events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-md border p-3">
              <p className="font-medium">{notification.title}</p>
              <p className="text-sm text-muted-foreground">{notification.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Need help fast? Open any post and message contractors directly.
          <MessageSquare className="ml-2 inline h-4 w-4" />
        </p>
      </div>
    </div>
  );
};

export default UserDashboardPage;
