import { ResourceListPage } from "@/components/admin/crud";

export const metadata = { title: "LLM models | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <ResourceListPage resourceKey="models" searchParams={searchParams} />;
}
