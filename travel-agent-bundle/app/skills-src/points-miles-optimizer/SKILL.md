---
name: points-miles-optimizer
description: For a flight route + dates, computes the best award-redemption options across the user's airline programs (Star Alliance + OneWorld) and credit-card transfer partners (Amex MR, HDFC SmartBuy, Axis Magnus, ICICI Emeralde, Marriott Bonvoy). Surfaces sweet-spot programs, transfer ratios, and cash-vs-points break-even. Use when shortlisting flights for a trip, especially long-haul or premium cabin.
icon: ticket
color: Yellow
related_server_ids:
  - gsheets
---

# Points & Miles Optimizer

## When to Use

Activate when:
- Evaluating a specific flight option (origin → destination, date range)
- The user asks "should I pay or redeem points for this?"
- [[plan-vacation]] Phase 4 (always after [[travel-deals-finder]] returns top 3)

Do NOT activate for:
- Deciding the destination
- Hotel points (use [[hotel-cash-vs-points]])

## Required Inputs

1. `origin`, `destination` (IATA preferred)
2. `depart_date`, `return_date`
3. `cabin` (economy / PE / business — default economy headline)
4. `pax` (default: 4 for the family)
5. Cash price baseline from [[travel-deals-finder]] (used for break-even math)

User loyalty inventory: read `.workspace/loyalty.md`. If missing, ask once and persist:
- Airline programs the user actively earns/redeems in
- Credit cards held + current point balances
- Marriott Bonvoy balance (transferable to airlines)

## Workflow

```
Points Optimizer Progress:
- [ ] Step 1: Identify operating + marketing carriers
- [ ] Step 2: Map redemption programs (alliance + partner)
- [ ] Step 3: Look up award chart prices
- [ ] Step 4: Map transfer paths from user's credit-card points
- [ ] Step 5: Compute cash-vs-points break-even
- [ ] Step 6: Recommend top 1-2 paths
```

### Step 1: Identify Carriers

`web_search`: `flights {origin} to {destination} {depart_date} airlines operating`. Capture **operating carrier** (the metal) and **alliance** (Star, OneWorld, SkyTeam).

### Step 2: Map Redemption Programs

For each operating carrier, list every program that can redeem on that metal:
- Same-airline program (often expensive)
- Alliance partners (often cheaper sweet spots)
- Non-alliance partners (e.g., Alaska on Cathay; Aer Lingus on AA)

Reference: `references/sweet_spots.md` for the highest-value redemption patterns from India.

### Step 3: Award Chart Prices

`web_search`: `{program name} award chart {origin region} to {destination region} {cabin}`. Also try the program's own redemption calculator URL.

For dynamic-pricing programs (Delta, United partly, Air India dynamic), `web_search` for current sample redemption costs.

Capture per program:
- Miles required (per pax, per direction or round-trip)
- Surcharges in INR (BA charges YQ heavily; AA much less)
- Availability indicator (search via aa.com / united.com / qatarairways.com depending on program)

### Step 4: Transfer Paths

For each candidate program, check if the user can top up via transfer:

| Source | Common transfers | Typical ratio | Notes |
|---|---|---|---|
| Amex MR (India) | Air India, Marriott Bonvoy, KrisFlyer (sometimes) | Varies; check current promos | Promotions often add 20-30% |
| HDFC SmartBuy (Infinia/Diners) | Direct booking via SmartBuy + airline partner programs | Variable | Strong for paid + portal redemption |
| Axis Magnus | Marriott Bonvoy, multiple airlines via Edge | Varies | Recent program changes — verify ratios |
| ICICI Emeralde | iShop and direct partners | Variable | |
| Marriott Bonvoy | 40+ airlines at 3:1, +5K bonus per 60K | 3:1 → 60K becomes 25K miles | Sweet spot for 60K transfers |

`web_search` to confirm current ratios — these change.

### Step 5: Cash-vs-Points Break-Even

For each candidate path:

```
cash_total       = cash price × pax (from travel-deals-finder)
points_total     = miles per pax × pax
surcharge_total  = INR surcharge per pax × pax
cents_per_point  = (cash_total - surcharge_total) / (points_total / 100)
```

Decision rule:
- Economy: redeem if value ≥ ₹0.50 per mile (≈ 0.6 cpm)
- Premium economy: ≥ ₹0.80 per mile
- Business: ≥ ₹1.20 per mile
- First: ≥ ₹2.00 per mile

Also flag if the points cost would deplete >40% of the user's relevant balance — ask before recommending.

### Step 6: Recommend

Output 1-2 paths. For each:

```
Path: {airline cabin} via {program} (transferred from {source})
- Miles needed: {N} per pax × {pax} = {total}
- Source balance: {user balance} ({transfer plan if needed})
- Surcharges: ₹{X} total
- Equivalent cents-per-mile: ₹{Y}
- Cash alternative: ₹{Z}
- Verdict: REDEEM / PAY / SPLIT (e.g., 2 award + 2 cash)
```

Append the recommendation to the trip's row in the Travel Deals Tracker (columns `Award Option`, `Award Source Program`, `Award Total Miles`, `Award Surcharge ₹`, `Recommended Path`).

## Failure Modes & Guardrails

- **Award space unavailable**: never recommend redemption without confirming live availability. If unverified, label "needs availability check".
- **Surcharge trap**: BA / Lufthansa / Air India can have YQ surcharges that wipe out value. Always include surcharges in the math.
- **Stale ratios**: transfer ratios and chart prices change. Verify with current-month searches; don't trust last year's blog post.
- **Don't recommend draining a balance** for marginal value (<10% better than cash) — preserve points for high-value redemptions (long-haul biz/first).
- **Ratio promotions**: if a transfer bonus is currently live, surface it; otherwise compute at base ratio.

## Triggering Modes

- **Per-route**: invoked once per shortlisted flight option.
- **Bulk**: when comparing 3 routes from [[travel-deals-finder]], run sequentially and summarize the best across all routes.

See `references/sweet_spots.md` for known high-value redemption patterns from India.
