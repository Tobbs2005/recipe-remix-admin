import { ResourceEditPage } from "@/components/admin/crud";

export const metadata = { title: "Edit | Terms | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceEditPage resourceKey="terms" params={params} />;
}
