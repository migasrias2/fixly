import { ArrowRightIcon, PhoneCallIcon, RocketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoCloud } from "@/components/ui/logo-cloud-3";

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4">
      <div aria-hidden="true" className="absolute inset-0 isolate hidden overflow-hidden contain-strict lg:block">
        <div className="absolute inset-0 -top-14 isolate -z-10 bg-[radial-gradient(35%_80%_at_49%_0%,--theme(--color-primary/.22),transparent)] contain-strict" />
      </div>

      <div aria-hidden="true" className="absolute inset-0 mx-auto hidden min-h-screen w-full max-w-5xl lg:block">
        <div className="mask-y-from-80% mask-y-to-100% absolute inset-y-0 left-0 z-10 h-full w-px bg-primary/30" />
        <div className="mask-y-from-80% mask-y-to-100% absolute inset-y-0 right-0 z-10 h-full w-px bg-primary/30" />
      </div>

      <div className="relative flex flex-col items-center justify-center gap-5 pb-24 pt-24 md:pb-28 md:pt-28">
        <div aria-hidden="true" className="absolute inset-0 -z-1 size-full overflow-hidden">
          <div className="absolute inset-y-0 left-4 w-px bg-linear-to-b from-transparent via-primary/30 to-primary/20 md:left-8" />
          <div className="absolute inset-y-0 right-4 w-px bg-linear-to-b from-transparent via-primary/30 to-primary/20 md:right-8" />
          <div className="absolute inset-y-0 left-8 w-px bg-linear-to-b from-transparent via-primary/20 to-primary/10 md:left-12" />
          <div className="absolute inset-y-0 right-8 w-px bg-linear-to-b from-transparent via-primary/20 to-primary/10 md:right-12" />
        </div>

        <a
          className={cn(
            "group mx-auto flex w-fit items-center gap-3 rounded-full border bg-card px-3 py-1 shadow",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
          )}
          href="#features"
        >
          <RocketIcon className="size-3 text-muted-foreground" />
          <span className="text-xs">Nova versao da plataforma no ar</span>
          <span className="block h-5 border-l" />
          <ArrowRightIcon className="size-3 duration-150 ease-out group-hover:translate-x-1" />
        </a>

        <h1
          className={cn(
            "fade-in slide-in-from-bottom-10 animate-in text-balance fill-mode-backwards text-center text-4xl tracking-tight delay-100 duration-500 ease-out md:text-5xl lg:text-6xl",
            "text-shadow-[0_0px_50px_theme(--color-primary/.25)]",
          )}
        >
          Avalia os Danos e Encontra Empreiteiros Hoje
        </h1>

        <p className="fade-in slide-in-from-bottom-10 mx-auto max-w-md animate-in fill-mode-backwards text-center text-base text-foreground/80 tracking-wide delay-200 duration-500 ease-out sm:text-lg md:text-xl">
          Conecte sua necessidade aos melhores profissionais <br /> com chat e pagamento protegido
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex animate-in flex-row flex-wrap items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button className="rounded-full" size="lg" variant="secondary">
            <PhoneCallIcon data-icon="inline-start" className="mr-2 size-4" />
            Falar com especialista
          </Button>
          <Button className="rounded-full" size="lg">
            Comecar agora
            <ArrowRightIcon className="ms-2 size-4" data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LogosSection() {
  return (
    <section className="relative space-y-4 border-t border-primary/20 pb-10 pt-6">
      <h2 className="text-center text-lg font-medium tracking-tight text-muted-foreground md:text-xl">
        Confiado por <span className="text-foreground">times de alta performance</span>
      </h2>
      <div className="relative z-10 mx-auto max-w-4xl">
        <LogoCloud logos={logos} />
      </div>
    </section>
  );
}

const logos = [
  { src: "https://storage.efferd.com/logo/nvidia-wordmark.svg", alt: "Nvidia Logo" },
  { src: "https://storage.efferd.com/logo/supabase-wordmark.svg", alt: "Supabase Logo" },
  { src: "https://storage.efferd.com/logo/openai-wordmark.svg", alt: "OpenAI Logo" },
  { src: "https://storage.efferd.com/logo/turso-wordmark.svg", alt: "Turso Logo" },
  { src: "https://storage.efferd.com/logo/vercel-wordmark.svg", alt: "Vercel Logo" },
  { src: "https://storage.efferd.com/logo/github-wordmark.svg", alt: "GitHub Logo" },
  { src: "https://storage.efferd.com/logo/claude-wordmark.svg", alt: "Claude AI Logo" },
  { src: "https://storage.efferd.com/logo/clerk-wordmark.svg", alt: "Clerk Logo" },
];
