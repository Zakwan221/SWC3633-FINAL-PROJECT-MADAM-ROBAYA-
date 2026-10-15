import { TiltedGridHero } from "@/components/ui/tilted-grid-hero";
import { defineReactElement, toJson, toNumber } from "./define-element";
import "./embed.css";

/**
 * <tilted-grid-hero images='["a.jpg","b.jpg"]' speed="4" curve="80"></tilted-grid-hero>
 *
 * It fills its parent, so give it a size (e.g. position:absolute; inset:0).
 */
defineReactElement(
  "tilted-grid-hero",
  ["images", "speed", "tile-height", "aspect-ratio", "gap", "axis", "curve", "fade"],
  (attr) => {
    const list = toJson(attr("images"));
    const images = Array.isArray(list)
      ? list.filter((src) => typeof src === "string").map((src) => ({ src }))
      : [];
    return (
      <TiltedGridHero
        className="size-full"
        images={images}
        speed={toNumber(attr("speed"))}
        tileHeight={toNumber(attr("tile-height"))}
        aspectRatio={toNumber(attr("aspect-ratio"))}
        gap={toNumber(attr("gap"))}
        axis={toNumber(attr("axis"))}
        curve={toNumber(attr("curve"))}
        fade={toNumber(attr("fade"))}
      />
    );
  },
);
