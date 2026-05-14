import { gotScraping } from 'got-scraping';

async function getFifaProductId() {
    const url = 'https://fwc26-resale-usd.tickets.fifa.com/secure/selection/event/seat/performance/10229226700887';
    const cookie = 'ak_bmsc=02398916350EEB6768CBD633FAD16F55~000000000000000000000000000000~YAAQp8ETAnUDaxueAQAAJQ+cIR9M+LqsRzRpqd6NHn5eQq6nI3US2RC0wgz4rYhTtexmqTjI6xAYp63KQBBLB7KXrUpkkgBikK/ASgk3sdcz7FWPDC8t6YTtQeo77lHrhtHNEMGLh86yKtD0s06hRQ1t/TCaqEYS+qmp5/nLHPI+CZy4lYoCp3R6sI3xEqJsMsUbgaKJLtz7qaGytuZISwnsSxIG4H8rNoYJgl9RZ0qW4gbhaBg13lf+2OR5hRsIxVuQHZDPb/T6bRIef6FHlB+OqVRs6hLhbaNp4YVl2vsAE5hHFqbDx7V9b3JcLmWLX1Ht3z6rZqFRCyrySF0FQ+RHEfz0vycTIYDfeDaKsBdIpiGzUWlPFxKlBHRVlwzz; datadome=3BonQQFjORkMpUnQ2MrIKVj1glVHCdHADNzHBgiodx6GdrwctLTb3QMDzzVMMgr9PhU7QCvTCBiYoknF8iktxmkHQbYaiaAktok7oGKo5PWmG6Nq84ZSqWjvcw5HC3Wx; SERVERID-BE-INTERNET=edd84dfada583604619a22400fbbffe5c144a486; lang=en; CACHE_PKP_TOKEN=p53pkpcontroller1-7a5h5h4i-1c4394c7e7de2aa2a50c7c4ff949bf4f9062ccb8a32bced290ff1a38b7c3f28a92671fbb9b81406fc6dfd94f507921bd656acc4e82be1b498827d6772fde53f0~20260513141131~33989c6a5c8fa88b6b22113f67a547d9d8cbceba3fc382a3a31c354a9704170e; bm_sz=E4FE79585DAF75145329B5F1BCEB1E15~YAAQjMETAi/lMx+eAQAA5cysIR+kkWR5epkOjZpaI6iTMxcUcbRtcNFU2E4UUZcGGEv2nYWsM2HE/xOtlHgJzLIZgd3tOehGUdi7U/tG90dj6MK8E1IOZrE9fEHSai8IV/Kg52eEcwZ3N9UgerfSj41bj79rGFFYV5DQlNEcX0NvimaKQhN8+9KN0jcc6RNmuPG1zMNr6VVa7HgcEYthwXKZvrOozUKzmp+mPN/iiTkv2tePV+zPQgbSzpiMP10EvYi4hVmvJd/nscy9KJ0C1s9HexgdAtmw2VhQUsV4qQqVEE8BaKulBzNHzcrXPsS4gHLNBCxMVwCXp0lxEaa2DlFblXLZU8EEfw8y8NuBwOGL1fX2CZJrX7wXg7wRfYXYX02kJHdlNclhm7HYfJ1fmrbnLETj/pxDz/Tra0BseDwrH4h/sED6ghYRrARas+oVlq8B2P+flkQ6w+8L6dHT4LfwYbYnChkxndplVd7iUNRL7JUi1QA5DdYLdUZVOUsMMmv0jFjk3GbUKy7qIhkt067Ym2gXYM4IZzGZTGt4pMzW4eHsdTyXsNwH/WGk81BD0we4v7JMaA==~3748408~4468788; _abck=6BC1E88E89E915C28203E9C88D60463C~0~YAAQjMETAujoMx+eAQAAcNKsIQ+oBXaQz4tpNjIxsZv81mHmwGe+c6cKbxJdvOx8/zn5euTx32oHlviXYJCtrbVT3I2xxSj7ReDZoEJ4FJrpDkCogwzKUO4ttQokjxhitp8HQmgXomSLNK0hHYb2DyDI0lfdcpgYEWSRGilP+yfpNlw+nNtThi+HMVTxftnoi2e36vuwQrGqx7XkeWtyVCrKWzo5YWqKuKqxf4tfqzsv/T0H7DdwCyqzYpranEFH92g8hnvKfHUcJgEcVa5B0zRf1+GcuGcYtJ45k9b/Tmis04HfTZ6F/0Zhyis8oVDMjfaRDK1wG+4khkDHKA4GL1Rgo1F4RjkdJuRZ5pStUFuDvb5ZCTRble3MdW1NMju96fEYY3lsAW1ZH2UfwEmN3SAn2t9sKAOqH+ODDanz1eVSL5Xaek/AqNLZb3eFNMXg248/5RHXHmcGM+v1q1fXYjvGp/P+gMc43paI5NgV46UivxdguAPj4oftvY0pEIq7LkQ8VSH3LPlBoMGbaEmtKwUCEU3TykIXWN45UNhX4c4czIItdjh4KK5I6+rtyOUy4Gv0cegFaA9eQ8dqM1/IkHPYSlUAPsHouCcviMLjhRlNyaBflvKjxubVMh5KLxhEYdz2fUpAVf2GdgREH59vfdiJHx9qMD4WZw+H6ZUvw88P0iLwqiyVxZX8PsVeybNiWkCO8rmkjcB16lNfZS35g8M5fZ1mNdLsmjQpO6iSZuW0+khLwZrDJQy9//vBCw8dw1jEXvZEh9yXb6YCDCWdgQZIzRl0zMaz2erj1qRTaFqbH1EFf6uPGOFH/nNUSFqwRYM1tnEpgLadlciwnB3Ny9MRzM6VjYUGrfRXbOlpCSxYr8Y+M/lPBtad7oRSfmGi7kiHd1/Extw/qaJrNHyGLkPyaKaM8NwReIBkxfBV1DELtbrJteXz01+J3HfCn/TSM+d240WDIYWChpvDe/KiRnG0Z6aWpAXdNqgKixCizgk=~-1~-1~1778683994~AAQAAAAF%2f%2f%2f%2f%2f%2fx2YQt8zLWXgN2rGIbN7GhdJD2uqKpGm9w50usFPCJHgpfe1JD868lB4xPIcXlfLRzI16lsRLADtobIS%2fjGglhJy8CbxMCIJcoGSxqwWL+P9S9GAsDSxsaPohO9Bqzlt2b1+I0IE+fQdD4nzfSGwycqBI4ASnXHnYD+Q2WPOw%3d%3d~-1;';

    try {
        const response = await gotScraping({
            url,
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Pragma': 'no-cache',
                'Referer': 'https://fwc26-resale-usd.tickets.fifa.com/secure/selection/event/date/product/10229225515651/contact-advantages/10229997382729/lang/en',
                'Sec-Ch-Ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        console.log("Status Code:", response.statusCode);
        console.log("Headers:", response.headers);

        const html = response.body || "";
        console.log("Response data length:", html.length);
        const match = html.match(/product_description_header\s+product_(\d+)/);
        
        if (match && match[1]) {
            console.log("Found Product ID:", match[1]);
        } else {
            console.log("Product ID not found. Snippet:");
            console.log(html.substring(0, 500));
        }

    } catch (error) {
        console.error("Error fetching page:", error.message);
        if (error.response) {
            console.log("Response data length:", error.response.body.length);
            console.log(error.response.body.substring(0, 500));
        }
    }
}

getFifaProductId();
