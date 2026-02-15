import { Header } from "@/components/ui/header-1";
import { HeroSection, LogosSection } from "@/components/ui/hero-1";

export default function DemoOne() {
  return (
    <div className="flex w-full flex-col">
      <Header />
      <main className="grow">
        <HeroSection />
        <LogosSection />
      </main>
    </div>
  );
}
