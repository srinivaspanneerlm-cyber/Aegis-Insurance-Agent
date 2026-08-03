import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AGENTS, AGENT_ORDER, GLYPHS, HEX_PATH, VIEWBOX } from "./geometry";
import { BrandMark } from "./BrandMark";
import { AgentBadge } from "./AgentBadge";
import { AgentConstellation } from "./AgentConstellation";

afterEach(cleanup);

const ALL = ["aegis", ...AGENT_ORDER] as const;

describe("brand geometry", () => {
  it("defines a tone for every mark", () => {
    for (const id of ALL) {
      const tone = AGENTS[id];
      expect(tone, id).toBeDefined();
      expect(tone.name).toBeTruthy();
      expect(tone.role).toBeTruthy();
    }
  });

  it("uses real hex colours sampled from the master", () => {
    for (const id of ALL) {
      expect(AGENTS[id].deep, id).toMatch(/^#[0-9A-F]{6}$/i);
      expect(AGENTS[id].bright, id).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("gives every agent a distinct hue, so the family is still five brands", () => {
    const tones = AGENT_ORDER.map((a) => AGENTS[a].deep);
    expect(new Set(tones).size).toBe(AGENT_ORDER.length);
  });

  it("gives every agent a glyph with drawable geometry", () => {
    for (const agent of AGENT_ORDER) {
      const glyph = GLYPHS[agent];
      const paths = [...(glyph.fill ?? []), ...(glyph.stroke ?? [])];
      expect(paths.length, agent).toBeGreaterThan(0);
      for (const d of paths) expect(d, agent).toMatch(/^M/);
    }
  });

  it("keeps every mark inside the safe area", () => {
    // Nothing may touch the canvas edge, or the mark crops in a favicon.
    const coords = HEX_PATH.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...coords)).toBeGreaterThan(0);
    expect(Math.max(...coords)).toBeLessThan(VIEWBOX);
  });
});

describe("BrandMark", () => {
  it("renders every mark in the family", () => {
    for (const id of ALL) {
      const { container } = render(<BrandMark brand={id} title={AGENTS[id].name} />);
      expect(container.querySelector("svg"), id).toBeInTheDocument();
      cleanup();
    }
  });

  it("names the mark for assistive technology when asked", () => {
    render(<BrandMark brand="sarah" title="Sarah — Health Insurance Agent" />);
    expect(screen.getByRole("img", { name: /sarah/i })).toBeInTheDocument();
  });

  it("hides itself from the accessibility tree beside its own visible label", () => {
    const { container } = render(<BrandMark brand="sarah" title={null} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("scales without redrawing — the same viewBox at any size", () => {
    const { container } = render(<BrandMark brand="alex" size={512} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", `0 0 ${VIEWBOX} ${VIEWBOX}`);
    expect(svg).toHaveAttribute("width", "512");
  });

  it("collapses to a single ink in monochrome, so it survives one-colour print", () => {
    const { container } = render(<BrandMark brand="emma" variant="mono-dark" glow={false} />);
    expect(container.querySelector("linearGradient")).not.toBeInTheDocument();
  });

  it("gives concurrent marks unique gradient ids", () => {
    const { container } = render(
      <>
        <BrandMark brand="alex" />
        <BrandMark brand="sarah" />
      </>
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("can drop the glow, which is what a favicon needs", () => {
    const { container } = render(<BrandMark brand="nova" glow={false} />);
    expect(container.querySelector("filter")).not.toBeInTheDocument();
  });
});

describe("AgentBadge", () => {
  it("is a real button when it can be chosen", () => {
    render(<AgentBadge agent="alex" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /alex/i })).toBeInTheDocument();
  });

  it("is not a control when it cannot be chosen", () => {
    render(<AgentBadge agent="alex" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hands back which agent was picked", () => {
    const onSelect = vi.fn();
    render(<AgentBadge agent="ethan" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /ethan/i }));
    expect(onSelect).toHaveBeenCalledWith("ethan");
  });

  it("reports its selected state to assistive technology", () => {
    render(<AgentBadge agent="emma" state="selected" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /emma/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the agent's name and role", () => {
    render(<AgentBadge agent="nova" showRole />);
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText(/claims & fraud/i)).toBeInTheDocument();
  });
});

describe("AgentConstellation", () => {
  it("lines up every agent in the roster order", () => {
    render(<AgentConstellation />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(AGENT_ORDER.length);
    expect(buttons[0]).toHaveAccessibleName(/alex/i);
    expect(buttons[4]).toHaveAccessibleName(/nova/i);
  });

  it("announces a selection rather than only showing it", () => {
    render(<AgentConstellation />);
    fireEvent.click(screen.getByRole("button", { name: /sarah/i }));
    expect(screen.getByText(/sarah selected/i)).toBeInTheDocument();
  });

  it("marks the chosen agent pressed and leaves the rest unpressed", () => {
    render(<AgentConstellation />);
    fireEvent.click(screen.getByRole("button", { name: /emma/i }));

    expect(screen.getByRole("button", { name: /emma/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /alex/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("lets the same agent be deselected", () => {
    const onSelect = vi.fn();
    render(<AgentConstellation onSelect={onSelect} />);
    const ethan = screen.getByRole("button", { name: /ethan/i });

    fireEvent.click(ethan);
    expect(ethan).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(ethan);
    expect(ethan).toHaveAttribute("aria-pressed", "false");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("opens the caller's card for the chosen agent", () => {
    render(<AgentConstellation renderCard={(a) => <p>card for {a}</p>} />);
    fireEvent.click(screen.getByRole("button", { name: /alex/i }));
    expect(screen.getByText("card for alex")).toBeInTheDocument();
  });

  it("adds the Executive above the row only when asked", () => {
    const { rerender } = render(<AgentConstellation />);
    expect(screen.queryByText("Aegis AI")).not.toBeInTheDocument();

    rerender(<AgentConstellation showExecutive />);
    expect(screen.getByText("Aegis AI")).toBeInTheDocument();
  });
});
