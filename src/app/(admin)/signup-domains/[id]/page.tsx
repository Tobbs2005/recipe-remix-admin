import { ResourceEditPage } from "@/components/admin/crud";

export const metadata = { title: "Edit | Signup domains | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceEditPage resourceKey="signup-domains" params={params} />;
}
