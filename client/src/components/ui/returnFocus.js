import { useRef } from "react";

/**
 * Radix's modal Dialog only gives focus back to a `<Dialog.Trigger>`. Ours mostly open from state, so on close
 * focus fell to <body> (UI.md §9: Escape closes an overlay and returns focus to its trigger). This remembers
 * what had focus when the content opened and puts focus back there on close. A caller's own handlers run
 * first; one that calls preventDefault (it moved focus itself) wins.
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }) {
  const opener = useRef(null);
  return {
    onOpenAutoFocus(event) {
      opener.current = document.activeElement;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus(event) {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      if (opener.current?.isConnected) {
        event.preventDefault();
        opener.current.focus();
      }
      opener.current = null;
    },
  };
}
