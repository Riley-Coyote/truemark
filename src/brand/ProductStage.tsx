import type { CSSProperties } from "react";
import { assetUrl } from "../assetUrl";
import type { Product } from "../data";
import { productCutout } from "../shop/catalog";
import { FrontMist, glassMask, RoomFocus, RoomLoop, roomMedia } from "./Rooms";
import type { Box, Room, Seat } from "./Rooms";
import "./stage.css";

/**
 * A lot's vial on its plinth, beside its certificate on Verify. The photograph carries the plinth and the
 * vial's contact shadow (baked by scripts/stage-vials.py); the page stands the real cut-out on it.
 */
export function ProductPlinth({ product }: { product: Product }) {
  return (
    <div className="tm-pstage">
      <img
        className="tm-pstage-scene"
        src={assetUrl("images/scenes/product-stage.webp")}
        srcSet={`${assetUrl("images/scenes/product-stage-sm.webp")} 600w, ${assetUrl("images/scenes/product-stage.webp")} 900w`}
        sizes="(max-width: 960px) 92vw, 46vw"
        alt=""
        draggable={false}
      />
      <div className="tm-pstage-vial">
        <img
          className="is-active"
          src={productCutout(product, "lg")}
          srcSet={`${productCutout(product, "sm")} 289w, ${productCutout(product, "lg")} 578w`}
          sizes="(max-width: 960px) 36vw, 18vw"
          alt={`${product.name}, ${product.size} research vial`}
          draggable={false}
          data-vial={product.id}
        />
      </div>
    </div>
  );
}

/**
 * The product in the collection's room: the same room the opening shows, its loop, its floor mist and its light, the
 * camera close on one of its pedestals (pages/Product.tsx frames it), with the supplied cutout standing on that
 * pedestal where its seat says, its contact shadow and its long soft cast, as on the opening. The lens is focused on
 * that pedestal: the room around it is soft (RoomFocus), the pedestal and the vial sharp. Only the vial is ever this
 * page's own; the room's loop and mist are the room's, lent to whichever page shows it (share.ts). Choosing a size
 * swaps only the vial.
 *
 * This plate is the layer the opening's camera move brings in (flight.ts): the camera pushes into the opening's own
 * plate until it frames the room exactly as this one does, then hands the room over, so nothing on screen changes.
 */
export function ProductStage({
  items,
  index,
  prev,
  box,
  seat,
  room,
  pedestal,
  focus,
  zoom,
  still,
  arrived,
}: {
  items: Product[];
  index: number;
  prev: number;
  /** Where the plate stands in its scene; null until the scene has been measured. */
  box: Box | null;
  seat: Seat;
  room: Room;
  /** The pedestal the vial stands on, as the room's mist and focus number them. */
  pedestal: number;
  /** The focus's blur, in the plate's own pixels. */
  focus: number;
  /** How much closer than the opening this frames the room. */
  zoom: number;
  /** Reduced motion: the room's first frame, held still. */
  still: boolean;
  /** The vial came with the camera: it is already standing, without its own entrance. */
  arrived: boolean;
}) {
  const active = items[index];
  const vialStyle = {
    "--seat-x": seat.x,
    "--seat-y": seat.y,
    "--vial-h": seat.h,
    "--tm-glass-mask": active ? glassMask(productCutout(active, "lg")) : undefined,
  } as CSSProperties;
  return (
    <div className="tm-proom-plate" style={box ?? { visibility: "hidden" }} data-pedestal={pedestal}>
      <div className="tm-proom-room">
        {/* The loop's first frame, under the loop while it loads. */}
        <img className="tm-room tm-proom-still" src={roomMedia(room).poster} alt="" aria-hidden="true" draggable={false} fetchPriority="high" />
        <RoomLoop room={room} still={still} />
        <FrontMist still={still} room={room} zoom={zoom} />
        <RoomFocus room={room} pedestal={pedestal} blur={focus} />
      </div>
      <figure className="tm-proom-vial" style={vialStyle} data-arrived={arrived ? "" : undefined}>
        {/* Where the vial meets its pedestal, up close: the room's own shade, soft and wide, so the crisp cut-out sits on
            the softened pedestal. Its own layer, under the vial; the vial is never filtered. */}
        <span className="tm-proom-contact" aria-hidden="true" />
        <span className="tm-room-vial-shadow" aria-hidden="true" />
        <span className="tm-room-vial-cast" aria-hidden="true" />
        <div className="tm-proom-glass">
          {items.map((product, i) => (
            <img
              key={product.id}
              className={i === index ? "is-active" : i === prev ? "is-prev" : undefined}
              src={productCutout(product, "lg")}
              alt={i === index ? `${product.name}, ${product.size} research vial` : ""}
              aria-hidden={i === index ? undefined : true}
              loading={i === index ? "eager" : "lazy"}
              fetchPriority={i === index ? "high" : undefined}
              draggable={false}
              data-vial={product.id}
            />
          ))}
          <span className="tm-room-vial-air" aria-hidden="true" />
        </div>
      </figure>
    </div>
  );
}
