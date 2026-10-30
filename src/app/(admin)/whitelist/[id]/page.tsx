import { ResourceEditPage } from "@/components/admin/crud";

export const metadata = { title: "Edit | Whitelisted emails | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceEditPage resourceKey="whitelist" params={params} />;
}
