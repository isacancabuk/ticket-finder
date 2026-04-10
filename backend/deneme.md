Avilability api response’unda aradigimiz bileti su sekilde buluyoruz:“groups” arrayi icinde:

{
            "offerIds": [
                "KJ6GYZTGGJ3HANRRPAYA"
            ],
            "places": {
                "WW-212": {
                    "11": [
                        "4"
                    ]
                }
            },
            "generalAdmission": false
},

Bu pre-sale bilet icin fiyat bilgisi ayni api response’un icinde su sekilde yer aliyor:“offers” arrayi icinde:
{
            "id": "KJ6GYZTGGJ3HANRRPAYA",
            "listingId": "lff2vp61x0",
            "limit": {
                "max": 1,
                "min": 1,
                "multiple": 1
            },
            "price": {
                "total": 19435,
                "original": 16900,
                "commission": 2535
            },
            "sellerInformation": {
                "businessType": "private",
                "affiliationType": "unaffiliated"
            },
            "restrictions": [],
            "quantities": [
                1
            ],
            "offerTypeDescription": "Sitzplatz",
            "type": "resale"
  },

212deki tekli presale bilet icin fiyat: 194.35 EuroIkili bir bilette yine total olarak tek biletin fiyati yaziyor fakat “quantities” kisminda 1 ve 2 degerlerini goruyoruz.

———————————————————————————————————————————————————————————

Cardlara Etkinlik isminin altina Etkinlik yeri ve saati eklemek adina bir gelistirme yapmak istiyorum.Html icerigini alabiliyor muyuz diye bakmamiz gerekiyor. Head kisminda:

<script id=":R6am:" type="application/ld+json" data-nscript="beforeInteractive" crossorigin="anonymous">
            {
                "@context": "http://schema.org",
                "@type": "MusicEvent",
                "url": "https://www.ticketmaster.de/event/linkin-park-from-zero-world-tour-2026-tickets/135395951?language=en-us",
                "name": "LINKIN PARK - From Zero World Tour 2026",
                "description": "Allianz Arena",
                "image": "https://s1.ticketm.net/dam/a/5ec/e6d28d1a-1885-4614-92c3-34f54c0885ec_EVENT_DETAIL_PAGE_16_9.jpg",
                "startDate": "2026-06-11T18:00:00",
                "endDate": "2026-06-11",
                "eventStatus": "https://schema.org/EventScheduled",
                "location": {
                    "@type": "Place",
                    "name": "Allianz Arena",
                    "sameAs": "https://www.ticketmaster.de/venue/allianz-arena-munich-tickets/mueallianz/753?language=en-us",
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "48.21853",
                        "longitude": "11.62503"
                    },
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": "Franz-Beckenbauer-Platz 5",
                        "addressLocality": "Munich",
                        "postalCode": "80939",
                        "addressCountry": "DE"
                    }
                },
                "offers": {
                    "@type": "Offer",
                    "priceCurrency": "EUR",
                    "availabilityStarts": "2025-06-04T06:00:00Z",
                    "availability": "http://schema.org/InStock",
                    "description": "Allianz Arena",
                    "url": "https://www.ticketmaster.de/event/linkin-park-from-zero-world-tour-2026-tickets/135395951?language=en-us"
                },
                "performer": [
                    {
                        "@type": "MusicGroup",
                        "name": "LINKIN PARK",
                        "sameAs": "https://www.ticketmaster.de/artist/linkin-park-tickets/10021?language=en-us"
                    },
                    {
                        "@type": "MusicGroup",
                        "name": "Clipse",
                        "sameAs": "https://www.ticketmaster.de/artist/clipse-tickets/19451?language=en-us"
                    },
                    {
                        "@type": "MusicGroup",
                        "name": "Phantogram",
                        "sameAs": "https://www.ticketmaster.de/artist/phantogram-tickets/70823?language=en-us"
                    }
                ]
            }</script>Burada munich oldugunu ve baslangic tarihininin sadece tarih kismini alarak ulasabiliyoruz.