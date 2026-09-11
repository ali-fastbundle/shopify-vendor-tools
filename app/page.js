import Directory from "@/components/Directory";
import { mergedTools } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Rendered on the server so the catalogue, including vendor edits, is in the
  // HTML for crawlers rather than arriving after hydration.
  const tools = await mergedTools();
  return <Directory tools={tools} />;
}
