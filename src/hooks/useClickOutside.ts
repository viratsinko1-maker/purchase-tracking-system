/**
 * Hook for detecting clicks outside of specified elements
 * Commonly used for closing dropdowns, modals, etc.
 */

import { useEffect, type RefObject } from "react";

type RefWithCallback = {
  ref: RefObject<HTMLElement | null>;
  callback: () => void;
};

/**
 * Hook to detect clicks outside of specified element(s)
 *
 * @example
 * // Single element
 * const dropdownRef = useRef(null);
 * useClickOutside([{ ref: dropdownRef, callback: () => setIsOpen(false) }]);
 *
 * @example
 * // Multiple elements
 * const dropdown1Ref = useRef(null);
 * const dropdown2Ref = useRef(null);
 * useClickOutside([
 *   { ref: dropdown1Ref, callback: () => setIsOpen1(false) },
 *   { ref: dropdown2Ref, callback: () => setIsOpen2(false) },
 * ]);
 */
export function useClickOutside(items: RefWithCallback[]): void {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      items.forEach(({ ref, callback }) => {
        if (ref.current && !ref.current.contains(event.target as Node)) {
          callback();
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [items]);
}

/**
 * Simplified hook for a single element
 *
 * @example
 * const dropdownRef = useRef(null);
 * useClickOutsideSingle(dropdownRef, () => setIsOpen(false));
 */
export function useClickOutsideSingle(
  ref: RefObject<HTMLElement | null>,
  callback: () => void
): void {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}
