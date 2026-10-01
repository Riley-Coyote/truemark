import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
// @ts-expect-error qrcode ships JavaScript only; its browser API is typed at this boundary below.
import QRCode from "qrcode";
import { Button, Card, Skeleton } from "../../app-kit";
import type { Partner } from "../../platform/types";
import { disclosure, partnerLink } from "../program";
import { CopyButton } from "./parts";

const qr: {
  toDataURL: (
    text: string,
    options: {
      width: number;
      margin: number;
      errorCorrectionLevel: "M";
      color: { dark: string; light: string };
    },
  ) => Promise<string>;
} = QRCode;

/** A single share kit for the overview and every destination in the link builder. */
export function ShareKit({
  partner,
  path = "/",
  embedded = false,
}: {
  partner: Partner;
  path?: string;
  embedded?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const url = partnerLink(path, partner.code);
  const reference = `?ref=${encodeURIComponent(partner.code)}`;
  const line = disclosure(partner.code);
  const [png, setPng] = useState<{ url: string; data: string }>();
  const [qrError, setQrError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const image = png?.url === url ? png.data : undefined;

  useEffect(() => {
    if (!root.current) return;
    let current = true;
    setQrError(false);
    const style = getComputedStyle(root.current);
    qr.toDataURL(url, {
      width: 1024,
      margin: 4,
      errorCorrectionLevel: "M",
      color: {
        dark: style.getPropertyValue("--tm-ink").trim(),
        light: style.getPropertyValue("--tm-paper").trim(),
      },
    }).then(
      (data) => {
        if (current) setPng({ url, data });
      },
      () => {
        if (current) setQrError(true);
      },
    );
    return () => {
      current = false;
    };
  }, [url, attempt]);

  async function share() {
    setSharing(true);
    setShareError("");
    try {
      await navigator.share({ url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setShareError("Sharing is unavailable. Copy your link instead.");
    } finally {
      setSharing(false);
    }
  }

  const body = (
    <div className="pp-share-kit-body" ref={root}>
      <p className="pp-share-url" title={url}>
        <span className="pp-share-url-start">
          {url.slice(0, -reference.length)}
        </span>
        <span className="pp-share-url-end">{reference}</span>
      </p>
      <p className="pp-share-kit-code">
        <span className="kit-label">Your code</span>
        <span className="kit-mono">{partner.code}</span>
      </p>
      <div className="pp-share-kit-actions">
        <CopyButton
          key={url}
          text={url}
          label="Copy link"
          what="Link"
          variant="primary"
        />
        <CopyButton text={partner.code} label="Copy code" what="Code" />
        {canShare && (
          <Button onClick={share} disabled={sharing}>
            <Share2 aria-hidden="true" />
            Share
          </Button>
        )}
      </div>
      {shareError && (
        <p className="pp-share-error" role="status">
          {shareError}
        </p>
      )}
      <div className="pp-share-qr">
        {image ? (
          <img
            src={image}
            alt={`QR code for your partner link, ${url}`}
            width="96"
            height="96"
          />
        ) : (
          <Skeleton width="6rem" height="6rem" />
        )}
        <div className="pp-share-qr-info">
          <p>Your link, in person</p>
          {qrError ? (
            <>
              <p role="status">QR could not be created.</p>
              <Button onClick={() => setAttempt((n) => n + 1)}>
                Try QR again
              </Button>
            </>
          ) : (
            <>
              <p className="pp-share-qr-note">Ready to print for events.</p>
              <Button
                disabled={!image}
                onClick={() => {
                  if (!image) return;
                  const link = document.createElement("a");
                  link.href = image;
                  link.download = `truemark-${partner.code.toLowerCase()}-qr.png`;
                  link.click();
                }}
              >
                <Download aria-hidden="true" />
                Download QR (PNG)
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="pp-share-disclosure">
        <div className="pp-share-disclosure-head">
          <h3 className="kit-label">Disclosure</h3>
          <CopyButton text={line} label="Copy" what="Disclosure" />
        </div>
        <blockquote>
          <p>{line}</p>
        </blockquote>
        <p className="pp-share-reminder">
          In every post, before your link or code.
        </p>
      </div>
    </div>
  );
  return embedded ? (
    <div className="pp-share-kit is-embedded">{body}</div>
  ) : (
    <Card className="kit-span-4 pp-share-kit" title="Your link">
      {body}
    </Card>
  );
}
