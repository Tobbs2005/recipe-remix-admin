import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl">🥄</p>
      <h1 className="text-3xl font-bold text-cocoa">Nothing on this shelf</h1>
      <Link href="/" className="font-bold text-emerald-700 hover:underline">Back to the overview</Link>
    </main>
  );
}
