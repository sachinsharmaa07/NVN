// sonner, loaded on the first toast instead of in the first download (HLD §7 critical-path budget).
// Same API as sonner's toast.success / toast.error for the code that runs in the shell.
// shortcut: a toast fired before the lazy <Toaster> has mounted (first ~100ms after load) is dropped;
// nothing in the shell toasts that early. Upgrade to a queue if that changes.
const call =
  (method) =>
  (...args) => {
    import("sonner").then(({ toast }) => toast[method](...args));
  };

export const toast = { success: call("success"), error: call("error") };
