const fs = require('fs');
const data = JSON.parse(fs.readFileSync('availabilty.md', 'utf8'));
const groups08F = data.groups.filter(g => g.places && g.places['H-08F']);
groups08F.forEach(g => {
  if (g.offerIds) {
    g.offerIds.forEach(oid => {
      const offer = data.offers?.find(o => o.id === oid);
      if (offer) {
        console.log(`Offer ${oid} is in offers array (type: ${offer.type})`);
      } else {
        console.log(`Offer ${oid} is NOT in offers array`);
      }
    });
  } else {
    console.log(`Group has NO offerIds`);
  }
});
