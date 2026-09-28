import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppShell, Avatar, SampleTag, SearchField, formatDate } from "../app-kit";
import { OrderToasts, OwnerBell, useNarrow } from "./alerts";
import Applications from "./Applications";
import Customers from "./Customers";
import Discounts from "./Discounts";
import Lots from "./Lots";
import { TODAY_ISO } from "./metrics";
import { Missing } from "./Missing";
import { HOME, footerNav, navGroups, pageFor } from "./nav";
import Orders from "./Orders";
import Overview from "./Overview";
import Partners from "./Partners";
import Products from "./Products";
import Settings from "./Settings";
import { SearchQuery } from "./state";
import "./admin.css";

const OPERATOR = { initials: "TM", label: "TrueMark operator, preview" };

/** The command center: where the client runs the business every day. */
export default function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageFor(location.pathname);
  // One bell, where the layout shows its tools: the top bar, or the menu bar on phones.
  const narrow = useNarrow();

  // The query belongs to the page it was typed on; the overview can carry one to Orders.
  const carried = (location.state as { q?: string } | null)?.q ?? "";
  const [search, setSearch] = useState({ path: location.pathname, value: carried });
  if (search.path !== location.pathname) setSearch({ path: location.pathname, value: carried });
  const query = search.path === location.pathname ? search.value : carried;

  useEffect(() => {
    document.title = `${page.title} · Command — TrueMark BioLabs`;
  }, [page.title]);

  const today = formatDate(TODAY_ISO);
  const date = (
    <time className="kit-date" dateTime={TODAY_ISO.slice(0, 10)}>
      {today}
    </time>
  );
  const operator = <Avatar initials={OPERATOR.initials} label={OPERATOR.label} />;

  const searchField = page.search ? (
    <SearchField
      value={query}
      placeholder={page.search.placeholder}
      label={page.search.label}
      onChange={(value) => setSearch({ path: location.pathname, value })}
      onSubmit={
        page.search.mode === "jump"
          ? (value) => {
              const q = value.trim();
              if (q) navigate(`${HOME}/orders`, { state: { q } });
            }
          : undefined
      }
    />
  ) : (
    <SearchField value="" onChange={() => undefined} placeholder="Search" label="Search, not available on this page" disabled />
  );

  return (
    <AppShell
      theme="night"
      label="Command"
      home={HOME}
      nav={navGroups}
      footerNav={footerNav}
      storageKey="tm-command-sidebar"
      title={page.title}
      search={searchField}
      tools={
        <>
          {date}
          <SampleTag />
          {!narrow && <OwnerBell />}
          {operator}
        </>
      }
      mobileTools={
        <>
          <SampleTag />
          {narrow && <OwnerBell />}
        </>
      }
      menuFooter={
        <>
          {date}
          {operator}
        </>
      }
    >
      <SearchQuery.Provider value={query.trim()}>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="orders" element={<Orders />} />
          <Route path="lots" element={<Lots />} />
          <Route path="applications" element={<Applications />} />
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="discounts" element={<Discounts />} />
          <Route path="partners" element={<Partners />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </SearchQuery.Provider>
      <OrderToasts />
    </AppShell>
  );
}
