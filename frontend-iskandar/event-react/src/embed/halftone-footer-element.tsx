import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

import HalftoneWordmarkFooter, {
  type FooterColumn,
} from "@/components/ui/halftone-wordmark-footer";
import { defineReactElement, toFlag, toJson, toNumber } from "./define-element";

/**
 * <halftone-wordmark-footer
 *   wordmark="welcome to|tiketkita"
 *   label="Welcome to TiketKita" meta="..."
 *   columns='[{"title":"Explore","links":[{"label":"Events","href":"#events"}]}]'
 *   background="#020617" ink="#e2e8f0" warm="#22c55e"
 *   dot-gap="4" dot-gap-narrow="3" word-width="80"></halftone-wordmark-footer>
 *
 * Colours follow the page theme (`data-theme` on <html>): `ink-dark`, `ink-light`,
 * `warm-dark` and `warm-light` win over `ink` and `warm`. `background="transparent"`
 * lets the page show through. `text="false"` drops the label, links and back-to-top
 * block, leaving only the word.
 *
 * Block-level and full width. Needs `container-type: inline-size` on the tag
 * (the host page's CSS sets it) so heights can follow the block's own width.
 *
 * The component sets one line of text, sized to fill the width. So `wordmark`
 * is split on "|" and each line becomes its own full-width word: a long phrase
 * on one line would come out small. `word-width` (a % of the block's width, default
 * full width) shrinks the words toward the centre; `word-width-narrow` does the same
 * below `narrow-below` px. The first block holds the label, links and
 * back-to-top; each word below is sized to its own letters, so the box has no
 * dead space and the letters are never cropped.
 */

const FONT =
  '"Inter Tight", "Inter Variable", "Inter", "Helvetica Neue", Arial, system-ui, sans-serif';
const WEIGHT = 800;
// Same side padding the component gives its text, so words and text line up.
const SIDE = "clamp(20px, 3.4vw, 44px)";
// Space between lines, and under the last one.
const LINE_GAP = 16;

function parseColumns(value: string | null): FooterColumn[] | undefined {
  const list = toJson(value);
  if (!Array.isArray(list)) return undefined;
  return list
    .filter((c) => c && typeof c.title === "string" && Array.isArray(c.links))
    .map((c) => ({
      title: c.title,
      links: c.links
        .filter((l: { label?: unknown }) => typeof l?.label === "string")
        .map((l: { label: string; href?: string }) => ({ label: l.label, href: l.href })),
    }));
}

/** "dark" or "light", following the host page's data-theme attribute on <html>. */
function useTheme() {
  return useSyncExternalStore(
    (onChange) => {
      const watcher = new MutationObserver(onChange);
      watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => watcher.disconnect();
    },
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
  );
}

function useMatchMedia(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** Letter height of one line as a share of the width it is fitted to. */
function letterShare(line: string) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0.15;
  ctx.font = `${WEIGHT} 100px ${FONT}`;
  const m = ctx.measureText(line);
  // The component fits a word to 1.02x its box width.
  return m.width > 0 ? (1.02 * m.actualBoundingBoxAscent) / m.width : 0.15;
}

/**
 * How tall each line's letters are, as a share of the width they are fitted to.
 * Measured with the same face the component draws with, and measured again once
 * web fonts have loaded, since a fallback face has different proportions.
 */
function useLetterShares(joined: string) {
  const [shares, setShares] = useState<number[]>([]);
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => alive && setShares(joined.split("|").map(letterShare));
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      alive = false;
    };
  }, [joined]);
  return shares;
}

function Footer({ attr }: { attr: (name: string) => string | null }) {
  const narrow = useMatchMedia(`(max-width: ${(toNumber(attr("narrow-below")) ?? 640) - 1}px)`);
  const lines = (attr("wordmark") ?? "")
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
  const shares = useLetterShares(lines.join("|"));

  const theme = useTheme();
  const palette = {
    background: attr("background") ?? undefined,
    ink: attr(`ink-${theme}`) ?? attr("ink") ?? undefined,
    warm: attr(`warm-${theme}`) ?? attr("warm") ?? undefined,
  };
  // Words fill the block between SIDE paddings, or a given % of its width, centred.
  const wordWidth = toNumber(attr(narrow ? "word-width-narrow" : "word-width"));
  const side = wordWidth ? `max(${SIDE}, calc((100cqw - ${wordWidth}cqw) / 2))` : SIDE;
  const dotGap = (narrow ? toNumber(attr("dot-gap-narrow")) : undefined) ?? toNumber(attr("dot-gap"));
  const shared = {
    palette,
    dotGap,
    radius: toNumber(attr("radius")),
    grain: toNumber(attr("grain")),
    interactive: toFlag(attr("interactive")),
    fontFamily: FONT,
    fontWeight: WEIGHT,
  };

  return (
    <>
      {/* Label, links and back-to-top. No word of its own; it is as tall as its content. */}
      {(toFlag(attr("text")) ?? true) && (
        <HalftoneWordmarkFooter
          {...shared}
          wordmark=""
          label={attr("label") ?? undefined}
          meta={attr("meta") ?? undefined}
          columns={parseColumns(attr("columns"))}
          backToTop={toFlag(attr("back-to-top"))}
          height="auto"
        />
      )}
      {lines.length > 0 && (
        <div
          style={
            {
              "--hwf-side": side,
              background: attr("background") ?? "#0c0c0b",
              padding: `${LINE_GAP}px var(--hwf-side) 0`,
            } as CSSProperties
          }
        >
          {lines.map((line, i) => (
            <div key={`${i}:${line}`} style={{ paddingBottom: LINE_GAP }}>
              <HalftoneWordmarkFooter
                {...shared}
                className="hwf-wordonly"
                wordmark={line}
                columns={[]}
                label=""
                meta=""
                backToTop={false}
                crop={0}
                // Letter height for this line's width, plus a little headroom for the dots.
                height={`calc(${(shares[i] ?? 0.15).toFixed(4)} * (100cqw - 2 * var(--hwf-side)) + 10px)`}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

defineReactElement(
  "halftone-wordmark-footer",
  [
    "wordmark", "narrow-below", "text", "label", "meta", "columns", "back-to-top",
    "background", "ink", "ink-dark", "ink-light", "warm", "warm-dark", "warm-light",
    "dot-gap", "dot-gap-narrow", "word-width", "word-width-narrow", "radius", "grain", "interactive",
  ],
  (attr) => <Footer attr={attr} />,
);
