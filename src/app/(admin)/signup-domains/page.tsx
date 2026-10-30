import { ResourceListPage } from "@/components/admin/crud";

export const metadata = { title: "Signup domains | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ResourceListPage resourceKey="signup-domains" searchParams={searchParams} />;
}
