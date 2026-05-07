import axios from 'axios';

async function testFrance() {
  const url = 'https://www.ticketmaster.fr/api/ism/donnee-plan-interactif/4251730/78768/646984/WEB';
  const cookie = "eps_sid=3c20a31bdfecd18c.1775666676.159NP62RLdRtcDTD7bDWT7w1XkLqOCz/6ZZpW2HAmVw=; BID=tmPU1itkQ1n-ovRiWig4oKBEj1n0OIqKwGflsDjJxRP6xF_ak-UDUSbWr_uolPowvruUvIMybJiCGXJ1; tkm_i18n=fr; SID=cwkl87uqQF6Z15en7q1m-XuKezmNMIVr3u7A-WyvQ3e3qPlr_s2UWA97pUQxGAVb2fhcTw0nnD3rxyqS; OptanonAlertBoxClosed=2026-05-07T13:41:40.709Z; JSESSIONID=29B9FAFAF8056C52674C855C685F6F57; tmpt=1:CAESGMCHL5rNHpmYiX2zEWim-jYiePjJ5vHCXxjm68yV4DMiMEq7hqMPiywAHGvTBWbREmwgoVPtOZ75nbg4p7lktKDJD7_5QLoWmFUvodKPQan0fw";

  console.log(`Starting POST request to: ${url}`);
  try {
    const payload = { "idseanc": "4251730", "param": "{\"e\":5}" };
    const response = await axios.post(url, payload, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7',
        'Cookie': cookie,
        'Content-Type': 'application/json; charset=UTF-8',
        'Origin': 'https://www.ticketmaster.fr',
        'Referer': 'https://www.ticketmaster.fr/fr/manifestation/bruno-mars-billet/idmanif/646984',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Queueit-Ajaxpageurl': 'https%3A%2F%2Fwww.ticketmaster.fr%2Ffr%2Fmanifestation%2Fbruno-mars-billet%2Fidmanif%2F646984'
      }
    });

    console.log('\n--- SUCCESS ---');
    console.log(`Status Code: ${response.status}`);
    console.log('Response Data:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 1500));

  } catch (error) {
    console.log('\n--- ERROR ---');
    if (error.response) {
      console.log(`Status Code: ${error.response.status}`);
      console.log('Error Data:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

testFrance();
