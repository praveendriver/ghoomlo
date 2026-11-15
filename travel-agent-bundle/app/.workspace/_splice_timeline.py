#!/usr/bin/env python3
"""Splice the new 16-day (Jul 10-25) timeline into index.html, replacing the old 11-day block."""
import re, sys

PATH = "trips/2026-07-tokyo-koyoto-and-other-famous/index.html"
with open(PATH, encoding="utf-8") as f:
    html = f.read()

NEW = r"""        <!-- DAY 1 — Fri Jul 10 -->
        <details class="day" open>
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-plane"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Fri · Jul 10</div>
                <div class="day-title">BLR → NRT · overnight flight</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Travel</span>
                <span class="day-tag">Sleep on board</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">Evening</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-plane"/></svg></div>
              <div class="row-content">
                <span class="row-title">BLR → NRT</span> — evening departure, sleep on the plane. See Door-to-door for the full leg breakdown. Pre-order Asian Vegetarian Meal (AVML) for all 4.
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 2 — Sat Jul 11 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-bed"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Sat · Jul 11</div>
                <div class="day-title">Arrive Tokyo · JW Marriott check-in · easy first day</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Arrival</span>
                <span class="day-tag">Jet-lag easy</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">PM</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-car"/></svg></div>
              <div class="row-content">
                <span class="row-title">NRT → JW Marriott Tokyo</span> — Narita Express / pre-booked van to the hotel. <strong>These 2 nights (Jul 11–13) are self-paid on Bonvoy points — same property as the office stay, so it's one seamless 10-night reservation with no mid-trip move.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.marriott.com/en-us/hotels/tyojw-jw-marriott-hotel-tokyo/overview/" target="_blank"><svg class="icon"><use href="#i-bed"/></svg> JW Marriott Tokyo</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="FamilyMart" data-rest-city="Tokyo">
              <div class="row-time">Evening</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Konbini dinner — FamilyMart / 7-Eleven crawl</span> — kids' first taste of Japan: tamago sando, melon pan, edamame onigiri, matcha mochi. Easy, vegetarian-safe, jet-lag friendly. Featured 6× in the dump.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/FamilyMart+near+JW+Marriott+Tokyo" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Konbini nearby</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 3 — Sun Jul 12 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-landmark"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Sun · Jul 12</div>
                <div class="day-title">Asakusa + Skytree · East Tokyo cluster</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Heritage</span>
                <span class="day-tag">Kid-magnet view</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">09:30</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Senso-ji Temple + Nakamise-dori, Asakusa</span> — Tokyo's oldest temple (645 AD), the Kaminarimon thunder gate is the iconic photo. Free. <strong>3× in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Senso-ji+Temple+Asakusa" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Map</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Komaki Shokudo" data-rest-city="Tokyo">
              <div class="row-time">12:30</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · Komaki Shokudo (Asakusa)</span> — pure-veg shojin ryori, daily teishoku. Kid-easy.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Komaki+Shokudo+Asakusa" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">15:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Tokyo Skytree</span> — 634m deck, world's tallest free-standing tower. Pre-book skip-the-line. <strong>3× in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.tokyo-skytree.jp/en/ticket/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Skytree tickets</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="T's TanTan" data-rest-city="Tokyo">
              <div class="row-time">19:00</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Dinner · T's TanTan (Tokyo Station Keiyo St.)</span> — world-famous vegan ramen; pure-veg, kid-friendly, fast.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/T's+Tantan+Tokyo+Station" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 4 — Mon Jul 13 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-shopping-bag"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Mon · Jul 13</div>
                <div class="day-title">Shibuya + Harajuku + sneaker/fashion crawl · West cluster</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Office stay begins</span>
                <span class="day-tag">Sunset Shibuya Sky</span>
                <span class="day-tag">Shopping</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">All days</div>
              <div class="row-icon"><svg class="icon"><use href="#i-key"/></svg></div>
              <div class="row-content">
                <span class="row-title">Office hotel window: Jul 13 → 21 (8 nights, free) at JW Marriott Tokyo</span> — same room, no move. Titanium perks (breakfast, lounge, 4pm checkout) run the full 10 nights Jul 11–21.
              </div>
            </div>
            <div class="row">
              <div class="row-time">09:00</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Meiji Shrine + Yoyogi Park</span> — cool morning forest walk before the heat. 100,000 donated trees. Free.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Meiji+Shrine+Yoyogi" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Map</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">11:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-shopping-bag"/></svg></div>
              <div class="row-content">
                <span class="row-title">Takeshita Street + Angel Harajuku Crepes</span> — kawaii heart of Harajuku. Crepes are vegetarian (banana-Nutella, strawberry-cream). <strong>Takeshita 2× in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Takeshita+Street+Harajuku" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Map</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">12:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-shopping-bag"/></svg></div>
              <div class="row-content">
                <span class="row-title">Sneaker + fashion crawl · Harajuku → Omotesando → Cat Street → Shibuya</span> — the single biggest thread in your dump (~15 shopping screenshots). Hit <strong>Onitsuka Tiger</strong> (Omotesando "Nippon Made" flagship, 3× in dump) + <strong>Nike Mind</strong> concept store (4×), the <strong>Cat Street</strong> boutiques, then in Shibuya: <strong>Loft</strong>, <strong>Hands</strong>, <strong>Shibuya Parco</strong> (Nintendo/Pokémon floor), <strong>WEGO / ABC-Mart</strong>. Save Uniqlo / GU / MUJI flagships for the Ginza errand if time runs short.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Onitsuka+Tiger+Omotesando" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Onitsuka Tiger</a>
                  <a class="chip" href="https://www.google.com/maps/search/Nike+Harajuku" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Nike</a>
                  <a class="chip" href="https://www.google.com/maps/search/Cat+Street+Harajuku" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Cat Street</a>
                  <a class="chip" href="https://www.google.com/maps/search/Shibuya+Parco" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Shibuya Parco</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="AIN SOPH.Ripple" data-rest-city="Tokyo">
              <div class="row-time">13:30</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · AIN SOPH.Ripple Shinjuku</span> — vegan Japanese curry + matcha desserts. Book ahead (small, popular).
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/AIN+SOPH+Ripple+Shinjuku" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">17:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Shibuya Crossing + Hachiko, then Shibuya Sky · sunset slot</span> — the busiest scramble on earth + the 230m open-air rooftop, the most-mentioned place in your dump (<strong>15×</strong>). <em>Pre-book the sunset slot 2 weeks ahead — sells out.</em>
                <div class="link-chips">
                  <a class="chip" href="https://www.shibuya-scramble-square.com/sky/en/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Shibuya Sky</a>
                  <a class="chip" href="https://www.klook.com/activity/57723-shibuya-sky-tickets/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Klook · MAHIRSLENS</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 5 — Tue Jul 14 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-sparkles"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Tue · Jul 14</div>
                <div class="day-title">teamLab Planets + Odaiba · Bay cluster</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Top kid pick</span>
                <span class="day-tag">Pre-book required</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">10:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-sparkles"/></svg></div>
              <div class="row-content">
                <span class="row-title">teamLab Planets, Toyosu</span> — immersive digital-art water-walk. #1 activity in your dump (<strong>12×</strong>). 90 min, all ages, transformative for the 6yo.
                <div style="font-size:12px; color: var(--saffron); margin-top:6px; font-weight:600;">
                  ⚠ Book the morning slot now — 2-3 week lead time is normal.
                </div>
                <div class="link-chips">
                  <a class="chip" href="https://www.teamlab.art/e/planets/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Official site</a>
                  <a class="chip" href="https://www.klook.com/activity/57723-teamlab-planets-tokyo/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Klook</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Saishoku Kenbi" data-rest-city="Tokyo">
              <div class="row-time">12:30</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · Saishoku Kenbi (Toyosu)</span> — pure-veg natural-foods cafe, walking distance from teamLab.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Saishoku+Kenbi+Toyosu" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">14:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Odaiba — DiverCity Gundam, Statue of Liberty viewpoint, Aqua City</span> — life-size Gundam transforms hourly; Rainbow Bridge view at dusk. <strong>4× in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/DiverCity+Tokyo+Plaza+Gundam" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> DiverCity</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 6 — Wed Jul 15 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-leaf"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Wed · Jul 15</div>
                <div class="day-title">Easy Tokyo · Ueno (rest before workshop)</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Soft day</span>
                <span class="day-tag">Indoor / AC</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">10:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-leaf"/></svg></div>
              <div class="row-content">
                <span class="row-title">Ueno Park + Ueno Zoo (pandas)</span> — deliberately easy day so Malhar is fresh for the workshop tomorrow. Pair with an AC museum (National Museum / National Museum of Nature & Science). <strong>Ueno in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Ueno+Park+Zoo" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Ueno Park</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">15:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-shopping-bag"/></svg></div>
              <div class="row-content">
                <span class="row-title">Optional · Akihabara</span> — gachapon, retro games, anime stores. <strong>7× in dump.</strong> Light afternoon add only if energy holds.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Akihabara+Electric+Town" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Map</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">Evening</div>
              <div class="row-icon"><svg class="icon"><use href="#i-bed"/></svg></div>
              <div class="row-content">
                <span class="row-title">Relaxed dinner near JW · Malhar preps for workshop</span> — early night.
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 7 — Thu Jul 16 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-sparkles"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Thu · Jul 16</div>
                <div class="day-title">Workshop (Malhar at work) · family solo day — DisneySea</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Work pin</span>
                <span class="day-tag">Family solo</span>
                <span class="day-tag">Booking-critical</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">All day</div>
              <div class="row-icon"><svg class="icon"><use href="#i-briefcase"/></svg></div>
              <div class="row-content">
                <span class="row-title">Malhar · work workshop in Tokyo</span> — the fixed anchor the whole trip is built around. Family does a fully self-contained day, zero logistics needed from Malhar; rejoin for dinner.
              </div>
            </div>
            <div class="row">
              <div class="row-time">09:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-sparkles"/></svg></div>
              <div class="row-content">
                <span class="row-title">Tokyo DisneySea (family)</span> — single dated ticket, easy in/out, full family day. <strong>Ghibli Museum is sold out (tickets unavailable), so DisneySea is the locked plan, not a backup.</strong>
                <div style="font-size:12px; color: var(--saffron); margin-top:6px; font-weight:600;">
                  ⚠ Book dated tickets NOW via the official Tokyo Disney Resort app — July is peak and dates sell out.
                </div>
                <div class="link-chips">
                  <a class="chip" href="https://www.tokyodisneyresort.jp/en/tds/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Tokyo DisneySea</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 8 — Fri Jul 17 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-mountain"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Fri · Jul 17</div>
                <div class="day-title">Day trip · Mt Fuji + Lake Kawaguchiko</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Day trip from Tokyo</span>
                <span class="day-tag">Weather-led</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">08:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-mountain"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lake Kawaguchiko · Mt Fuji views</span> — Fuji's clearest lake-side panorama. <strong>Mt Fuji day tour 7× + Kawaguchiko 3× in dump.</strong> ~2.5h each way — go on a clear-forecast morning (swap with Jul 18 if the forecast is better that day).
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Lake+Kawaguchiko" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Kawaguchiko</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">11:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Oshino Hakkai springs + Chureito Pagoda viewpoint</span> — the postcard Fuji-with-pagoda shot (Arakurayama Sengen). <strong>Chureito Pagoda in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Chureito+Pagoda" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Chureito Pagoda</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Hoto Fudo" data-rest-city="Fujikawaguchiko">
              <div class="row-time">13:00</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · Hoto Fudo (veg-adapt) or lakeside konbini picnic</span> — confirm a veg broth for hoto noodles, or do a bakery/konbini picnic by the lake.
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 9 — Sat Jul 18 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-landmark"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Sat · Jul 18</div>
                <div class="day-title">Day trip · Kamakura (easy, ~1h)</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Day trip from Tokyo</span>
                <span class="day-tag">Light pace</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">09:30</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Great Buddha (Kotoku-in) + Hase-dera</span> — the 13m bronze Daibutsu and the hillside temple with sea views. <strong>Kamakura 9× in dump.</strong> Easier than Fuji/Hakone — good weekend pace.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Kotoku-in+Great+Buddha+Kamakura" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Great Buddha</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">12:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-shopping-bag"/></svg></div>
              <div class="row-content">
                <span class="row-title">Komachi-dori snack street + Enoden line</span> — souvenir + street-snack lane; the seaside Enoden tram is a kid hit. Optional beach stop.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Komachi-dori+Kamakura" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Komachi-dori</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 10 — Sun Jul 19 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-mountain"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Sun · Jul 19</div>
                <div class="day-title">Day trip · Hakone loop (or Tokyo flex if tired)</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Day trip from Tokyo</span>
                <span class="day-tag">Long but high-reward</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">08:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-mountain"/></svg></div>
              <div class="row-content">
                <span class="row-title">Hakone Round Tour</span> — Hakone-Yumoto → Tozan railway → Gora → Sounzan ropeway → Owakudani sulfur valley (black eggs) → Lake Ashi pirate ship → Hakone Shrine lake torii. Day-trip version (no ryokan night, per your call). Use the Hakone Free Pass.
                <div style="font-size:13px; color: rgba(246,241,232,0.65); margin-top:4px;">
                  If energy is low, swap this for a relaxed Tokyo day — Shinjuku Gyoen + shopping.
                </div>
                <div class="link-chips">
                  <a class="chip" href="https://www.odakyu.jp/english/passes/hakone/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Hakone Free Pass</a>
                  <a class="chip" href="https://www.google.com/maps/search/Hakone+Owakudani" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Owakudani</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Bakery and Table Hakone" data-rest-city="Hakone">
              <div class="row-time">12:30</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · Bakery &amp; Table Hakone (Lake Ashi)</span> — lakeside bakery + cafe with foot-onsen seating. Veg sandwiches + pastries.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Bakery+and+Table+Hakone" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 11 — Mon Jul 20 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-package"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Mon · Jul 20</div>
                <div class="day-title">Tokyo flex + repack · forward bags to Kyoto</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Buffer day</span>
                <span class="day-tag">Bags forwarded</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">Morning</div>
              <div class="row-icon"><svg class="icon"><use href="#i-shopping-bag"/></svg></div>
              <div class="row-content">
                <span class="row-title">Soft buffer — last Tokyo wishes</span> — options: <strong>Pokémon Center Mega Tokyo</strong> (Ikebukuro), <strong>Shinjuku Gyoen</strong>, <strong>Ginza</strong> (Uniqlo / GU / MUJI flagships), or any rained-out item from the week.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Pokemon+Center+Mega+Tokyo" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Pokémon Center</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">15:00</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-package"/></svg></div>
              <div class="row-content">
                <span class="row-title">Yamato Transport · forward 2 big bags Tokyo → Kyoto hotel</span> — JW concierge ships them overnight (~₹1,200 each, arrives next day). Family carries day packs on the train.
                <div class="link-chips">
                  <a class="chip" href="https://www.global-yamato.com/en/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Yamato</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 12 — Tue Jul 21 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-train"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Tue · Jul 21</div>
                <div class="day-title">Tokyo → Kyoto · Shinkansen + check-in</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Transit</span>
                <span class="day-tag">40K cert applied</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">09:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-bed"/></svg></div>
              <div class="row-content">
                <span class="row-title">Last JW breakfast + checkout</span> — end of the 10-night Tokyo base.
              </div>
            </div>
            <div class="row">
              <div class="row-time">12:00</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-train"/></svg></div>
              <div class="row-content">
                <span class="row-title">Shinkansen Nozomi Tokyo → Kyoto (2h 15m)</span> — reserved seats; family of 4 ≈ ₹37k. Right side for the Mt Fuji view ~40 min in.
                <div class="link-chips">
                  <a class="chip" href="https://smart-ex.jp/en/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Smart-EX</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">16:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-bed"/></svg></div>
              <div class="row-content">
                <span class="row-title">Check in Westin Miyako Kyoto</span> — Bonvoy Cat 5. <strong>Apply the 40K free-night cert (expires Dec 2026) to one night + points for the rest.</strong> Quiet hilltop, family rooms.
                <div class="link-chips">
                  <a class="chip" href="https://www.marriott.com/hotels/travel/osamd-the-westin-miyako-kyoto/" target="_blank"><svg class="icon"><use href="#i-bed"/></svg> Westin Miyako</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Mumokuteki Cafe" data-rest-city="Kyoto">
              <div class="row-time">19:00</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Dinner · Mumokuteki Cafe (Teramachi)</span> — pure-vegan multi-cuisine, near the Pontocho riverside stroll.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Mumokuteki+Cafe+Kyoto" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Maps</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 13 — Wed Jul 22 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-sunrise"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Wed · Jul 22</div>
                <div class="day-title">Fushimi Inari (sunrise) + Higashiyama walk</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Start at 5:30am</span>
                <span class="day-tag">Heat-aware</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">05:30</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Fushimi Inari Taisha · 10,000 torii sunrise</span> — beat heat + crowds. Climb to Yotsutsuji viewpoint (40 min one-way), descend. Free. <strong>In dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Fushimi+Inari+Taisha" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Map</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">10:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Brunch · Inariya at the foot of Inari hill</span> — inari sushi (sweet tofu pouches, vegetarian).
              </div>
            </div>
            <div class="row">
              <div class="row-time">14:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-train"/></svg></div>
              <div class="row-content">
                <span class="row-title">Kyoto Railway Museum (cool indoor PM)</span> — kid-magnet; SL steam train + Shinkansen simulators. Or swap for the Higashiyama walk below.
                <div class="link-chips">
                  <a class="chip" href="https://www.kyotorailwaymuseum.jp/en/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Museum site</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Cafe Veg Out" data-rest-city="Kyoto">
              <div class="row-time">17:00</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Higashiyama walk · Kiyomizu-dera → Sannenzaka → Yasaka Pagoda → Maruyama Park</span> — golden-hour photo walk through old Kyoto. <strong>Kiyomizu-dera + Yasaka Pagoda in dump.</strong> Dinner at Cafe Veg Out (vegan).
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Kiyomizu-dera" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Kiyomizu-dera</a>
                </div>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 14 — Thu Jul 23 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-train"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Thu · Jul 23</div>
                <div class="day-title">Arashiyama · Sagano train + Hozugawa boat + bamboo</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Top kid-magic</span>
                <span class="day-tag">Pre-book combo</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">09:30</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-train"/></svg></div>
              <div class="row-content">
                <span class="row-title">Sagano Romantic Train · Saga-Arashiyama → Kameoka</span> — open-side scenic train through the Hozugawa canyon. <strong>4× in dump.</strong> Book 2 weeks ahead.
                <div class="link-chips">
                  <a class="chip" href="https://www.sagano-kanko.co.jp/en/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Sagano site</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">11:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Hozugawa River Boat · Kameoka → Arashiyama (2h downstream)</span> — traditional wooden boats; kids 6+ allowed with an adult. <strong>5× in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.hozugawakudari.jp/en" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Hozugawa site</a>
                </div>
              </div>
            </div>
            <div class="row" data-rest-name="Shigetsu" data-rest-city="Kyoto">
              <div class="row-time">13:30</div>
              <div class="row-icon food"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Lunch · Shigetsu shojin ryori (inside Tenryu-ji)</span> — multi-course Buddhist temple cuisine, all-vegan. Book the day before via the temple.
                <div class="link-chips">
                  <a class="chip" href="http://www.tenryuji.com/en/shigetsu/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Shigetsu</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">15:30</div>
              <div class="row-icon"><svg class="icon"><use href="#i-leaf"/></svg></div>
              <div class="row-content">
                <span class="row-title">Arashiyama Bamboo Grove + Iwatayama Monkey Park</span> — iconic 10-min bamboo path; monkey park is a moderate climb (the 6yo can do it slowly), ~150 wild macaques. <strong>Bamboo Grove + Arashiyama in dump.</strong>
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Arashiyama+Bamboo+Grove" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Bamboo</a>
                  <a class="chip" href="https://www.google.com/maps/search/Iwatayama+Monkey+Park" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Monkey Park</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">19:00</div>
              <div class="row-icon"><svg class="icon"><use href="#i-camera"/></svg></div>
              <div class="row-content">
                <span class="row-title">Evening Gion stroll</span> — Hanamikoji + Shirakawa canal. <strong>Gion in dump.</strong>
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 15 — Fri Jul 24 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-landmark"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Fri · Jul 24</div>
                <div class="day-title">Nara day trip OR north Kyoto (kid choice)</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Flex final day</span>
                <span class="day-tag">Now feasible</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">09:00</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Option A · Nara (~45 min)</span> — bowing deer in Nara Park + Todai-ji Great Buddha. <strong>Nara Park deer in dump.</strong> The longer Jul 10–25 window finally makes this fit (the old 10-day plan had to cut it).
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Nara+Park+deer" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Nara Park</a>
                  <a class="chip" href="https://www.google.com/maps/search/Todai-ji" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Todai-ji</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">09:00</div>
              <div class="row-icon temple"><svg class="icon"><use href="#i-landmark"/></svg></div>
              <div class="row-content">
                <span class="row-title">Option B · North Kyoto</span> — Kinkaku-ji golden pavilion + Ryoan-ji zen garden + Nishiki Market veg snacks. <strong>Kinkaku-ji + Ginkaku-ji in dump.</strong> Lower-travel alternative if everyone's templed-out on trains.
                <div class="link-chips">
                  <a class="chip" href="https://www.google.com/maps/search/Kinkaku-ji" target="_blank"><svg class="icon"><use href="#i-pin"/></svg> Kinkaku-ji</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">Evening</div>
              <div class="row-icon"><svg class="icon"><use href="#i-utensils"/></svg></div>
              <div class="row-content">
                <span class="row-title">Last-night dinner + pack</span> — early night before the KIX morning.
              </div>
            </div>
          </div>
        </details>

        <!-- DAY 16 — Sat Jul 25 -->
        <details class="day">
          <summary>
            <span class="day-marker"><svg class="icon"><use href="#i-plane"/></svg></span>
            <div class="day-head">
              <div>
                <div class="day-date">Sat · Jul 25</div>
                <div class="day-title">Kyoto → KIX → BLR · departure</div>
              </div>
              <div class="day-tags">
                <span class="day-tag">Travel</span>
                <span class="day-tag">No backtrack</span>
              </div>
            </div>
            <span class="chev"><svg class="icon icon-sm"><use href="#i-arrow-right"/></svg></span>
          </summary>
          <div class="day-body">
            <div class="row">
              <div class="row-time">Morning</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-train"/></svg></div>
              <div class="row-content">
                <span class="row-title">Kyoto → Kansai Airport (KIX)</span> — Haruka express (~75 min). Ending the trip in Kyoto means no 2h15 Shinkansen backtrack to Tokyo. Light bags only.
                <div class="link-chips">
                  <a class="chip" href="https://www.westjr.co.jp/global/en/ticket/pass/haruka/" target="_blank"><svg class="icon"><use href="#i-arrow-up-right"/></svg> Haruka express</a>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row-time">Afternoon</div>
              <div class="row-icon transit"><svg class="icon"><use href="#i-plane"/></svg></div>
              <div class="row-content">
                <span class="row-title">KIX → BLR</span> — open-jaw return (arrived NRT, departing KIX). See Door-to-door for the full leg.
              </div>
            </div>
          </div>
        </details>
"""

# Replace from "<!-- DAY 1" up to and including the last "</details>" before the timeline-closing </div>
start = html.index("        <!-- DAY 1 ")
# find the closing of the timeline div that follows the last day card
end_marker = "\n      </div>\n    </div>\n\n    </div><!-- /.with-map__main -->"
end = html.index(end_marker)
# end currently points at the "\n      </div>" that closes .timeline; keep that.
html = html[:start] + NEW + "\n" + html[end+1:]

with open(PATH, "w", encoding="utf-8") as f:
    f.write(html)
print("Timeline spliced. New length:", len(html))
