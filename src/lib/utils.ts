import { clsx } from 'clsx';
import { merge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes using clsx and tailwind-merge.
 * @param classes - Tailwind CSS classes as strings.
 * @returns Merged class string.
 */
export function cn(...classes: string[]): string {
    return merge(clsx(...classes));
}