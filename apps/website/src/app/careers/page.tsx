import { pageMetadata } from "@/lib/seo";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = pageMetadata({
  title: "Careers",
  description:
    "We are not hiring publicly yet. When we are, roles and how we work will be posted here.",
  path: "/careers",
  // Nothing to index until there are roles. `follow` stays on so the links out
  // of this page still carry weight.
  noIndex: true,
});

export default function CareersPage() {
  return (
    <ComingSoon
      icon="users"
      overline="Careers"
      title="We are not hiring publicly yet"
      description="When we open roles, they will be listed here — with the salary range, the actual day-to-day work, and an honest description of what is hard about it."
      planned={[
        "Open roles with published salary ranges",
        "What the interview process actually involves",
        "How the team works, including the parts that are difficult",
        "Who you would be building for, and why it matters",
      ]}
      alternative={{
        description:
          "If you care about this problem and want to be told first, send us a note — we read every one.",
        label: "Get in touch",
        href: "/contact",
      }}
    />
  );
}
