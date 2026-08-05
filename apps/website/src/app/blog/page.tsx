import { pageMetadata } from "@/lib/seo";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Not published yet. When it is, it will cover how insurance actually works and what we are learning building for it.",
  path: "/blog",
  noIndex: true,
});

export default function BlogPage() {
  return (
    <ComingSoon
      icon="book"
      overline="Blog"
      title="Nothing published yet"
      description="We would rather have no blog than one padded with posts nobody needed. When we have something worth the time it takes to read, it will be here."
      planned={[
        "How insurance products actually work, without the sales framing",
        "What we get wrong building for first-time buyers, and what we change",
        "Engineering notes on the parts that turned out to be hard",
        "Regulatory changes, explained for people they affect",
      ]}
      alternative={{
        description:
          "The resources section already covers most of what people come here looking for.",
        label: "Read the guides",
        href: "/resources",
      }}
    />
  );
}
