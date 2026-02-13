import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Filter, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { createStripeConnectOnboarding, fetchJobsForContractor, fetchOpenPosts } from "@/lib/marketplace-api";
import { toast } from "@/components/ui/sonner";
import type { DamagePost, Job } from "@/types/marketplace";

const damageTypes = ["all", "roof", "siding", "flooding", "windows", "tree_impact", "hail", "other"];

const ContractorDashboardPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [location, setLocation] = useState("");
  const [damageType, setDamageType] = useState("all");
  const [posts, setPosts] = useState<DamagePost[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [postRows, jobRows] = await Promise.all([
        fetchOpenPosts({
          location: location.trim() || undefined,
          damageType: damageType === "all" ? undefined : damageType,
        }),
        fetchJobsForContractor(user.id),
      ]);
      setPosts(postRows);
      setJobs(jobRows);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPayouts = async () => {
    try {
      const result = await createStripeConnectOnboarding();
      toast.success("Redirecting to Stripe onboarding.");
      window.location.href = result.url;
      await refreshProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Stripe onboarding.";
      toast.error(message);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contractor Dashboard</h1>
        <p className="text-sm text-muted-foreground">Browse damage posts, quote projects, and manage accepted jobs.</p>
        <div className="mt-3">
          {profile?.stripe_account_id ? (
            <Badge>Payout account connected</Badge>
          ) : (
            <Button size="sm" onClick={handleConnectPayouts}>
              Connect Stripe Payouts
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Browse Filters
          </CardTitle>
          <CardDescription>Filter available projects by location and damage type.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="location-filter">Location</Label>
            <Input
              id="location-filter"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, state, or zip"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Damage Type</Label>
            <Select value={damageType} onValueChange={setDamageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {damageTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={loadData}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Damage Posts</CardTitle>
          <CardDescription>Respond quickly to increase your win rate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!loading && posts.length === 0 && <p className="text-sm text-muted-foreground">No matching posts right now.</p>}
          {posts.map((post) => (
            <Link key={post.id} to={`/app/contractor/posts/${post.id}`} className="block rounded-md border p-3 hover:bg-muted/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{post.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {post.location} • {post.damage_type}
                  </p>
                </div>
                <Badge variant="outline">{post.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.description}</p>
              {post.ai_estimate_low && post.ai_estimate_high && (
                <p className="mt-2 text-xs text-muted-foreground">
                  AI range: ${post.ai_estimate_low.toLocaleString()} - ${post.ai_estimate_high.toLocaleString()}
                </p>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Jobs</CardTitle>
          <CardDescription>Track accepted projects and payout readiness.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet.</p>}
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-1">
                <p className="font-medium">
                  <Briefcase className="mr-2 inline h-4 w-4" />
                  Job {job.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  status: {job.status} • payment: {job.payment_status}
                </p>
              </div>
              <Link to={`/app/contractor/posts/${job.post_id}`}>
                <Button variant="outline" size="sm">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractorDashboardPage;
