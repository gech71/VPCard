/**
 * The bridge the NIBtera Super App opens into the MiniApp WebView, used by step
 * 4 of the integration to hand a payment token back to the Super App.
 *
 * The guideline shows a bare `window.myJsChannel?.postMessage` check, which is
 * correct but assumes the channel is already there the moment our code runs.
 * In practice it is not always: when the Super App's payment sheet is dismissed
 * the WebView is reloaded, and the channel is injected by the host *after* the
 * document loads. A page that checks once, on a button click that lands inside
 * that window, sees nothing and tells the Guest to reopen the app - even though
 * the channel appears a moment later.
 *
 * So the channel is looked up lazily, remembered once seen, and waited for
 * rather than demanded.
 */

export type SuperAppChannel = {
  postMessage: (message: unknown) => void;
};

type ChannelHost = {
  myJsChannel?: { postMessage?: (message: unknown) => void };
  MyJsChannel?: { postMessage?: (message: unknown) => void };
  webkit?: {
    messageHandlers?: Record<string, { postMessage?: (message: unknown) => void }>;
  };
  flutter_inappwebview?: {
    callHandler?: (name: string, ...args: unknown[]) => unknown;
  };
  ReactNativeWebView?: { postMessage?: (message: string) => void };
};

/**
 * Held from the first sighting. The channel is a native binding owned by the
 * WebView's JavaScript context, so if this module is still loaded the binding
 * is still live - only a reload can take it away, and a reload takes this
 * cache with it. Keeping the reference therefore survives the host merely
 * reassigning or deleting the global.
 */
let remembered: SuperAppChannel | null = null;

function readChannel(): SuperAppChannel | null {
  if (typeof window === "undefined") return null;

  const host = window as unknown as ChannelHost;

  // The channel the guideline names, and the capitalisation some Super App
  // builds inject instead.
  for (const candidate of [host.myJsChannel, host.MyJsChannel]) {
    if (typeof candidate?.postMessage === "function") {
      const channel = candidate as SuperAppChannel;
      return { postMessage: (message) => channel.postMessage(message) };
    }
  }

  // iOS WKWebView exposes the same named channel under messageHandlers.
  const handler = host.webkit?.messageHandlers?.myJsChannel;
  if (typeof handler?.postMessage === "function") {
    return { postMessage: (message) => handler.postMessage!(message) };
  }

  // Flutter's inappwebview bridge, when the host registered a handler instead
  // of a JavaScript channel.
  const callHandler = host.flutter_inappwebview?.callHandler;
  if (typeof callHandler === "function") {
    return {
      postMessage: (message) =>
        void host.flutter_inappwebview!.callHandler!("myJsChannel", message),
    };
  }

  // React Native WebView only carries strings.
  const rn = host.ReactNativeWebView;
  if (typeof rn?.postMessage === "function") {
    return { postMessage: (message) => rn.postMessage!(JSON.stringify(message)) };
  }

  return null;
}

/**
 * The channel if it is available right now, remembering it for later. Safe to
 * call as often as you like - it is a property read.
 */
export function getSuperAppChannel(): SuperAppChannel | null {
  const live = readChannel();

  if (live) {
    remembered = live;
    return live;
  }

  return remembered;
}

/**
 * Waits for the Super App to inject its channel, for callers that cannot
 * proceed without it. Resolves as soon as it appears, so the common case - the
 * channel is already there - costs one property read and no delay.
 */
export function waitForSuperAppChannel(
  timeoutMs = 8000,
  pollMs = 150,
): Promise<SuperAppChannel | null> {
  const immediate = getSuperAppChannel();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const tick = () => {
      const channel = getSuperAppChannel();

      if (channel) {
        resolve(channel);
        return;
      }

      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }

      setTimeout(tick, pollMs);
    };

    setTimeout(tick, pollMs);
  });
}

/**
 * Step 4 itself: hand the payment token to the Super App, exactly in the shape
 * the guideline specifies. Returns false when the message could not be
 * delivered, so the caller can keep the token and try again rather than
 * stranding a payment it already opened with the bank.
 */
export function sendPaymentToken(
  channel: SuperAppChannel,
  paymentToken: string,
): boolean {
  try {
    channel.postMessage({ token: paymentToken });
    return true;
  } catch (err) {
    console.error("[superapp-channel] postMessage failed", err);
    // A remembered handle that throws belongs to a context that is gone.
    remembered = null;
    return false;
  }
}
