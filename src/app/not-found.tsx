"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Unknown routes bounce straight back to the homepage instead of a 404 page.
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="grid min-h-screen place-items-center text-slate-500">
      Redirecting…
    </div>
  );
}
