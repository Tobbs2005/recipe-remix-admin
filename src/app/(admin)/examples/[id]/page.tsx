import { ResourceEditPage } from "@/components/admin/crud";

export const metadata = { title: "Edit | Generation examples | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceEditPage resourceKey="examples" params={params} />;
}
