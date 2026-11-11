"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton({ label }: { label: string }) {
  return <Button size="lg" onClick={() => window.print()}><Printer size={20} aria-hidden />{label}</Button>;
}
