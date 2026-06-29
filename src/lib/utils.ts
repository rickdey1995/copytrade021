import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function safeJson<T = any>(response: Response): Promise<T | null> {
  try {
    return await response.json()
  } catch (error) {
    console.warn('safeJson: failed to parse JSON response', error)
    return null
  }
}
