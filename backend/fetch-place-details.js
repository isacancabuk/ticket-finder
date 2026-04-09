// fetch-place-details.js
import axios from "axios";

const url =
  "https://mapsapi.tmol.co/maps/geometry/3/event/36006341A9A08473/placeDetailNoKeys?systemId=HOST_UK&useHostGrids=true&app=PRD1741_ICCP-FE";

const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.co.uk/",
  Origin: "https://www.ticketmaster.co.uk",
  Cookie:
    "SID=qFqHisZ7JuJklIdLaRkKQwXxfYb2sDyftO47kvLffu8xk...; BID=nkk0Pl5tWSBYpIKRZLFZjfdGjMPWzyAVUm4m5Ez9XlR046LzwT6aYG7BHDE6orbI19dIT7aUzgeqThD;",
};

const targetSection = process.argv[2] || "231";

async function getShapeBySection(sectionName) {
  const res = await axios.get(url, { headers });
  const data = res.data;

  const allSegments = data.pages[0].segments;
  const match = allSegments.find((seg) => seg.name === sectionName);

  if (match) {
    console.log(`Section ${sectionName} → Shape ID: ${match.id}`);
  } else {
    console.log(`Section ${sectionName} bulunamadı.`);
  }
}

getShapeBySection(targetSection);
