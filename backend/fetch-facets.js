import axios from "axios";

const url =
  "https://services.ticketmaster.co.uk/api/ismds/host/36006341A9A08473/facets?q=available&oq=&by=shape+tickettypes+attributes+available+accessibility+offer+placeGroups+inventoryType+offerType+description&show=places&apikey=b462oi7fic6pehcdkzony5bxhe&apisecret=pquzpfrfz7zd2ylvtz3w5dtyse&compress=places";

const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.co.uk/",
  Origin: "https://www.ticketmaster.co.uk",
  Cookie:
    "BID=aigXRIKtoDssj0kuCXKcKI7d4LM2m6VHhus8lrOu_dMpIAVKBE7a9sW4RaQ_xulf6fsDu1bCcI9tFtQg; sticky=BADC; SID=EZnyAGP7siq0y7e_F48EcrmpRc9Zxa3Tdj2G-73p5EoYCIhuGT5GmTAMPW_4-3mmq3qSui0TBw3dCjBc; tmpt=0:bc9df7fbb1000000:1760873808:d17d7628:8094862a19cdce65c3dac592c97aa0c7:468463bf0f14c6644fee23bacfc2f2a6398a180d7df654a0b7b71c3b9386d6ad",
};

const targetShape = process.argv[2];

async function checkAvailability(shapeId) {
  try {
    const res = await axios.get(url, { headers });
    const data = res.data;

    const found = data.facets.some((f) => f.shapes.includes(shapeId));
    console.log(`Section ${shapeId} → available: ${found}`);
    return found;
  } catch (err) {
    console.error("Error:", err.response?.status, err.message);
  }
}

checkAvailability(targetShape);
