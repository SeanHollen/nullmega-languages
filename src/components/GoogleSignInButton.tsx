import { useEffect, useRef } from "react";

// GSI is loaded via <script> in index.html and exposes a global `google` object.
interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (resp: { credential?: string }) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: { type?: string; theme?: string; size?: string; text?: string; shape?: string },
  ) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

interface Props {
  onCredential: (idToken: string) => void;
}

// Renders the official Google Sign-In button. Receives an id_token via callback when
// the user signs in; the parent is responsible for POSTing it to /api/auth/login.
export function GoogleSignInButton({ onCredential }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The GSI library is loaded async from a third-party script; we have no JSX-level
  // way to wait for it. A retry loop ticks until window.google.accounts is ready,
  // then initializes + renders the button into our container ref.
  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      const gsi = window.google?.accounts.id;
      if (!gsi || !containerRef.current) {
        setTimeout(tryRender, 100);
        return;
      }
      gsi.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          if (resp.credential) onCredential(resp.credential);
        },
      });
      gsi.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      });
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [onCredential]);

  if (!CLIENT_ID) {
    return (
      <p className="text-xs text-red-500">
        VITE_GOOGLE_CLIENT_ID is not set. Sign-in is unavailable.
      </p>
    );
  }
  return <div ref={containerRef} className="flex justify-center" />;
}
