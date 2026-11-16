import { randomUUID } from "node:crypto";
import { addDays } from "@/lib/dates";
import type { LatLng } from "@/lib/geo";
import locations from "@/lib/idea-locations.json";
import type { Itinerary, ItineraryItem } from "@/lib/itinerary/schema";

type Time = ItineraryItem["timeOfDay"];
type Kind = ItineraryItem["kind"];
type IdeaItem = Omit<ItineraryItem, "id">;

export type Idea = {
  slug: string;
  destination: string;
  title: string;
  tagline: string;
  /** Background colour of the card; there are no photos yet. */
  tone: string;
  summary: string;
  days: { title: string; items: IdeaItem[] }[];
  thingsToVerify: { topic: string; why: string }[];
};

/** Sample plans carry no prices: we have no checked source for them. */
function it(
  timeOfDay: Time,
  kind: Kind,
  title: string,
  description: string,
  extra: { place?: string; minutes?: number; check?: string[]; fit?: string } = {},
): IdeaItem {
  return {
    timeOfDay,
    kind,
    title,
    description,
    placeName: extra.place ?? null,
    estimatedCostInr: null,
    durationMinutes: extra.minutes ?? null,
    fitNote: extra.fit ?? "",
    checkBeforeYouGo: extra.check ?? [],
  };
}

const RAW_IDEAS: Idea[] = [
  {
    slug: "goa-easy-beach-break",
    destination: "Goa",
    title: "4 easy days in Goa",
    tagline: "Beaches, a fort, and old Portuguese streets",
    tone: "#2f6f7a",
    summary:
      "A slow beach break based in North Goa, with one morning at a fort and one day for the churches of Old Goa and the lanes of Panaji.",
    days: [
      {
        title: "Arrive and settle in",
        items: [
          it("afternoon", "rest", "Check in and unwind", "Keep the first afternoon free after the journey."),
          it("evening", "activity", "Sunset on the nearest beach", "Walk down to the beach closest to where you are staying for the evening."),
        ],
      },
      {
        title: "Fort and North Goa beaches",
        items: [
          it("morning", "activity", "Fort Aguada", "A seventeenth-century Portuguese fort and lighthouse above the sea. Go early, before the heat.", {
            place: "Fort Aguada",
            minutes: 90,
            check: ["Opening hours and whether the lighthouse area is open"],
          }),
          it("midday", "meal", "Lunch at a beach shack", "Pick a shack on the beach you are visiting. Ask how dishes are prepared if you avoid seafood, egg, or meat.", {
            check: ["Shacks are seasonal and many close during the monsoon"],
          }),
          it("afternoon", "activity", "Beach time at Candolim", "A long, wide beach a short drive from the fort.", {
            place: "Candolim Beach",
            minutes: 150,
            check: ["Lifeguard flags and whether swimming is allowed that day"],
          }),
          it("evening", "rest", "Quiet evening", "Dinner near where you are staying."),
        ],
      },
      {
        title: "Old Goa and Panaji",
        items: [
          it("morning", "activity", "Basilica of Bom Jesus", "The best-known of Old Goa's churches. Dress modestly.", {
            place: "Basilica of Bom Jesus",
            minutes: 60,
            check: ["Visiting hours, which change around services"],
          }),
          it("morning", "activity", "Se Cathedral", "A large cathedral a short walk from the basilica.", { place: "Se Cathedral, Old Goa", minutes: 45 }),
          it("midday", "meal", "Lunch in Panaji", "Panaji has a wide range of Goan and other Indian restaurants."),
          it("afternoon", "activity", "Walk through Fontainhas", "Panaji's old Latin Quarter: narrow lanes and brightly painted houses. People live here, so keep noise down.", {
            place: "Fontainhas, Panaji",
            minutes: 90,
          }),
        ],
      },
      {
        title: "Slow morning and departure",
        items: [
          it("morning", "rest", "Last walk on the beach", "Keep the morning light and leave plenty of time for the airport."),
          it("midday", "travel", "Leave for the airport or station", "Goa has two airports, so confirm which one your flight uses.", {
            check: ["Which airport your flight leaves from, and the drive time from your hotel"],
          }),
        ],
      },
    ],
    thingsToVerify: [
      { topic: "Season", why: "During the monsoon, roughly June to September, many beach shacks close and sea swimming is often unsafe." },
      { topic: "Airport", why: "Goa has two airports, at Dabolim and at Mopa. They are far apart." },
      { topic: "Local transport", why: "Taxi fares and self-drive rental rules vary; agree a fare before you set off." },
    ],
  },
  {
    slug: "udaipur-lakes-and-palaces",
    destination: "Udaipur",
    title: "3 days in Udaipur",
    tagline: "Lakes, palaces, and old-city lanes",
    tone: "#8a5a3c",
    summary: "A short heritage break around Lake Pichola, with the City Palace as the main visit and unhurried evenings by the water.",
    days: [
      {
        title: "Arrive, then the lake at sunset",
        items: [
          it("afternoon", "rest", "Check in and rest", "Old-city lanes are narrow, so your vehicle may have to stop a short walk from the hotel.", {
            check: ["Ask your hotel where vehicles can drop you"],
          }),
          it("evening", "activity", "Boat ride on Lake Pichola", "A boat ride gives the classic view of the palaces from the water.", {
            place: "Lake Pichola",
            minutes: 60,
            check: ["Boat timings, tickets, and where rides depart from"],
          }),
        ],
      },
      {
        title: "City Palace and the old city",
        items: [
          it("morning", "activity", "City Palace", "A large palace complex and museum above the lake. Expect a lot of walking and stairs.", {
            place: "City Palace, Udaipur",
            minutes: 150,
            check: ["Opening hours and ticket types"],
            fit: "Many stairs and uneven floors; ask about step-free routes if anyone needs them.",
          }),
          it("morning", "activity", "Jagdish Temple", "A carved temple a short walk from the palace gate.", { place: "Jagdish Temple", minutes: 30 }),
          it("midday", "meal", "Lunch in the old city", "Many rooftop restaurants here serve Rajasthani vegetarian food."),
          it("afternoon", "activity", "Saheliyon ki Bari", "A shaded garden with fountains; an easy stop for children and seniors.", {
            place: "Saheliyon ki Bari",
            minutes: 60,
          }),
          it("evening", "activity", "Sunset at Ambrai Ghat", "A lakeside ghat facing the City Palace.", { place: "Ambrai Ghat", minutes: 45 }),
        ],
      },
      {
        title: "Hilltop view and departure",
        items: [
          it("morning", "activity", "Sajjangarh (Monsoon Palace)", "A hilltop palace with wide views over the city and lakes.", {
            place: "Sajjangarh Monsoon Palace",
            minutes: 120,
            check: ["Entry timings and how vehicles are allowed up the hill"],
          }),
          it("midday", "travel", "Leave for the airport or station", "Allow extra time; the airport is well outside the city."),
        ],
      },
    ],
    thingsToVerify: [
      { topic: "Heat", why: "April to June is very hot; plan outdoor visits for early morning and evening." },
      { topic: "Hotel access", why: "Many old-city hotels cannot be reached by car and involve stairs." },
    ],
  },
  {
    slug: "jaipur-forts-and-bazaars",
    destination: "Jaipur",
    title: "3 days in Jaipur",
    tagline: "Forts, the walled city, and bazaars",
    tone: "#b0563f",
    summary: "The main sights of Jaipur at a steady pace: Amber Fort on one morning, the walled-city monuments on another.",
    days: [
      {
        title: "Arrive and a first look at the walled city",
        items: [
          it("afternoon", "rest", "Check in and rest", "Keep the first afternoon easy."),
          it("evening", "activity", "Hawa Mahal and Johari Bazaar", "See the Hawa Mahal façade from the street, then walk the bazaar nearby.", {
            place: "Hawa Mahal",
            minutes: 90,
          }),
        ],
      },
      {
        title: "Amber Fort and a sunset view",
        items: [
          it("morning", "activity", "Amber Fort", "A large hill fort just outside the city. Start early to avoid heat and crowds.", {
            place: "Amber Fort",
            minutes: 180,
            check: ["Opening hours, tickets, and how you will get up the hill"],
            fit: "The climb is steep; ask about vehicle access if anyone cannot manage it.",
          }),
          it("midday", "activity", "Jal Mahal from the lakeside", "A palace in the middle of a lake, seen from the roadside promenade on the way back.", {
            place: "Jal Mahal",
            minutes: 20,
          }),
          it("afternoon", "rest", "Rest at the hotel", "A break through the hottest part of the day."),
          it("evening", "activity", "Sunset at Nahargarh Fort", "A fort on the ridge above the city with a wide view.", {
            place: "Nahargarh Fort",
            minutes: 90,
            check: ["Closing time and the road up"],
          }),
        ],
      },
      {
        title: "City Palace, Jantar Mantar, and departure",
        items: [
          it("morning", "activity", "City Palace", "The royal palace complex and museum in the walled city.", {
            place: "City Palace, Jaipur",
            minutes: 120,
            check: ["Ticket types and which areas each covers"],
          }),
          it("morning", "activity", "Jantar Mantar", "An eighteenth-century observatory of large stone instruments, next to the palace.", {
            place: "Jantar Mantar, Jaipur",
            minutes: 60,
          }),
          it("midday", "meal", "Lunch before leaving", "Rajasthani thalis are widely available near the walled city."),
          it("afternoon", "travel", "Leave for the airport or station", "Allow for traffic around the walled city."),
        ],
      },
    ],
    thingsToVerify: [
      { topic: "Tickets", why: "Combined tickets covering several monuments have been offered; check the current official options." },
      { topic: "Heat", why: "April to June is very hot; keep midday free." },
    ],
  },
  {
    slug: "kerala-hills-and-backwaters",
    destination: "Kerala",
    title: "5 days through Kerala",
    tagline: "Fort Kochi, tea hills, and backwaters",
    tone: "#3d6b4a",
    summary: "A loop from Kochi up to the tea country of Munnar and down to the backwaters at Alappuzha. Two of the five days are mostly driving.",
    days: [
      {
        title: "Arrive in Kochi",
        items: [
          it("afternoon", "activity", "Walk around Fort Kochi", "The old waterfront quarter, including the Chinese fishing nets and St. Francis Church.", {
            place: "Fort Kochi",
            minutes: 120,
          }),
          it("evening", "meal", "Dinner in Fort Kochi", "Kerala cooking uses a lot of coconut and seafood; vegetarian meals are easy to find."),
        ],
      },
      {
        title: "Drive to Munnar",
        items: [
          it("morning", "travel", "Kochi to Munnar by road", "A long, winding hill drive. Plan stops if anyone gets car-sick.", {
            minutes: 270,
            check: ["Road conditions, especially in the monsoon"],
          }),
          it("evening", "rest", "Settle in", "Evenings in the hills are cool; carry a warm layer."),
        ],
      },
      {
        title: "Munnar's tea country",
        items: [
          it("morning", "activity", "Eravikulam National Park", "A high grassland park, home to the Nilgiri tahr.", {
            place: "Eravikulam National Park",
            minutes: 180,
            check: ["The park closes for some weeks each year; check dates and ticket booking"],
          }),
          it("afternoon", "activity", "Tea Museum", "A small museum on how tea is grown and processed.", {
            place: "Tea Museum, Munnar",
            minutes: 60,
            check: ["Opening days"],
          }),
          it("afternoon", "activity", "Mattupetty Dam", "A reservoir among tea estates a short drive from town.", { place: "Mattupetty Dam", minutes: 60 }),
        ],
      },
      {
        title: "Down to the backwaters",
        items: [
          it("morning", "travel", "Munnar to Alappuzha by road", "Another long drive, back down to the coast.", { minutes: 270 }),
          it("afternoon", "activity", "Backwater boat ride", "See the canals and paddy fields from a small boat or a houseboat.", {
            place: "Alappuzha backwaters",
            minutes: 150,
            check: ["Book with a licensed operator and ask about life jackets"],
          }),
        ],
      },
      {
        title: "Beach morning and departure",
        items: [
          it("morning", "activity", "Alappuzha Beach", "A quiet walk before the drive back.", { place: "Alappuzha Beach", minutes: 60 }),
          it("midday", "travel", "Drive to Kochi airport", "Leave a generous buffer for traffic.", { minutes: 150 }),
        ],
      },
    ],
    thingsToVerify: [
      { topic: "Monsoon", why: "June to August brings heavy rain; hill roads to Munnar can be disrupted." },
      { topic: "Eravikulam closure", why: "The park shuts for a period each year, usually early in the year." },
      { topic: "Driving time", why: "Two days are mostly on the road. Drop Munnar or the backwaters if that is too much for your group." },
    ],
  },
  {
    slug: "ladakh-leh-and-nubra",
    destination: "Ladakh",
    title: "6 days in Ladakh",
    tagline: "Leh, monasteries, and the Nubra Valley",
    tone: "#4a5a7a",
    summary:
      "A high-altitude trip built around acclimatisation: a full rest day on arrival, two gentle days around Leh, then an overnight trip to Nubra.",
    days: [
      {
        title: "Arrive in Leh and rest",
        items: [
          it("morning", "rest", "Complete rest", "Leh is at high altitude. Rest, drink water, and do nothing strenuous today.", {
            fit: "Not generally advised for infants or for people with heart or lung conditions without medical advice.",
            check: ["Speak to a doctor about altitude before you book"],
          }),
        ],
      },
      {
        title: "Gentle day in Leh",
        items: [
          it("morning", "activity", "Leh Palace", "A former royal palace overlooking the old town.", { place: "Leh Palace", minutes: 60 }),
          it("afternoon", "activity", "Leh market", "An easy walk through the main bazaar.", { place: "Leh Main Bazaar", minutes: 60 }),
          it("evening", "activity", "Shanti Stupa", "A hilltop stupa with a view over Leh. Drive up rather than climb the steps.", {
            place: "Shanti Stupa",
            minutes: 60,
          }),
        ],
      },
      {
        title: "Monasteries of the Indus valley",
        items: [
          it("morning", "activity", "Thiksey Monastery", "A large hillside monastery east of Leh.", {
            place: "Thiksey Monastery",
            minutes: 90,
            fit: "Many steps at altitude; go slowly.",
          }),
          it("midday", "activity", "Shey Palace", "A ruined palace and monastery on the same road.", { place: "Shey Palace", minutes: 45 }),
          it("afternoon", "activity", "Hemis Monastery", "One of the largest monasteries in Ladakh, in a side valley.", {
            place: "Hemis Monastery",
            minutes: 90,
          }),
        ],
      },
      {
        title: "Over Khardung La to Nubra",
        items: [
          it("morning", "travel", "Leh to Nubra Valley", "A long mountain drive over the Khardung La pass. Do not linger at the top.", {
            minutes: 300,
            check: ["Whether the pass is open", "Current permit or fee rules for Nubra"],
          }),
          it("afternoon", "activity", "Diskit Monastery", "A monastery above the valley with a large Buddha statue nearby.", {
            place: "Diskit Monastery",
            minutes: 60,
          }),
          it("evening", "activity", "Hunder sand dunes", "High-altitude dunes beside the river.", { place: "Hunder", minutes: 60 }),
        ],
      },
      {
        title: "Return to Leh",
        items: [
          it("morning", "travel", "Nubra Valley to Leh", "The same road back over the pass.", { minutes: 300 }),
          it("evening", "rest", "Rest in Leh", "An easy evening before the flight."),
        ],
      },
      {
        title: "Departure",
        items: [
          it("morning", "travel", "Leave for Leh airport", "Flights depend on mountain weather and can be delayed or cancelled.", {
            check: ["Flight status on the day"],
          }),
        ],
      },
    ],
    thingsToVerify: [
      { topic: "Altitude", why: "Altitude sickness can be serious. Get medical advice, especially for children, seniors, and anyone with a heart or lung condition." },
      { topic: "Permits and fees", why: "Rules for visiting Nubra have changed over the years; confirm the current requirement with the Leh district administration." },
      { topic: "Season and roads", why: "Passes close in winter and after heavy snow; the main season is roughly May to September." },
      { topic: "Buffer day", why: "Weather can ground flights, so avoid fixed commitments straight after your return." },
    ],
  },
];

// Coordinates come from scripts/geocode-ideas.ts; places it could not find have no pin.
const LOCATIONS: Record<string, Record<string, LatLng>> = locations;

export const IDEAS: Idea[] = RAW_IDEAS.map((idea) => ({
  ...idea,
  days: idea.days.map((day) => ({
    ...day,
    items: day.items.map((item) => ({
      ...item,
      location: (item.placeName && LOCATIONS[idea.slug]?.[item.placeName]) || null,
    })),
  })),
}));

export function findIdea(slug: string): Idea | undefined {
  return IDEAS.find((i) => i.slug === slug);
}

/** A dated, editable copy of a sample plan for one traveller's trip. */
export function ideaToItinerary(idea: Idea, startDate: string): Itinerary {
  return {
    summary: idea.summary,
    thingsToVerify: idea.thingsToVerify,
    assumptions: ["This is a general sample plan. It was not written for your household's food, access, or pace needs."],
    days: idea.days.map((day, i) => ({
      dayNumber: i + 1,
      date: addDays(startDate, i),
      title: day.title,
      items: day.items.map((item) => ({ ...item, id: randomUUID() })),
    })),
  };
}

/** Model label stored on plans copied from a sample rather than drafted by AI. */
export const SAMPLE_MODEL = "sample";
