# 5-Star Hotel Brand Allowlist

Order of preference: **Marriott first, Hilton fallback**. Both must be 5-star (luxury or upper-upscale tier). Lower-tier brands (Courtyard, Fairfield, Hampton, Hilton Garden Inn, etc.) are **excluded**.

## Marriott Bonvoy — Eligible 5-Star Brands

Tier 1 (Luxury):
- The Ritz-Carlton
- St. Regis
- The Luxury Collection
- W Hotels
- JW Marriott
- Edition

Tier 2 (Premium / Upper Upscale — accept if 5-star rated):
- Marriott Hotels
- Le Méridien
- Westin
- Renaissance
- Sheraton (5-star only)
- Autograph Collection
- Tribute Portfolio (5-star only)
- Delta Hotels (5-star only)
- Gaylord Hotels

**Exclude**: Courtyard, Four Points, SpringHill Suites, Fairfield, AC Hotels, Aloft, Moxy, Residence Inn, TownePlace Suites, Element, Protea.

## Hilton Honors — Eligible 5-Star Brands

Tier 1 (Luxury):
- Waldorf Astoria
- Conrad
- LXR Hotels & Resorts
- Signia by Hilton

Tier 2 (Premium — accept if 5-star rated):
- Hilton Hotels & Resorts (5-star property only)
- Curio Collection (5-star only)

**Exclude**: DoubleTree, Embassy Suites, Hilton Garden Inn, Hampton, Tru, Home2 Suites, Homewood Suites, Tapestry, Spark, Motto.

## Brand Verification Tips

When `web_search` returns a property name, verify the brand by:
1. Checking the hotel's official website domain (e.g. `ritzcarlton.com`, `waldorfastoria3.hilton.com`).
2. Searching `{property name} Marriott Bonvoy` or `{property name} Hilton Honors` to confirm chain affiliation.
3. If a property is only "5-star" by tourism board rating but not a Marriott/Hilton brand, exclude it.

## Loyalty Program Notes (for email body)

- Marriott Bonvoy: members earn ~10 base points per USD spent, plus elite tier bonuses.
- Hilton Honors: members earn 10 base points per USD spent, plus elite tier bonuses.
- Both chains run frequent point-promotions — mention in email if `web_search` surfaces an active promo.
