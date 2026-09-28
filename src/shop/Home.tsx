import { useRef } from "react";
import { HeroShelf } from "../brand/HeroShelf";
import { Classes, PaperTrail, Questions, Verification, WhoWeSupply } from "../brand/HomeSections";
import { useReveal } from "./motion";

/** The client's home page, in the client's order: hero and trust row, one lot's paper trail,
 *  the catalog by class, verification, who we supply, and common questions. */
export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div className="tm-home" ref={root}>
      <HeroShelf />
      <PaperTrail />
      <Classes />
      <Verification />
      <WhoWeSupply />
      <Questions />
    </div>
  );
}
