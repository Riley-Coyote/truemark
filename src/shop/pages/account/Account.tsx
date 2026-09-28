import { useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { store, useResource } from "../../../platform/store";
import type { Buyer } from "../../../platform/types";
import Addresses from "./Addresses";
import Certificates from "./Certificates";
import { receivedLots } from "./lib";
import { OrderDetail, OrderList } from "./Orders";
import Overview from "./Overview";
import { AccountContext, Empty, Loading, Problem, attempt, useTitle } from "./parts";
import Profile from "./Profile";

/** Signed-out visitors go to /access and come back here after signing in. */
export default function Account() {
  const location = useLocation();
  const session = useResource(attempt(() => store.session.get()));
  const leaving = useRef(false);
  const signOut = useCallback(async () => {
    leaving.current = true;
    try {
      await store.session.signOut();
    } catch (error) {
      leaving.current = false;
      throw error;
    }
  }, []);

  if (session.data === null) {
    return (
      <Navigate
        to="/access"
        replace
        state={leaving.current ? { signedOut: true } : { from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (session.data === undefined) {
    return (
      <Frame>
        <div className="tm-acct-main">
          {session.error ? (
            <Problem title="Your account could not be opened." onRetry={session.reload} />
          ) : (
            <Loading label="Opening your account" rows={4} />
          )}
        </div>
      </Frame>
    );
  }
  return <Desk buyer={session.data} signOut={signOut} />;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="tm-page tm-acct">
      <section className="tm tm-acct-frame" aria-label="Research account">
        {children}
      </section>
    </div>
  );
}

function Desk({ buyer, signOut }: { buyer: Buyer; signOut: () => Promise<void> }) {
  const orders = useResource(attempt(() => store.orders.listForBuyer(buyer.id)), [buyer.id]);
  const lots = useResource(attempt(() => store.lots.list()));
  const received = useMemo(() => (orders.data ? receivedLots(orders.data).length : undefined), [orders.data]);
  const nav: [string, string, number | undefined, boolean][] = [
    ["Overview", "/account", undefined, true],
    ["Orders", "/account/orders", orders.data?.length, false],
    ["Certificates", "/account/certificates", received, false],
    ["Addresses", "/account/addresses", undefined, false],
    ["Account", "/account/profile", undefined, false],
  ];
  return (
    <AccountContext.Provider value={{ buyer, orders, lots, signOut }}>
      <Frame>
        <aside className="tm-acct-side">
          <div className="tm-acct-who">
            <p className="tm-acct-who-name">{buyer.name}</p>
            <p className="tm-acct-who-meta">{buyer.institution}</p>
          </div>
          <nav className="tm-acct-nav" aria-label="Account">
            {nav.map(([label, to, count, end]) => (
              <NavLink key={to} to={to} end={end}>
                {label}
                {count !== undefined && (
                  <>
                    {" "}
                    <span>{count}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="tm-acct-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="certificates" element={<Certificates />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<Missing />} />
          </Routes>
        </div>
      </Frame>
    </AccountContext.Provider>
  );
}

function Missing() {
  useTitle("Not in your account");
  return (
    <Empty title="That page isn’t part of your account." text="The address may be mistyped, or the page may have moved.">
      <Link className="tm-textlink" to="/account">
        Back to the overview <ArrowRight size={16} strokeWidth={1.6} />
      </Link>
    </Empty>
  );
}
