/**
 * The atmosphere behind the page: a faint grid and two slow colour washes.
 *
 * Pure CSS gradients rather than an image, for three reasons — no request, no
 * layout shift when it arrives, and it recolours itself with the theme instead
 * of needing a second asset. It is fixed to the viewport and sits behind
 * everything, so it never enters the scroll or paint path of the content.
 *
 * `aria-hidden` because it says nothing. A decorative flourish announced to a
 * screen reader is noise between the visitor and the page.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Hairline grid. Masked to fade out before the footer so it does not
          fight with the content at the bottom of long pages. */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(var(--aegis-border-subtle) / 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--aegis-border-subtle) / 0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 100% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      <div className="absolute -top-40 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full bg-brand/10 blur-[128px]" />
      <div className="absolute -right-32 top-[28rem] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-[128px]" />
    </div>
  );
}
