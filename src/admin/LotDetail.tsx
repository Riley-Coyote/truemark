import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Dot, Drawer, Facts, SampleTag, Section, formatDate } from "../app-kit";
import type { Product } from "../data";
import type { Lot } from "../platform/types";
import { lotNumber, lotStage } from "../platform/inventory";

const quiet = (text: string) => <span className="kit-quiet">{text}</span>;

/** One lot's record, read-only: dates, certificate number, recorded results, rejection note, the PDF and the public record. */
export function LotDetail({ lot, product, onClose }: { lot: Lot; product: Product; onClose: () => void }) {
  const stage = lotStage(lot);
  const published = lot.status === "released" || lot.status === "archived";
  return <Drawer mono title={lotNumber(lot)} eyebrow={lot.sample ? "Lot · sample" : "Lot"} subtitle={`${product.name} ${product.size} · ${product.form}`}
    tags={<><span className="inventory-stage" data-available={stage === "Available"}>{stage}</span>{lot.sample && <SampleTag>Fictional sample lot</SampleTag>}</>} onClose={onClose}>
    <Section title="Record">
      <Facts items={[
        { label: "Product", value: <span className="cc-dot-name"><Dot colour={product.color} />{product.name} {product.size}</span> },
        { label: "Stage", value: stage },
        { label: "First received", value: lot.receivedAt ? formatDate(lot.receivedAt) : quiet("Not received") },
        { label: "Tested", value: lot.testedAt ? formatDate(lot.testedAt) : quiet("No test date on file") },
        { label: "Released", value: lot.releasedAt ? formatDate(lot.releasedAt) : quiet("Not released") },
        { label: "Certificate number", value: lot.reference ? <span className="kit-mono">{lot.reference}</span> : quiet("None on file") },
        ...(lot.holdReason ? [{ label: "Hold reason", value: lot.holdReason }] : []),
      ]} />
    </Section>
    {lot.rejectionNote && <Section title="Rejection note"><p className="kit-note">{lot.rejectionNote}</p></Section>}
    <Section title="Recorded results">
      {lot.results.length ? <dl className="cc-results">{lot.results.map((result, i) => <div key={`${result.label}-${result.method}-${i}`}>
        <dt>{result.label}{result.method && <span>{result.method}</span>}</dt>
        <dd>{result.value}{result.unit && <small>{result.unit}</small>}</dd>
      </div>)}</dl> : <p className="kit-note">No results on file.</p>}
      {lot.results.length > 0 && lot.sample && <p className="cc-footnote">Illustrative values for a fictional sample lot.</p>}
    </Section>
    <Section title="Certificate file">
      {lot.coaUrl ? <a className="cc-public-link" href={lot.coaUrl} target="_blank" rel="noopener noreferrer">View certificate PDF<ArrowUpRight aria-hidden="true" strokeWidth={1.6} /><span className="kit-sr">, opens in a new tab</span></a>
        : <p className="kit-note">No PDF on file.</p>}
    </Section>
    <Section title="Public record">
      {published ? <Link className="cc-public-link" to={`/verify?lot=${encodeURIComponent(lot.lot)}`} target="_blank" rel="noreferrer">
        <span className="kit-mono">/verify?lot={lot.lot}</span><ArrowUpRight aria-hidden="true" strokeWidth={1.6} /><span className="kit-sr">, opens in a new tab</span>
      </Link> : <p className="kit-note">Results and the certificate are public only for released lots.</p>}
    </Section>
  </Drawer>;
}
