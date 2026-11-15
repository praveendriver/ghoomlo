# Scoring Worked Examples

Two illustrative runs to clarify the scoring rubric in `SKILL.md`.

## Example 1 — Travel window: April 2026

Wishlist (5 rows): Tokyo (priority), Lisbon, Udaipur, Bali, Vienna
Visit history (last 12 months): Bali (Dec 2025) → **excluded**

External sources surfaced:
- Conde Nast April picks: Tokyo, Lisbon, Seville, Kyoto
- TripAdvisor April: Tokyo, Amsterdam, Charleston
- Weather/shoulder season: Lisbon, Seville, Vienna, Udaipur
- Events: Tokyo (cherry blossoms), Udaipur (Mewar Festival mid-April)

Scoring:

| Candidate | Wishlist | Priority | Weather | Event | Editorial | Recency | Total |
|---|---|---|---|---|---|---|---|
| Tokyo | +4 | +2 | 0 | +2 | +2 (CNT+TA) | 0 | **10** |
| Lisbon | +4 | 0 | +3 | 0 | +1 (CNT) | 0 | **8** |
| Udaipur | +4 | 0 | +3 | +2 | 0 | 0 | **9** |
| Vienna | +4 | 0 | +3 | 0 | 0 | 0 | **7** |
| Seville | 0 | 0 | +3 | 0 | +1 | 0 | **4** |

Top 3: **Tokyo (10), Udaipur (9), Lisbon (8)** — natural domestic + international mix.

## Example 2 — Travel window: October 2026

Wishlist (3 rows): Munich, Maldives, Coorg
Visit history (last 12 months): Coorg (May 2026) → **excluded**

External sources:
- CNT October: Munich, Kyoto, Cape Town
- TripAdvisor October: Munich, New England
- Weather: Maldives (post-monsoon), Cape Town (spring), Kyoto (autumn)
- Events: Munich (Oktoberfest until early Oct), Kyoto (Jidai Matsuri)

Scoring:

| Candidate | Wishlist | Priority | Weather | Event | Editorial | Recency | Total |
|---|---|---|---|---|---|---|---|
| Munich | +4 | 0 | 0 | +2 | +2 | 0 | **8** |
| Maldives | +4 | 0 | +3 | 0 | 0 | 0 | **7** |
| Kyoto | 0 | 0 | +3 | +2 | +1 | 0 | **6** |
| Cape Town | 0 | 0 | +3 | 0 | +1 | 0 | **4** |

Top 3: **Munich, Maldives, Kyoto** — wishlist drives 2 picks, Kyoto fills the gap left by Coorg's exclusion.

## Edge Case — Wishlist Fully Excluded

If every wishlist entry was visited in the last 12 months, fall back entirely to external sources scored on weather + events + editorial. Tell the user explicitly:
> "All wishlist destinations were visited in the last 12 months. Returning external picks only."
