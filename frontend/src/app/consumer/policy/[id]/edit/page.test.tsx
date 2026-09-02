/**
 * Correcting a saved policy.
 *
 * Three properties matter here, and none of them are about layout.
 *
 * A policy that is not this customer's must not be shown, and must not be shown
 * as an error either — the API answers 404 for both "gone" and "not yours", and
 * this page has to render that as the same honest sentence.
 *
 * A corrected vehicle must be corrected in place. Sending the details nested in
 * the policy update matches them by registration number, so a fixed typo would
 * quietly create a second vehicle and orphan the first.
 *
 * And a vehicle nobody touched must not be written to at all, because the audit
 * trail is later read to answer what this customer actually changed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ConsumerPolicy } from "@/services/api";
import { policyFixture } from "@/lib/consumer/testing/policyFixture";
import EditPolicyPage from "./page";

const getPolicy = vi.fn();
const updatePolicy = vi.fn();
const updateVehicle = vi.fn();
const push = vi.fn();

vi.mock("@/services/api", () => ({
  consumerService: {
    getPolicy: (...args: unknown[]) => getPolicy(...args),
    updatePolicy: (...args: unknown[]) => updatePolicy(...args),
    updateVehicle: (...args: unknown[]) => updateVehicle(...args),
  },
}));
vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({ user: { name: "Meena", preferredLanguage: "en" }, isReady: true }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "pol-1" }),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const policy: ConsumerPolicy = policyFixture();

const click = (element: Element) => fireEvent.click(element);
const named = (name: string): HTMLInputElement =>
  document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const fill = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });

/** Walk from the vehicle step to the review screen. */
const reachReview = () => {
  for (let i = 0; i < 5; i += 1) click(screen.getByTestId("wizard-next"));
};

const save = () => click(screen.getByTestId("wizard-submit"));

beforeEach(() => {
  vi.clearAllMocks();
  updatePolicy.mockResolvedValue({ policy });
  updateVehicle.mockResolvedValue({ vehicle: policy.vehicle });
});

describe("a policy that is not this customer's", () => {
  it("reads as missing rather than as an error or a refusal", async () => {
    // The API answers 404 for "gone" and for "somebody else's" alike, and a
    // page that distinguished them would confirm which ids exist.
    getPolicy.mockRejectedValue(new Error("Request failed with status code 404"));
    render(<EditPolicyPage />);

    await waitFor(() =>
      expect(screen.getByText("We could not find that policy")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("wizard-next")).not.toBeInTheDocument();
  });
});

describe("the form the customer sees", () => {
  beforeEach(() => getPolicy.mockResolvedValue({ policy, disclaimer: "Guidance only.", locale: "en" }));

  it("opens pre-filled with what was saved", async () => {
    render(<EditPolicyPage />);

    await waitFor(() => expect(named("registrationNumber")).toHaveValue("TN 09 AB 1234"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Correct these details");
  });

  it("asks for the policy it was given, in the customer's language", async () => {
    render(<EditPolicyPage />);
    await waitFor(() => expect(getPolicy).toHaveBeenCalledWith("pol-1", "en"));
  });
});

describe("saving a correction", () => {
  beforeEach(() => getPolicy.mockResolvedValue({ policy, disclaimer: "Guidance only.", locale: "en" }));

  it("updates the policy and returns to it", async () => {
    render(<EditPolicyPage />);
    await waitFor(() => expect(named("registrationNumber")).toHaveValue("TN 09 AB 1234"));

    for (let i = 0; i < 3; i += 1) click(screen.getByTestId("wizard-next"));
    fill(named("expiryDate"), "2027-03-01");
    click(screen.getByTestId("wizard-next"));
    click(screen.getByTestId("wizard-next"));
    save();

    await waitFor(() => expect(updatePolicy).toHaveBeenCalledTimes(1));
    expect(updatePolicy.mock.calls[0][0]).toBe("pol-1");
    expect(updatePolicy.mock.calls[0][1]).toMatchObject({ expiryDate: "2027-03-01" });
    // The vehicle block is stripped out — it goes to its own endpoint.
    expect(updatePolicy.mock.calls[0][1]).not.toHaveProperty("vehicle");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/consumer/policy/pol-1"));
  });

  it("leaves the vehicle alone when nothing about it changed", async () => {
    render(<EditPolicyPage />);
    await waitFor(() => expect(named("registrationNumber")).toHaveValue("TN 09 AB 1234"));

    reachReview();
    save();

    await waitFor(() => expect(updatePolicy).toHaveBeenCalled());
    expect(updateVehicle).not.toHaveBeenCalled();
  });

  it("corrects the vehicle in place instead of creating a second one", async () => {
    render(<EditPolicyPage />);
    await waitFor(() => expect(named("registrationNumber")).toHaveValue("TN 09 AB 1234"));

    fill(named("registrationNumber"), "TN 09 AB 1235");
    reachReview();
    save();

    await waitFor(() => expect(updateVehicle).toHaveBeenCalledTimes(1));
    expect(updateVehicle.mock.calls[0][0]).toBe("veh-1");
    expect(updateVehicle.mock.calls[0][1]).toMatchObject({
      registrationNumber: "TN 09 AB 1235",
      vehicleType: "BIKE",
    });
  });

  it("does not touch the policy if the vehicle could not be saved", async () => {
    // Otherwise the policy would end up describing a vehicle the customer never
    // agreed to, and the two records would disagree.
    updateVehicle.mockRejectedValue(new Error("We could not save that just now."));
    render(<EditPolicyPage />);
    await waitFor(() => expect(named("registrationNumber")).toHaveValue("TN 09 AB 1234"));

    fill(named("registrationNumber"), "TN 09 AB 1235");
    reachReview();
    save();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(updatePolicy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
