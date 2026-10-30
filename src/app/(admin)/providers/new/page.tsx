import { ResourceNewPage } from "@/components/admin/crud";

export const metadata = { title: "New | LLM providers | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ResourceNewPage resourceKey="providers" />;
}
