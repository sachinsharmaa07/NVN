import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins class names and lets later Tailwind classes override earlier ones (e.g. "p-4" then "p-6").
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
