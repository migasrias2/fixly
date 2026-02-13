import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { analyzeDamageWithAI, createDamagePost, uploadDamagePhoto } from "@/lib/marketplace-api";
import { toast } from "@/components/ui/sonner";
import type { DamageAnalysisResult } from "@/types/marketplace";

const damageTypeOptions = ["roof", "siding", "flooding", "windows", "tree_impact", "hail", "other"];

const fileToBase64 = async (file: File): Promise<{ mimeType: string; data: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to process image."));
        return;
      }
      const [, base64] = result.split(",");
      resolve({ mimeType: file.type || "image/jpeg", data: base64 });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

const UserCreatePostPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [damageType, setDamageType] = useState("roof");
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<DamageAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);

  const disableSubmit = useMemo(() => !title || !description || !location || files.length === 0, [description, files.length, location, title]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setFiles(nextFiles);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error("Upload at least one photo for AI analysis.");
      return;
    }
    setAnalyzing(true);
    try {
      const imagesBase64 = await Promise.all(files.slice(0, 4).map((file) => fileToBase64(file)));
      const result = await analyzeDamageWithAI({
        imagesBase64,
        damageType,
        description,
      });
      setAnalysis(result);
      toast.success("AI estimate generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI analysis failed.";
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setCreating(true);
    try {
      const postId = await createDamagePost({
        ownerId: user.id,
        title,
        description,
        location,
        damageType,
        aiSummary: analysis?.summary,
        aiEstimateLow: analysis?.estimateLow,
        aiEstimateHigh: analysis?.estimateHigh,
      });

      await Promise.all(files.map((file) => uploadDamagePhoto({ file, postId, ownerId: user.id })));
      toast.success("Damage post created.");
      navigate(`/app/user/posts/${postId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create post.";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Damage Post</h1>
        <p className="text-sm text-muted-foreground">Upload photos, run AI analysis, and publish your repair request.</p>
      </div>

      <form onSubmit={handleCreatePost} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Damage Details</CardTitle>
            <CardDescription>These details are visible to contractors when they quote your project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Storm damaged roof with leaks" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what happened, urgency, and any safety concerns."
                rows={5}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Austin, TX" required />
              </div>
              <div className="space-y-1.5">
                <Label>Damage Type</Label>
                <Select value={damageType} onValueChange={setDamageType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select damage type" />
                  </SelectTrigger>
                  <SelectContent>
                    {damageTypeOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="photos">Photos</Label>
              <Input id="photos" type="file" multiple accept="image/*" onChange={onFileChange} required />
              <p className="text-xs text-muted-foreground">{files.length} file(s) selected.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={handleAnalyze} disabled={analyzing || files.length === 0}>
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analyze with AI
              </Button>
              <Button type="submit" disabled={creating || disableSubmit}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Damage Post
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Estimate</CardTitle>
            <CardDescription>Generated by Claude and attached to your post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!analysis && <p className="text-sm text-muted-foreground">Run AI analysis after uploading photos.</p>}
            {analysis && (
              <>
                <p className="text-sm">{analysis.summary}</p>
                <div className="rounded-md bg-muted p-3 text-sm">
                  Estimated range: ${analysis.estimateLow.toLocaleString()} - ${analysis.estimateHigh.toLocaleString()}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suggested line items</p>
                  {analysis.suggestedLineItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span>${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default UserCreatePostPage;
