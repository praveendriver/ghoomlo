# URL Templates & IATA Tips

All URLs assume origin = **BLR (Bangalore — Kempegowda Intl)**, 1 adult.

> **API-first flow**: prefer `scripts/api/amadeus_flights.py` and `scripts/api/amadeus_hotels.py` for actual prices. These URLs are kept as fallback search links and as click-throughs in the email digest so the user can verify or book directly.

## Flight Search URLs

### Google Flights (most reliable for sharing)
```
https://www.google.com/travel/flights?q=Flights%20to%20{DEST_CITY}%20from%20Bangalore%20on%20{DEP_DATE}%20through%20{RET_DATE}
```
- `{DEP_DATE}` and `{RET_DATE}` use `YYYY-MM-DD` in the query string (URL-encode spaces as `%20`).
- Example: `Flights to Goa from Bangalore on 2026-06-12 through 2026-06-15`

### Skyscanner India
```
https://www.skyscanner.co.in/transport/flights/blr/{DEST_IATA}/{YYMMDD_DEP}/{YYMMDD_RET}/?adults=1&cabinclass=economy
```
- IATA must be **lowercase** in the path.
- Date format is `YYMMDD` (e.g., `260612` for 12 June 2026).
- Swap `cabinclass=economy` to `premiumeconomy` or `business` for other classes.

### MakeMyTrip (fallback)
```
https://www.makemytrip.com/flight/search?itinerary=BLR-{DEST_IATA}-{DD/MM/YYYY_DEP},{DEST_IATA}-BLR-{DD/MM/YYYY_RET}&tripType=R&paxType=A-1_C-0_I-0&intl=true&cabinClass=E
```

## Common IATA Codes from BLR Demand

| City | IATA |
|---|---|
| Goa (Dabolim) | GOI |
| Goa (Mopa) | GOX |
| Delhi | DEL |
| Mumbai | BOM |
| Kolkata | CCU |
| Hyderabad | HYD |
| Chennai | MAA |
| Jaipur | JAI |
| Udaipur | UDR |
| Kochi | COK |
| Srinagar | SXR |
| Leh | IXL |
| Port Blair | IXZ |
| Dubai | DXB |
| Singapore | SIN |
| Bangkok (BKK) | BKK |
| Phuket | HKT |
| Bali (Denpasar) | DPS |
| Kuala Lumpur | KUL |
| Hong Kong | HKG |
| Tokyo (Narita) | NRT |
| Maldives (Malé) | MLE |
| Colombo | CMB |
| Kathmandu | KTM |
| Istanbul | IST |
| London | LHR |
| Paris | CDG |
| Zurich | ZRH |

If a destination is not listed, use `web_search`: `{city} airport IATA code`.

## Date Format Helpers

| Use | Format | Example |
|---|---|---|
| Google Flights query | `YYYY-MM-DD` | `2026-06-12` |
| Skyscanner path | `YYMMDD` | `260612` |
| MakeMyTrip | `DD/MM/YYYY` | `12/06/2026` |
| Marriott / Hilton | `YYYY-MM-DD` | `2026-06-12` |
| Sheet display | `DD MMM YYYY` | `12 Jun 2026` |
