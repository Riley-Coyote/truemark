import { storageKey } from "../../platform/mode";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Referral } from "../../platform/types";
import { read, worldNow } from "../../platform/storage";
import { crossedAchievements } from "../momentum";

type Achievement = { id: string; title: string };

/** Only live sales can cross a threshold here; existing history never announces a celebration. */
export function Celebrate({
  partnerId,
  referrals,
  arrivals,
  goal,
}: {
  partnerId: string;
  referrals: Referral[] | undefined;
  arrivals: string[];
  goal: number;
}) {
  const processed = useRef(new Set<string>());
  const remembered = useRef(new Set<string>());
  const [banners, setBanners] = useState<Achievement[]>([]);
  useEffect(() => {
    if (!referrals) return;
    const pending = arrivals.filter(
      (id) => !processed.current.has(id) && referrals.some((r) => r.id === id),
    );
    if (!pending.length) return;
    let before = referrals.filter((r) => !pending.includes(r.id));
    const key = storageKey(`tm-preview-partner-celebrations-${partnerId}`);
    const stored = read<unknown>(key, []);
    const seen = new Set([
      ...remembered.current,
      ...(Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === "string")
        : []),
    ]);
    const fresh: Achievement[] = [];
    for (const id of pending) {
      const sale = referrals.find((r) => r.id === id)!;
      const after = [...before, sale];
      for (const achievement of crossedAchievements(
        before,
        after,
        goal,
        worldNow(),
      )) {
        if (seen.has(achievement.id)) continue;
        seen.add(achievement.id);
        fresh.push(achievement);
      }
      processed.current.add(id);
      before = after;
    }
    remembered.current = seen;
    if (fresh.length) {
      // Persist on presentation, not just dismissal. A reload must not replay a milestone.
      try {
        localStorage.setItem(key, JSON.stringify([...seen]));
      } catch {
        /* Session memory still deduplicates. */
      }
      setBanners((list) => [...list, ...fresh]);
    }
  }, [partnerId, referrals, arrivals, goal]);

  return (
    <>
      <p className="kit-sr" role="status" aria-live="polite" aria-atomic="true">
        {banners.map((b) => b.title).join(". ")}
      </p>
      {banners.length > 0 && (
        <section
          className="pp-celebrate kit-span-12"
          aria-label="Your achievement"
        >
          <span className="pp-celebrate-light" aria-hidden="true" />
          <span className="pp-celebrate-dot" aria-hidden="true" />
          <div>
            {banners.map((b) => (
              <p key={b.id} data-achievement={b.id}>
                {b.title}
              </p>
            ))}
          </div>
          <button
            type="button"
            className="kit-iconbutton"
            aria-label="Dismiss celebration"
            onClick={() => setBanners([])}
          >
            <X aria-hidden="true" />
          </button>
        </section>
      )}
    </>
  );
}
