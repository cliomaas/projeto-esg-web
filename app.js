const mapStyle = [{
    'featureType': 'administrative',
    'elementType': 'all',
    'stylers': [{
        'visibility': 'on',
    },
    {
        'lightness': 33,
    },
    ],
},
{
    'featureType': 'landscape',
    'elementType': 'all',
    'stylers': [{
        'color': '#f2e5d4',
    }],
},
{
    'featureType': 'poi.park',
    'elementType': 'geometry',
    'stylers': [{
        'color': '#c5dac6',
    }],
},
{
    'featureType': 'poi.park',
    'elementType': 'labels',
    'stylers': [{
        'visibility': 'on',
    },
    {
        'lightness': 20,
    },
    ],
},
{
    'featureType': 'road',
    'elementType': 'all',
    'stylers': [{
        'lightness': 20,
    }],
},
{
    'featureType': 'road.highway',
    'elementType': 'geometry',
    'stylers': [{
        'color': '#c5c6c6',
    }],
},
{
    'featureType': 'road.arterial',
    'elementType': 'geometry',
    'stylers': [{
        'color': '#e4d7c6',
    }],
},
{
    'featureType': 'road.local',
    'elementType': 'geometry',
    'stylers': [{
        'color': '#fbfaf7',
    }],
},
{
    'featureType': 'water',
    'elementType': 'all',
    'stylers': [{
        'visibility': 'on',
    },
    {
        'color': '#acbcc9',
    },
    ],
},
];

function initMap() {
    // Create the map.
    const map = new google.maps.Map(document.getElementById('map'), {
        zoom: 10,
        center: { lat: -23.554944337083892, lng: -46.63940716748213 },
        styles: mapStyle,
    });

    // Load the stores GeoJSON onto the map.
    map.data.loadGeoJson('stores.json', { idPropertyName: 'storeid' });

    //Define the custom marker icons, using the store's "category".
    map.data.setStyle((feature) => {
        return {
            icon: {
                url: "img/hortaviva-planta.png",
                scaledSize: new google.maps.Size(30, 40),
            },
        };
    });

    const apiKey = 'AIzaSyCGMretojJ8FeeYjNQXQyeZT1I1j0nXgi4';
    const infoWindow = new google.maps.InfoWindow();

    // Show the information for a store when its marker is clicked.
    map.data.addListener('click', (event) => {
        const category = event.feature.getProperty('category');
        const name = event.feature.getProperty('name');
        const description = event.feature.getProperty('description');
        const hours = event.feature.getProperty('hours');
        const phone = event.feature.getProperty('phone');
        const position = event.feature.getGeometry().get();
        const content = `
      <img style="float:left; width:200px; margin-top:30px" src="img/hortaviva-logo.png">
      <div style="margin-left:220px; margin-bottom:20px;">
        <h2>${name}</h2><p>${description}</p>
        <p><b>Open:</b> ${hours}<br/><b>Phone:</b> ${phone}</p>
        <p><img src="https://maps.googleapis.com/maps/api/streetview?size=350x120&location=${position.lat()},${position.lng()}&key=${apiKey}&solution_channel=GMP_codelabs_simplestorelocator_v1_a"></p>
      </div>
      `;

        infoWindow.setContent(content);
        infoWindow.setPosition(position);
        infoWindow.setOptions({ pixelOffset: new google.maps.Size(0, -30) });
        infoWindow.open(map);
    });

    // const card = document.createElement('div');
    // const titleBar = document.createElement('div');
    // const title = document.createElement('div');
    // const container = document.createElement('div');
    const input = document.getElementById('pac-input');
    const options = {
        types: ['(regions)'],
        componentRestrictions: { country: 'br' },
    };

    // card.setAttribute('id', 'pac-card');
    // title.setAttribute('id', 'title');
    // title.textContent = 'Veja as hortas-vivas pr??ximas de voc??';
    // titleBar.appendChild(title);
    // container.setAttribute('id', 'pac-container');
    // input.setAttribute('id', 'pac-input');
    // input.setAttribute('type', 'text');
    // input.setAttribute('placeholder', 'Enter an address');
    // container.appendChild(input);
    // card.appendChild(titleBar);
    // card.appendChild(container);
    // map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

    // Make the search bar into a Places Autocomplete search bar and select
    // which detail fields should be returned about the place that
    // the user selects from the suggestions.
    const autocomplete = new google.maps.places.Autocomplete(input, options);

    autocomplete.setFields(
        ['address_components', 'geometry', 'name']);

    // Set the origin point when the user selects an address
    const originMarker = new google.maps.Marker({ map: map });
    originMarker.setVisible(false);
    let originLocation = map.getCenter();

    autocomplete.addListener('place_changed', async () => {
        originMarker.setVisible(false);
        originLocation = map.getCenter();
        const place = autocomplete.getPlace();

        if (!place.geometry) {
            // User entered the name of a Place that was not suggested and
            // pressed the Enter key, or the Place Details request failed.
            window.alert('Nenhum endere??o encontrado para: \'' + place.name + '\'');
            return;
        }

        // Recenter the map to the selected address
        originLocation = place.geometry.location;
        map.setCenter(originLocation);
        map.setZoom(10);
        console.log(place);

        originMarker.setPosition(originLocation);
        originMarker.setVisible(true);

        // Use the selected address as the origin to calculate distances
        // to each of the store locations
        const rankedStores = await calculateDistances(map.data, originLocation);
        showStoresList(map.data, rankedStores);

        return;
    });
}

async function calculateDistances(data, origin) {
    const stores = [];
    const destinations = [];

    // Build parallel arrays for the store IDs and destinations
    data.forEach((store) => {
        const storeNum = store.getProperty('storeid');
        const storeLoc = store.getGeometry().get();

        stores.push(storeNum);
        destinations.push(storeLoc);
    });

    // Retrieve the distances of each store from the origin
    // The returned list will be in the same order as the destinations list
    const service = new google.maps.DistanceMatrixService();
    const getDistanceMatrix =
        (service, parameters) => new Promise((resolve, reject) => {
            service.getDistanceMatrix(parameters, (response, status) => {
                if (status != google.maps.DistanceMatrixStatus.OK) {
                    reject(response);
                } else {
                    const distances = [];
                    const results = response.rows[0].elements;
                    for (let j = 0; j < results.length; j++) {
                        const element = results[j];
                        const distanceText = element.distance.text;
                        const distanceVal = element.distance.value;
                        const distanceObject = {
                            storeid: stores[j],
                            distanceText: distanceText,
                            distanceVal: distanceVal,
                        };
                        distances.push(distanceObject);
                    }

                    resolve(distances);
                }
            });
        });

    const distancesList = await getDistanceMatrix(service, {
        origins: [origin],
        destinations: destinations,
        travelMode: 'DRIVING',
        unitSystem: google.maps.UnitSystem.METRIC,
    });

    distancesList.sort((first, second) => {
        return first.distanceVal - second.distanceVal;
    });

    return distancesList;
}

function showStoresList(data, stores) {
    if (stores.length == 0) {
        console.log('empty stores');
        return;
    }

    let panel = document.createElement('div');
    // If the panel already exists, use it. Else, create it and add to the page.
    if (document.getElementById('panel')) {
        panel = document.getElementById('panel');
        // If panel is already open, close it
        if (panel.classList.contains('open')) {
            panel.classList.remove('open');
        }
    } else {
        panel.setAttribute('id', 'panel');
        const body = document.body;
        body.insertBefore(panel, body.childNodes[0]);
    }

    // Clear the previous details
    while (panel.lastChild) {
        panel.removeChild(panel.lastChild);
    }

    stores.forEach((store) => {
        // Add store details with text formatting
        const name = document.createElement('p');
        const route = document.createElement('a');
        const hortas = document.createElement('div');
        hortas.setAttribute('id', 'hortas')
        panel.appendChild(hortas)
        name.classList.add('place');
        const currentStore = data.getFeatureById(store.storeid);
        name.textContent = currentStore.getProperty('name');
        hortas.appendChild(name);
        var linkText = document.createTextNode("Como chegar?");
        route.setAttribute('id', 'link-route')
        route.appendChild(linkText)
        const distanceText = document.createElement('p');
        distanceText.classList.add('distanceText');
        distanceText.textContent = "Dist??ncia at?? a loja:" + store.distanceText;
        hortas.appendChild(distanceText);
        route.href = currentStore.getProperty('route')
        hortas.appendChild(route)
    });

    // Open the panel
    panel.classList.add('open');

    return;
}