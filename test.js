const url = 'https://www.ticketmaster.co.uk/api/quickpicks/36006363CFEB9A22/list?defaultToOne=true&promoted=primary&primary=true&resale=true&qty=1';

const cookie = 'BID=aigXRIKtoDssj0kuCXKcKI7d4LM2m6VHhus8lrOu_dMpIAVKBE7a9sW4RaQ_xulf6fsDu1bCcI9tFtQg; eps_sid=ac89f0b1eead95bc.1777377281.CjMtn4UQxgeX3N3q8ozw4kuKfLO80VxNDbyAU+nWgEA=; sticky=DDCD; SID=-BrzxtvSXDqKF3F4NoXwQ8pfcswLFvHIvMDqG_7lCwwV9DI4kiY-Sq3HABO9-DyArwbf2ag-Pzsixrx0; TMUO=west_wlLtby865fMgSKk/+yWet4ebO+UZ+hcWWYx/d7nIMk0=; tmpt=1:CAESGD7GNHupJ8NnjNnLikvvw1fb0WzjkDhWlhjgrI-k3TMiMMVQ5QLSn91FvHByJDWpwYeVi1_1oal_ZYE63shTbX8UnuxQ7SMskA_QYiAQNPzHTA;';

const headers = {
  'Cookie': cookie,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

async function testEndpoint() {
  try {
    console.log(`Sending GET request to: ${url}`);
    const response = await fetch(url, { method: 'GET', headers });

    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);

    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      console.log('JSON Parsing: Succeeded');
      console.log('Top-level keys:', Object.keys(data));
      
      if (data.picks) {
        console.log(`Picks count: ${data.picks.length}`);
      }
      
      const previewStr = JSON.stringify(data, null, 2);
      console.log('\nCompact preview:');
      console.log(previewStr.substring(0, 1500) + (previewStr.length > 1500 ? '\n...' : ''));
    } catch (parseError) {
      console.log('JSON Parsing: Failed');
      console.log('\nRaw response preview (first 1500 chars):');
      console.log(text.substring(0, 1500));
    }
  } catch (error) {
    console.error('\nRequest failed:', error.message);
  }
}

testEndpoint();
