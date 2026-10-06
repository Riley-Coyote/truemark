import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState, SearchField, formatDate, plural } from "../app-kit";
import { content } from "../platform/content";
import { certificateLibrary, hplcPurity } from "../platform/certificates";
import { useResource } from "../platform/store";
import type { Lot } from "../platform/types";
import { productById, productCutout } from "../shop/catalog";
import "./certificate-library.css";

export function CertificateRows({ lots }: { lots: Lot[] }) {
  return <table className="tm-library-table">
    <caption className="sr-only">Released lot certificates</caption>
    <thead><tr>
      <th scope="col" className="tm-eyebrow">Compound</th>
      <th scope="col" className="tm-eyebrow">Lot</th>
      <th scope="col" className="tm-eyebrow">Released</th>
      <th scope="col" className="tm-eyebrow">HPLC purity</th>
      <th scope="col"><span className="sr-only">Certificate</span></th>
    </tr></thead>
    <tbody>{lots.map((lot) => {
      const product = productById(lot.productId);
      const purity = hplcPurity(lot);
      const link = <>View certificate <span aria-hidden="true">→</span><span className="sr-only"> for {lot.lot}{lot.coaUrl ? ", opens in a new tab" : ""}</span></>;
      return <tr key={lot.lot}>
        <td className="tm-library-compound">
          <div className="tm-library-product">
            {product && <img src={productCutout(product, "sm")} alt="" loading="lazy" draggable={false} />}
            <div><p className="tm-library-name">{product?.name ?? lot.productId} {product && <span className="tm-library-size">{product.size}</span>}</p>
              {lot.sample && <span className="tm-library-sample">Sample</span>}
            </div>
          </div>
        </td>
        <td className="tm-library-lot"><span className="tm-mono">{lot.lot}</span></td>
        <td className="tm-library-date">{lot.releasedAt ? <time dateTime={lot.releasedAt}>{formatDate(lot.releasedAt)}</time> : "—"}</td>
        <td className="tm-library-purity">{purity ? `${purity.value}${purity.unit}` : "—"}</td>
        <td className="tm-library-link">{lot.coaUrl
          ? <a className="tm-textlink" href={lot.coaUrl} target="_blank" rel="noopener noreferrer">{link}</a>
          : <Link className="tm-textlink" to={`/verify?lot=${encodeURIComponent(lot.lot)}`}>{link}</Link>}
        </td>
      </tr>;
    })}</tbody>
  </table>;
}

export function CertificateLibrary() {
  const library = useResource(() => content.library(), []);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const lots = certificateLibrary(library.data ?? [], query);
  // Until a lot is released there is nothing to count or search: the note says so on its own.
  const any = !library.loading && !library.error && certificateLibrary(library.data ?? [], "").length > 0;
  return <section className="tm kit tm-certificate-library" data-theme="studio" aria-labelledby="tm-library-title">
    <header className="tm-library-head">
      <p className="tm-eyebrow">Certificate library</p>
      <div className="tm-library-heading"><h2 id="tm-library-title" className="tm-heading">Every certificate on file.</h2>
        {any && <p className="tm-eyebrow tm-library-count" aria-live="polite">{plural(lots.length, "certificate")}</p>}
      </div>
    </header>
    {any && <div className="tm-library-search"><SearchField label="Search certificates by lot number or compound" placeholder="Lot number or compound" value={query} onChange={(value) => { setQuery(value); setLimit(12); }} /></div>}
    <div className="tm-library-records" aria-busy={library.loading}>
      {library.loading ? <p className="tm-section-note" role="status">Loading certificates…</p>
        : library.error ? <EmptyState title="Certificates could not be loaded." note={library.error.message} action={<Button onClick={library.reload}>Try again</Button>} />
        : !lots.length ? <p className="tm-section-note" role="status">{query.trim() ? `No certificate matches “${query}”.` : "Certificates appear here as each lot is released."}</p>
        : <CertificateRows lots={lots.slice(0, limit)} />}
      {!library.loading && !library.error && lots.length > limit && <Button onClick={() => setLimit((value) => value + 12)}>Show more</Button>}
    </div>
  </section>;
}
