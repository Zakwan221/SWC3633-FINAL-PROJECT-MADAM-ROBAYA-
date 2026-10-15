import { ArrowRight, Ticket } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { TiltedGridHero } from "@/components/ui/tilted-grid-hero";
import { cn } from "@/lib/utils";

// TiketKita's own event photos, copied into /public/images. Portrait or
// landscape, they are cropped to the tiles by object-cover.
const IMAGES = Array.from({ length: 8 }, (_, i) => ({
  src: `/images/event-${i + 1}.jpg`,
}));

// The existing TiketKita site, served by XAMPP. Only links point at it;
// this page never calls the API or touches the database.
const SITE = "http://localhost/event-frontend/index.html";

export default function TiltedGridHeroDemo() {
  return (
    <TiltedGridHero
      images={IMAGES}
      className="h-svh min-h-[560px] w-full bg-background"
    >
      <div className="relative z-10 flex h-full flex-col items-center justify-between py-12 text-center">
        <div className="flex flex-col items-center gap-5 px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
            <Ticket aria-hidden className="size-3.5" />
            Events and venues in Malaysia
          </span>
          <h1 className="text-balance text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl md:text-6xl">
            Find your next
            <br />
            <em className="font-serif font-normal italic tracking-tight text-primary">
              unforgettable
            </em>{" "}
            event
          </h1>
        </div>

        <div className="flex flex-col items-center gap-6 px-6">
          <p className="max-w-md text-balance text-sm text-muted-foreground sm:text-base">
            Concerts, festivals and conferences across Malaysia, all in one
            place. Pick your tickets and you are done.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`${SITE}#events`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 px-5 text-base font-semibold",
              )}
            >
              Browse events
              <ArrowRight aria-hidden data-icon="inline-end" />
            </a>
            <a
              href={`${SITE}#info`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 px-5 text-base font-semibold",
              )}
            >
              How it works
            </a>
          </div>
        </div>
      </div>
    </TiltedGridHero>
  );
}
