import { redirect } from "next/navigation";

/** Redirects back to a page with a message the Flash component displays. */
export function redirectWith(path: string, kind: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}
