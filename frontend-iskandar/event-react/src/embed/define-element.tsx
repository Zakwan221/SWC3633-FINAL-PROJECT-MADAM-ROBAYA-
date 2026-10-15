import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Registers a custom element that renders a React tree.
 *
 * The element mounts React when it is added to the page and unmounts when it is
 * removed, so a plain-HTML host page needs no lifecycle code: it just writes the
 * tag. `render` receives an attribute reader and returns what to draw.
 */
export function defineReactElement(
  tag: string,
  attributes: string[],
  render: (attr: (name: string) => string | null) => ReactNode,
) {
  class ReactElement extends HTMLElement {
    static observedAttributes = attributes;

    #root: Root | null = null;

    connectedCallback() {
      this.#root ??= createRoot(this);
      this.#update();
    }

    disconnectedCallback() {
      this.#root?.unmount();
      this.#root = null;
    }

    attributeChangedCallback() {
      this.#update();
    }

    #update() {
      this.#root?.render(render((name) => this.getAttribute(name)));
    }
  }

  if (!customElements.get(tag)) customElements.define(tag, ReactElement);
}

/** "12" -> 12; missing, blank or non-numeric -> undefined (so the prop default applies). */
export const toNumber = (value: string | null) =>
  value == null || value.trim() === "" || Number.isNaN(Number(value))
    ? undefined
    : Number(value);

/** Only the literal "false" turns a flag off; missing -> undefined (prop default). */
export const toFlag = (value: string | null) =>
  value == null ? undefined : value !== "false";

/** Parses a JSON attribute, returning undefined when it is missing or malformed. */
export function toJson(value: string | null): unknown {
  if (value == null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
