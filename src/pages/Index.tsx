import { Link } from "react-router-dom";
import { BadgeCheck, Camera, CreditCard, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "Upload damage photos",
    description: "Homeowners create a post with storm photos and receive an AI-assisted estimate range.",
    icon: Camera,
  },
  {
    title: "Get contractor quotes in chat",
    description: "Licensed contractors browse local jobs, message homeowners, and submit structured quotes.",
    icon: MessageSquareQuote,
  },
  {
    title: "Fund with escrow protection",
    description: "Accepted quotes are funded through platform-managed escrow with transparent payouts.",
    icon: CreditCard,
  },
];

const trustPoints = [
  "Real-time quote conversations",
  "Structured itemized bids",
  "Escrow and staged release flow",
  "Ratings after completion",
];

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 md:px-6">
        <div className="space-y-5">
          <p className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Storm Repair Marketplace
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            Post storm damage. Compare contractor quotes. Pay safely with escrow.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Fixly connects homeowners and contractors for storm damage repairs with AI-assisted estimates, real-time
            chat, and protected payout flows.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Post Damage</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/auth?redirect=/app/contractor">Browse Jobs</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3 md:px-6">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="h-5 w-5 text-primary" />
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="rounded-xl border bg-card p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Built for trust in urgent repairs</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-2 text-sm">
                <BadgeCheck className="h-4 w-4 text-primary" />
                <span>{point}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />
            Platform commission: 10-15% configurable per payment flow.
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
