import { useId, useRef } from "react";
import { Button } from "../app-kit";
import { uploadRules, validateUpload } from "../platform/live/content";

/** File bytes stay local until a team member saves the enclosing form. */
export function ContentUpload({ bucket, file, onChange, onError, disabled = false }: {
  bucket: keyof typeof uploadRules; file: File | null; onChange: (file: File | null) => void;
  onError: (message: string) => void; disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const certificate = bucket === "certificates";
  return <div className="kit-field">
    <label className="kit-field-label" htmlFor={id}>{certificate ? "Certificate PDF (required)" : "Cover upload"}</label>
    <input ref={input} className={certificate ? "kit-sr" : "cc-content-file"} tabIndex={certificate ? -1 : undefined} id={id} type="file" accept={uploadRules[bucket].types.join(",")} disabled={disabled} aria-describedby={`${id}-hint`} onChange={(event) => {
      const selected = event.currentTarget.files?.[0] ?? null;
      try { if (selected) validateUpload(bucket, selected); onChange(selected); onError(""); }
      catch (error) { event.currentTarget.value = ""; onChange(null); onError(error instanceof Error ? error.message : "This file could not be selected."); }
    }} />
    {certificate && <div className="cc-content-picker">
      <Button variant="quiet" disabled={disabled} aria-controls={id} aria-describedby={`${id}-filename ${id}-hint`} onClick={() => input.current?.click()}>Choose PDF</Button>
      <span id={`${id}-filename`} className="cc-content-filename" role="status">{file?.name ?? "No file chosen"}</span>
    </div>}
    <p id={`${id}-hint`} className="kit-field-hint">{certificate ? "PDF, up to 10 MB." : file?.name ?? "JPG, PNG or WebP, up to 5 MB."}</p>
  </div>;
}
