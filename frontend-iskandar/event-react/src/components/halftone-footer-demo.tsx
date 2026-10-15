import HalftoneWordmarkFooter from "@/components/ui/halftone-wordmark-footer"

// Links point at the existing TiketKita site (served by XAMPP).
const SITE = "http://localhost/event-frontend/index.html"

export default function HalftoneFooterDemo() {
  // w-full matters: a flex item left at width:auto shrinks the canvas to 0px wide.
  return (
    <div className="w-full">
      <HalftoneWordmarkFooter
        wordmark="tiketkita"
        label="Welcome to TiketKita"
        meta="Your ticket to events across Malaysia"
        columns={[
          {
            title: "Explore",
            links: [
              { label: "Home", href: `${SITE}#home` },
              { label: "Events", href: `${SITE}#events` },
              { label: "Info", href: `${SITE}#info` },
            ],
          },
        ]}
        palette={{ background: "#020617", ink: "#e2e8f0", warm: "#22c55e" }}
        height="clamp(320px, 38vw, 480px)"
      />
    </div>
  )
}
