# Long Weekend Patterns — Worked Examples

All examples assume Mon-Fri work week, Sat-Sun off, Bangalore base.

## Pattern A — Holiday on Friday (0 PTO, 4 days)

Holiday: Independence Day, Fri 15 Aug 2025
- Thu 14 Aug (eve): depart
- Fri 15 Aug: holiday — at destination
- Sat 16 Aug: at destination
- Sun 17 Aug: travel home

Output:
```
depart: 2025-08-14
return: 2025-08-17
nights: 3
length_days: 4
pto_days: 0
rationale: "Independence Day (Fri 15 Aug) — natural long weekend. Depart Thu evening."
```

## Pattern B — Holiday on Monday (0 PTO, 4 days)

Holiday: Republic Day, Mon 26 Jan 2026
- Fri 23 Jan (eve): depart
- Sat-Sun-Mon at destination
- Mon 26 Jan: holiday
- Tue 27 Jan: back at work

Output:
```
depart: 2026-01-23
return: 2026-01-26
nights: 3
length_days: 4
pto_days: 0
rationale: "Republic Day (Mon 26 Jan) — long weekend with no PTO needed."
```

## Pattern C — Holiday on Tuesday (1 PTO, 5 days)

Holiday: Tuesday X
- Fri (eve): depart
- Sat, Sun at destination
- Mon: take PTO (bridge)
- Tue: holiday
- Tue eve / Wed morning: return

Output:
```
nights: 4
length_days: 5
pto_days: 1
rationale: "Holiday on Tue — bridge Mon with 1 PTO day. Depart Fri evening."
```

## Pattern D — Holiday on Thursday (1 PTO, 4 days)

Holiday: Thursday X
- Wed (eve): depart
- Thu: holiday
- Fri: take PTO (bridge)
- Sat-Sun: at destination, return Sun

Output:
```
nights: 3
length_days: 4
pto_days: 1
rationale: "Holiday on Thu — bridge Fri with 1 PTO. Depart Wed evening."
```

## Pattern E — Holiday on Wednesday (avoid unless special)

Wednesday holidays are awkward — needs 2 PTO for either direction. Generally skip unless paired with a school break or another close holiday.

## Pattern F — Two Holidays Close Together

Example: Diwali period — Tue holiday + Thu holiday with school break in between
- Take Mon, Wed, Fri PTO → 9 days off for 3 PTO days
- Excellent value — score this highly even with higher PTO cost

## Pattern G — School Break Aligned (5-7 days)

School winter break: Mon 22 Dec 2025 → Fri 2 Jan 2026
- Christmas (Thu 25 Dec): holiday
- New Year (Thu 1 Jan 2026): holiday

Sample 7-day window:
```
depart: 2025-12-25
return: 2025-12-31
nights: 6
length_days: 7
pto_days: 3 (Mon-Tue-Wed if not flexible)
rationale: "School winter break + Christmas. Family-friendly 7-day window."
```

## Departure Timing Rule

When a holiday starts on day X, **depart on the evening of X−1** so the holiday is fully usable. The booking system uses X−1 as the departure date (with an evening flight).

Exception: if X−1 is a working day before noon, prefer X−1 evening flight; do not require taking X−1 as PTO.

## PTO Optimization Heuristic

Rank by **(trip_length_days / pto_days_required)**:
- 4 days / 0 PTO = ∞ (best)
- 5 days / 1 PTO = 5.0
- 9 days / 3 PTO = 3.0
- 4 days / 1 PTO = 4.0
- Avoid: 4 days / 2 PTO = 2.0
