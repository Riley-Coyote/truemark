import { useRef } from "react";
import { MistOpening } from "../brand/MistOpening";
import { BuyingWithUs, ClassIndex, PaperTrail } from "../brand/HomeSections";
import { useAfterFlight } from "../brand/FlightViews";
import { WallLight } from "../brand/WallLight";
import { Procession } from "../brand/Procession";
import { useReveal } from "./motion";

/**
 * The client's home page in four movements, each with one job: the opening and its closer look (who we
 * are, two ways in, and one vial followed to its certificate), the catalog (what we sell), the paper
 * trail (that lot's path to release, and the way to check yours), and buying with us (who can buy, and
 * the questions that remain). When the camera pulls back out of a product to the opening, the three
 * below it follow once it has settled (src/brand/flight.ts).
 */
export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const rest = useAfterFlight();
  useReveal(root);
  return (
    <div className="tm-home" ref={root}>
      <MistOpening />
      {rest && (
        <>
          <WallLight />
          {import.meta.env.DEV && new URLSearchParams(window.location.search).get("collection") === "study" ? <ClassIndex /> : <Procession />}
          <PaperTrail />
          <BuyingWithUs />
        </>
      )}
    </div>
  );
}
