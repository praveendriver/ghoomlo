# India-wide trip planner — discovery notes

This is a working evidence log. Early notes are directional and must not be generalized to all travelers without more research.

## Signal 001 — cross-site trip planning

**Source:** One traveler’s account of their own planning behavior, shared in this product discovery conversation.  
**Evidence strength:** Qualitative, self-reported, N=1. The specific trip, dates, route, household, and actual time spent were not captured.

### Recent trip walkthrough seed

The traveler’s most recent planned trip was Goa in October (year not specified). The first task they tackled was choosing dates, checking school dates, office meetings, and flight prices together. Date feasibility and fare comparison were intertwined from the start, rather than strictly sequential.

After finding a workable date range, they booked flights and a hotel. For the Goa hotel, they prioritized a five-star Bonvoy property to earn points and qualifying nights, plus a beachfront location because that matched this trip’s goal; they paid cash. For flights, they accepted a reasonable fare at a civil departure time, avoiding very early mornings and late nights. The exact booking order is still unclear. The beachfront requirement is trip-specific and may differ by destination.

### What they do

They move between multiple services to research and make decisions:

- Google Flights and Skyscanner for air options/prices.
- Agoda, Marriott Bonvoy, Air India, and other loyalty sites for lodging, fares, and whether points can cover a trip.
- Google Maps to inspect vicinity, photos, and driving times.
- Visa and baggage requirement research when relevant.
- Weather checks to decide what clothing to bring.
- Rental car versus cab comparison, weighing price, speed, and convenience.
- YouTube and Instagram to preview destinations and places visually and read/watch reviews.

### Friction and desired outcome

- Research is fragmented across providers and content formats.
- In at least one case, booking happened later than desired because dates were uncertain and work got busy; the traveler missed the chance to book earlier.
- They worry that prices can rise sharply while they are delayed.
- For price hunting, their hardest parts are choosing when to book, keeping cost from getting too high, and finding the lowest-cost option.
- For flight and hotel price timing, they want all four signals: recent price history, target-price alerts, flexible-date price grids, and guidance that a price is unusually high/low. They are judging flight or hotel cost, not whole-trip cost.
- For notifications, they prefer an alert on every observed price drop, with the watch checking once a day. Batching preference remains open.
- They want a way to judge whether to book, compare cash with available points, and understand transport trade-offs.
- They use points to save money and check award-seat or room availability directly in provider apps/sites (for example, Bonvoy, Air India, and Qatar Airways).
- For a cash-versus-points decision, their stated comparison is points required versus cash saved.
- They identified prices, videos, maps, and visa research as the areas that usually take the longest or most often change their decision.
- When asked to distinguish time spent from decision impact, they named price research and videos as the leading pair; the split between the two and a specific example are still unclear.
- They watch many travel videos to form an aggregated view, identify themes multiple vloggers repeat, and decide whether a destination is the right one for them. This synthesis takes time today.
- They watch videos after choosing a destination, so the video workflow is currently post-destination selection; the specific within-destination decisions they validate still need clarification.
- They want disagreements surfaced. Across videos, they assess food and shopping-product quality, route duration, visual appearance/recognition cues, whether they would enjoy being there, the creator’s expressed reaction, and whether the creator’s taste resembles theirs.
- They judge creator similarity from overlap between places/experiences the creator chooses and places/experiences they have chosen in the past; that overlap suggests shared values to them.
- A few days of date flexibility can work inside a viable window, but school days and important work commitments are hard constraints. Pending commitments such as visa resolution can keep dates uncertain.

### Product hypotheses to test

1. Travelers value a single trip workspace that connects destination research to bookable options and practical trip details.
2. Comparing cash and loyalty redemptions is a meaningful part of trip selection for a subset of travelers; a simple points-needed versus cash-saved comparison may be more useful than a complicated points valuation.
3. Travelers who use points view them as a way to reduce trip cost, and want award availability confirmed by the program/provider before relying on the comparison.
4. Date planning should separate hard blocked dates (school and important work) from movable dates, and represent external dependencies such as pending visas. Price watches should only monitor viable exact or flexible-date windows.
5. Price watches are useful when they report current price with clear timestamp and provider coverage, and help a busy traveler return to a decision at the right time.
6. A useful price experience must help compare lowest-cost comparable options and judge affordability, not only display a list sorted by price; timing signals need to be validated.
7. Recent history and high/low labels can inform timing only when enough comparable, permissioned data exists; show the date range and coverage and distinguish historical context from a forecast.
8. Travelers may want help deciding earlier, but a “buy now / wait” prediction is not justified without evidence and validated model performance.
9. Visual creator content is useful for expectation setting, but its source, date, sponsorship, and relevance to the traveler’s constraints need to be clear.
10. Bringing price, video, map, and visa information into one trip context may save effort or improve decisions; the product should connect them to a specific trip/date/place rather than show an unstructured content feed.
11. After a destination is chosen, a traceable synthesis of recurring themes across multiple creators may help select places/activities within it if it shows how many independent sources support each theme and includes disagreements/drawbacks rather than presenting consensus as objective truth.
12. Past choices may help a traveler decide which creators share their taste; this should be user-controlled, explainable preference matching based on shared choices, not appearance-based inference.

### Follow-up questions

- What specifically held them back from booking earlier, and what information would have made them comfortable booking earlier? **Answered:** dates were uncertain and work got busy; they missed booking earlier. They did not identify a specific missing price signal as the cause.
- What caused date uncertainty, and how flexible could the dates realistically be? **Answered:** a few days of flexibility is usually possible inside viable windows, but not across school days or important work commitments; other commitments, including visa resolution, may leave dates uncertain.
- When comparing cash and points, what makes a redemption worthwhile and how do they verify award availability? **Answered:** points are for saving money; award seats/rooms are checked directly in provider apps/sites such as Bonvoy, Air India, and Qatar Airways.
- When both cash and points are available, what do they compare? **Answered:** points needed and cash saved.
- Across the research steps, which usually takes longest or most often changes the trip decision? **Answered:** prices, videos, maps, and visa research.
- Of prices, videos, maps, and visa research, which takes the most time versus most changes a decision? **Partial answer:** price research and videos are the leading pair; their relative time/decision impact and a specific example are still unclear.
- What is hardest about price comparison? **Answered:** choosing timing, keeping the cost from getting too high, and finding the lowest cost.
- What price signals would help with timing, and is the target a flight/hotel price or whole-trip cost? **Answered:** all of recent price history, target alerts, flexible-date grids, and high/low context; their target is flight or hotel cost.
- What alert behavior and check frequency would they prefer? **Answered:** notify on every observed price drop and check once daily; batching preference remains open.
- When looking at travel videos, what they want to learn/verify and what makes the search take time. **Answered:** they watch many videos to get an aggregated view, notice repeated themes and disagreements, assess food/shopping quality, route times, visual recognition, personal appeal, and the creator’s expressed reaction.
- What makes a vlogger’s taste feel similar? **Answered:** they have chosen similar places or experiences in the past, which suggests shared values.
- Do they watch videos before choosing the destination or after? **Answered:** after choosing a destination.
- What was the most recent trip and first planning task? **Answered:** Goa in October; dates were the first task.
- How did they settle on the Goa dates and what constraints did they check? **Answered:** school dates, office meetings, and flight prices.
- After the Goa dates were chosen, what did they do next? **Asked; answer pending.**
- How did they compare/select the Goa flight and hotel, and which did they book first? **Answered in part:** hotel preference was five-star, Bonvoy earning points/qualifying nights, beachfront; flight preference was acceptable fare and avoiding very early/late times. Booking order remains unclear.
- For the Goa Bonvoy stay, did they pay cash, redeem points, or compare both? **Answered:** paid cash.
- Did they compare the Bonvoy cash rate with other booking sites or choose Bonvoy directly for the loyalty benefits? **Asked; answer pending.**
- Which trip decisions did they make themselves versus with other travelers?
- How did they compare total cash cost, loyalty points, cancellation terms, and convenience?
- What made a source trustworthy enough to act on, especially for prices, entry rules, baggage, and dietary claims?
- Which step consumed the most time, and which step most often changed their decision?

## Research cautions

- This account is one person’s workflow, not proof of broad Indian traveler behavior.
- The exact use of each provider and its role in search versus booking may vary by trip and market.
- Provider integrations, award availability, price-history access, and monitoring rights require independent validation.

