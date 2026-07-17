import { describe, it, expect } from "vitest";
import { resolveAdvisorBot, advisorPlanUrl } from "./botRouter";

describe("resolveAdvisorBot", () => {
  it("routes motor-flavoured plans to Alex", () => {
    expect(resolveAdvisorBot("Aegis Smart Drive Shield")).toBe("Alex");
    expect(resolveAdvisorBot("Motor Bumper Guard")).toBe("Alex");
  });

  it("routes travel-flavoured plans to Ethan", () => {
    expect(resolveAdvisorBot("Global Nomad Voyage Cover")).toBe("Ethan");
    expect(resolveAdvisorBot("Aegis Travel Elite")).toBe("Ethan");
  });

  it("routes property/home/cyber/pet plans to Emma", () => {
    expect(resolveAdvisorBot("Aegis Home Fortress")).toBe("Emma");
    expect(resolveAdvisorBot("Cyber Shield Pro")).toBe("Emma");
    expect(resolveAdvisorBot("Paws Pet Cover")).toBe("Emma");
  });

  it("routes health and unmatched plans to Sarah (default)", () => {
    expect(resolveAdvisorBot("Aegis Supreme Health Shield")).toBe("Sarah");
    expect(resolveAdvisorBot("Something Unrecognised")).toBe("Sarah");
    expect(resolveAdvisorBot("")).toBe("Sarah");
  });

  it("is case-insensitive", () => {
    expect(resolveAdvisorBot("SMART DRIVE")).toBe("Alex");
  });
});

describe("advisorPlanUrl", () => {
  it("builds a deep-link with the resolved bot and url-encoded plan name", () => {
    expect(advisorPlanUrl("Aegis Smart Drive Shield"))
      .toBe("/advisor?bot=Alex&selectPlan=Aegis%20Smart%20Drive%20Shield");
  });

  it("preserves the original casing of the plan name in the link", () => {
    expect(advisorPlanUrl("Health Plan")).toBe("/advisor?bot=Sarah&selectPlan=Health%20Plan");
  });
});
