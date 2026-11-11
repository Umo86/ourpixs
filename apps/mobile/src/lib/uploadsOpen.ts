import type { PublicOccasion } from "@/api/types";

/** Guest uploads are closed by the host's schedule (`uploadOpen`) or because the host's account is read-only (`uploadsOpen`). */
export function guestUploadsClosed(o: Pick<PublicOccasion, "uploadOpen" | "uploadsOpen"> | null | undefined): boolean {
  return !!o && (o.uploadOpen === false || o.uploadsOpen === false);
}
