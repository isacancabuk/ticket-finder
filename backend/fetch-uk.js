import axios from "axios";

const headersMap = {
  "User-Agent": "Mozilla/5.0 ...",
  Accept: "application/json",
  Referer: "https://www.ticketmaster.co.uk/",
  Cookie:
    "SID=SQku2zzJkRG07uGvu6vOZNSgRwzzrbbapy4lErj5IKOm1qHrPROzjcP0WJl0FYLYtl7b8Ex-8NajoOo5; BID=4wItg-l6hqxDYhlebiOYZ1rxIDKtDhUwtBzPh1sXk9NQKZAkXqwv-Bs5yyAq8Ghkr_pQA5PuCrnBdSLE;",
};

const headersFacets = {
  "User-Agent": "Mozilla/5.0 ...",
  Accept: "application/json",
  Referer: "https://www.ticketmaster.co.uk/",
  Cookie:
    "language=en-gb; BID=aigXRIKtoDssj0kuCXKcKI7d4LM2m6VHhus8lrOu_dMpIAVKBE7a9sW4RaQ_xulf6fsDu1bCcI9tFtQg; sticky=DBDA; SID=UzTE8V_TNE8tP48JF7vEHp-D_TBwiS4eeVnMWkhE02f7L4WMdM1lQNykYFqEK7LFL1td5duc8eUMwiO_; NDMA=601; TMUO=east_UOdfnquKd1IpEXsWJDiuYxdZAA5Sl8Y0BowRdjfxRKA=; tmpt=0:f8b2302b71000000:1761755636590:bbd09178:c459b881e5aab0d1c6be53503cb7d943:7b042871ed7d2f1a70ac1ccb1ff876b5f34652435af5c85af4c36886e169f756",
};

export async function getShapeBySection(sectionName, eventId) {
  try {
    const url = `https://mapsapi.tmol.co/maps/geometry/3/event/${eventId}/placeDetailNoKeys?useHostGrids=true&app=PRD1741_ICCP-FE`;
    const res = await axios.get(url, { headers: headersMap });
    const data = res.data;
    const segments = data.pages?.[0]?.segments || [];
    const match = segments.find((seg) => seg.name === sectionName);
    return match ? match.id : null;
  } catch (err) {
    console.error("UK PlaceDetail Error:", err.message);
    return null;
  }
}

export async function checkAvailabilityUK(shapeId, eventId) {
  try {
    const url = `https://services.ticketmaster.co.uk/api/ismds/host/${eventId}/facets?q=available&oq=&by=shape+tickettypes+attributes+available+accessibility+offer+placeGroups+inventoryType+offerType+description&show=places&apikey=b462oi7fic6pehcdkzony5bxhe&apisecret=pquzpfrfz7zd2ylvtz3w5dtyse&compress=places`;
    const res = await axios.get(url, { headers: headersFacets });
    const data = res.data;
    return data.facets.some((f) => f.shapes.includes(shapeId));
  } catch (err) {
    console.error("UK Facets Error:", err.message);
    return false;
  }
}
