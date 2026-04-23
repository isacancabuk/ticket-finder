const url = 'https://availability.ticketmaster.de/api/v2/TM_DE/availability/212362633?subChannelId=1';
const cookie = "BID=zL-iB79jZV2PyvHFhxZa_HAfhF-jm-Ym2orqykmK9Ey2oqVwaweRo3BEGgbiyCSWA_I3riRhjLHSDpYs; SID=5KYkOpq1o_EUY-z4OjIPqEjkux853QeIA7alym69I9vSneyLsgYNeLj0EPRRjcxRsSV9aLzVNjHmLQb6; TMUO=east_Oeo+kRQR4J9gBICPbpSA/O0eOjE/4InjSmRxyFBP/7M=; sticky=BCBA; tmpt=1:CAESGPQvqSHjsvMAkZJHwTvNtjPo18BxKn7-chjv-tem1DMiMKk8OHF-adVctZHEhgJQ4znwaCklROSlLMlqrNzGQoj30b-Ru3qebZwH1QxDZWETcA;"

if (!cookie) {
  console.error('Error: TM_DE_COOKIE environment variable is not set.');
  process.exit(1);
}

async function run() {
  try {
    console.log(`Sending GET request to ${url}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'unknown';
    console.log(`Response Content-Type: ${contentType}`);

    const text = await response.text();
    let isJson = false;
    let jsonData = null;

    try {
      jsonData = JSON.parse(text);
      isJson = true;
    } catch (e) {
      isJson = false;
    }

    console.log(`JSON Parsing Succeeded: ${isJson}`);

    if (isJson) {
      console.log('\nTop-level keys summary:');
      const keys = Object.keys(jsonData);
      if (keys.length === 0) {
        console.log('  (Empty object)');
      } else {
        keys.forEach(key => {
          const val = jsonData[key];
          let type = typeof val;
          if (Array.isArray(val)) type = `Array (${val.length} items)`;
          else if (val === null) type = 'null';
          console.log(`  - ${key}: ${type}`);
        });
      }
    } else {
      console.log('\nRaw response (first 500 characters):');
      console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    }

  } catch (error) {
    console.error('\nRequest failed with an error:');
    console.error(error.message);
  }
}

run();
