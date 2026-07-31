/* ============================================================
   STATO GLOBALE MAPPA / REGIONI
   ============================================================ */
let leafletMap = null;          // riferimento globale alla mappa Leaflet
let regionsGeoLayer = null;     // layer geojson con tutte le regioni
let regionLayers = {};          // dizionario: valore-dropdown -> layer regione
let activeRegionLayer = null;   // layer attualmente "acceso"

// URL del geojson con i confini delle regioni italiane (ISTAT, via openpolis)
const REGIONS_GEOJSON_URL = 'https://raw.githubusercontent.com/guglielmo/geojson-italy/master/geojson/limits_IT_regions.geojson';

/**
 * Normalizza il nome di una regione così da farlo combaciare
 * con i valori "data-value" usati nel dropdown (#regioniDropdown).
 * Es: "Valle d'Aosta/Vallée d'Aoste" -> "valle-daosta"
 *     "Trentino-Alto Adige/Südtirol" -> "trentino-alto-adige"
 */
function normalizeRegionName(name) {
    return name
        .split('/')[0]                                  // rimuove eventuale doppio nome (es. Südtirol)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuove accenti
        .toLowerCase()
        .replace(/'/g, '')                               // rimuove apostrofi
        .trim()
        .replace(/\s+/g, '-');                            // spazi -> trattini
}

/**
 * Carica il geojson delle regioni italiane e lo aggiunge alla mappa
 * come layer "spento" (bordi sottili, quasi invisibili), pronto ad
 * essere acceso via highlightRegion().
 */
async function loadRegionsLayer(map) {
    try {
        const response = await fetch(REGIONS_GEOJSON_URL);
        if (!response.ok) throw new Error('Errore nel recupero dei confini regionali');
        const geodata = await response.json();

        regionsGeoLayer = L.geoJSON(geodata, {
            style: () => ({
                className: 'region-path',
                weight: 1,
                color: 'rgba(255,255,255,0.18)',
                fillColor: '#00E5FF',
                fillOpacity: 0.02
            }),
            onEachFeature: (feature, layer) => {
                const key = normalizeRegionName(feature.properties.reg_name);
                regionLayers[key] = layer;

                // Permette di selezionare una regione anche cliccandola
                // direttamente sulla mappa, sincronizzando il dropdown.
                layer.on('click', () => {
                    highlightRegion(key);

                    const dropdown = document.getElementById('regioniDropdown');
                    if (!dropdown) return;
                    const option = dropdown.querySelector(`.dropdown-option[data-value="${key}"]`);
                    const selectedText = dropdown.querySelector('.selected-value');
                    if (option && selectedText) {
                        selectedText.textContent = option.textContent;
                        dropdown.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('selected'));
                        option.classList.add('selected');
                    }
                });
            }
        }).addTo(map);

    } catch (error) {
        console.error('Impossibile caricare i confini delle regioni:', error);
    }
}

/**
 * "Accende" la regione corrispondente al valore passato (es. "piemonte"),
 * spegne quella precedentemente attiva con una transizione fluida (tipo LED)
 * e centra/zooma la mappa sui suoi confini in maniera smooth.
 */
function highlightRegion(region) {
    const layer = regionLayers[region];
    if (!leafletMap || !layer) return;

    if (activeRegionLayer && activeRegionLayer !== layer) {
        activeRegionLayer.getElement()?.classList.remove("region-active");

        activeRegionLayer.setStyle({
            weight: 1,
            color: "rgba(255,255,255,.18)",
            fillOpacity: .02
        });
    }

    leafletMap.flyToBounds(layer.getBounds(), {
        padding: [40, 40],
        duration: 1.3
    });

    layer.bringToFront();

    layer.setStyle({
        weight: 3,
        color: "#00E5FF",
        fillOpacity: .12
    });

    const path = layer.getElement();
    if (path) {
        path.classList.remove("region-active");
        requestAnimationFrame(() => path.classList.add("region-active"));
    }

    activeRegionLayer = layer;
}

/*leaflet script*/
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const container = document.getElementById('container');
    container.style.display = 'block';

    let map = null;
    if (document.getElementById('map')) {
        map = initMap();
    }

    setTimeout(() => {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.5s ease';
        setTimeout(() => { loader.style.display = 'none'; }, 500);
        if (map) map.invalidateSize();
    }, 600);
});

function initMap() {
    // Inizializzazione della mappa Leaflet
    const map = L.map('map', {
        zoomControl: false // Controlli di zoom spostati per pulire l'HUD
    }).setView([41.9028, 12.4964], 6);

    // Spostiamo i controlli di zoom in basso a destra
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Aggiunta delle Tile Map scure (CartoDB Dark Matter) coerenti con il design system
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Riferimento globale alla mappa, usato dal dropdown regioni
    leafletMap = map;

    // Caricamento dei confini delle regioni italiane (per l'effetto LED)
    loadRegionsLayer(map);

    // Caricamento dei dati dal file courts.json locale
    loadCourtsData(map);

    return map;
}

function openCourtCard(court) {
    const card = document.getElementById('court-card');

    card.innerHTML = `
        <h2>${court.name}</h2>
        <p>Artista: ${court.art.artist_name}</p>
        <button class="btn-primary" onclick="closeCard()">Chiudi</button>
    `;

    card.classList.add('active');
}

function closeCard() {
    const card = document.getElementById('court-card');
    card.classList.remove('active');
}

// Gestione Menu Hamburger Mobile
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerCheckbox = document.getElementById('hamburger-checkbox');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburgerCheckbox && navMenu) {
        hamburgerCheckbox.addEventListener('change', () => {
            if (hamburgerCheckbox.checked) {
                navMenu.classList.add('active');
            } else {
                navMenu.classList.remove('active');
            }
        });

        // Chiude il menu e resetta la checkbox quando si clicca su un link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburgerCheckbox.checked = false;
            });
        });
    }
});

// Funzione per caricare e renderizzare i campi sulla mappa
async function loadCourtsData(map) {
    try {
        const response = await fetch('courts.json');
        if (!response.ok) throw new Error('Errore nel recupero dati');

        const courts = await response.json();

        // 1. Salviamo i tuoi SVG in costanti separate per mantenere il codice pulito
        const svgBall = `<svg version="1.0" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" enable-background="new 0 0 64 64" xml:space="preserve" fill="#000000" width="40" height="40"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path fill="#394240" d="M54.627,9.372c-12.496-12.494-32.758-12.494-45.254,0c-12.497,12.496-12.497,32.758,0,45.256 c12.496,12.496,32.758,12.496,45.254,0C67.124,42.13,67.124,21.868,54.627,9.372z M53.213,10.786 c4.428,4.428,7.179,9.895,8.261,15.615c-9.549-0.729-19.344,2.539-26.646,9.84c-1.283,1.283-2.437,2.646-3.471,4.066 c-2.487-1.861-4.873-3.926-7.136-6.188c-0.568-0.568-1.106-1.156-1.648-1.74c1.785-2.346,3.748-4.602,5.892-6.744 c7.077-7.078,15.369-12.184,24.198-15.373C52.847,10.437,53.033,10.606,53.213,10.786z M50.973,8.759 c-8.719,3.309-16.901,8.441-23.922,15.463c-2.117,2.117-4.065,4.34-5.845,6.65c-2.224-2.543-4.227-5.211-5.993-7.986 c4.333-5.684,6.633-12.416,6.904-19.217C31.742,0.319,42.732,2.015,50.973,8.759z M10.787,10.786 c2.755-2.756,5.915-4.854,9.285-6.312c-0.395,5.848-2.387,11.605-5.978,16.566c-1.728-2.922-3.208-5.945-4.448-9.047 C10.014,11.585,10.393,11.181,10.787,10.786z M8.193,13.755c1.291,3.084,2.818,6.086,4.582,8.988 c-0.625,0.75-1.285,1.482-1.988,2.186c-2.626,2.625-5.599,4.686-8.766,6.207C2.196,24.985,4.254,18.882,8.193,13.755z M2.031,33.339c3.688-1.645,7.145-3.971,10.17-6.996c0.588-0.588,1.142-1.199,1.678-1.818c1.809,2.777,3.848,5.447,6.104,7.992 c-4.463,6.176-7.752,12.934-9.889,19.967C5.03,47.075,2.34,40.253,2.031,33.339z M11.712,54.093 c2.021-7.07,5.231-13.871,9.654-20.074c0.479,0.506,0.945,1.021,1.441,1.516c2.351,2.352,4.832,4.488,7.419,6.422 c-3.73,5.818-5.498,12.527-5.329,19.193C20.114,59.989,15.563,57.634,11.712,54.093z M53.213,53.212 c-7.156,7.158-17.028,9.934-26.299,8.348c-0.253-6.389,1.382-12.836,4.933-18.424c6.625,4.654,13.896,7.979,21.445,9.994 C53.265,53.157,53.24,53.187,53.213,53.212z M32.979,41.481c0.974-1.336,2.057-2.619,3.263-3.826 c6.99-6.988,16.407-10.049,25.538-9.219c0.961,8.076-1.356,16.463-6.953,23.016C47.13,49.53,39.712,46.212,32.979,41.481z"></path> <g> <path fill="#F76D57" d="M22.573,32.38c0.542,0.584,1.08,1.172,1.648,1.74c2.263,2.262,4.648,4.326,7.136,6.188 c1.034-1.42,2.188-2.783,3.471-4.066c7.302-7.301,17.097-10.568,26.646-9.84c-1.082-5.721-3.833-11.188-8.261-15.615 c-0.18-0.18-0.366-0.35-0.55-0.523c-8.829,3.189-17.121,8.295-24.198,15.373C26.321,27.778,24.358,30.034,22.573,32.38z"></path> <path fill="#F76D57" d="M21.206,30.872c1.779-2.311,3.728-4.533,5.845-6.65C34.071,17.2,42.254,12.067,50.973,8.759 c-8.24-6.744-19.23-8.439-28.855-5.09c-0.271,6.801-2.571,13.533-6.904,19.217C16.979,25.661,18.982,28.329,21.206,30.872z"></path> <path fill="#F76D57" d="M20.072,4.474c-3.37,1.459-6.53,3.557-9.285,6.312c-0.395,0.395-0.773,0.799-1.141,1.207 c1.24,3.102,2.721,6.125,4.448,9.047C17.686,16.079,19.678,10.321,20.072,4.474z"></path> <path fill="#F76D57" d="M12.775,22.743c-1.764-2.902-3.291-5.904-4.582-8.988c-3.939,5.127-5.997,11.23-6.172,17.381 c3.167-1.521,6.14-3.582,8.766-6.207C11.49,24.226,12.15,23.493,12.775,22.743z"></path> <path fill="#F76D57" d="M13.879,24.524c-0.536,0.619-1.09,1.23-1.678,1.818c-3.025,3.025-6.482,5.352-10.17,6.996 c0.309,6.914,2.999,13.736,8.062,19.145c2.137-7.033,5.426-13.791,9.889-19.967C17.727,29.972,15.688,27.302,13.879,24.524z"></path> <path fill="#F76D57" d="M22.808,35.534c-0.496-0.494-0.963-1.01-1.441-1.516c-4.423,6.203-7.633,13.004-9.654,20.074 c3.852,3.541,8.402,5.896,13.186,7.057c-0.169-6.666,1.599-13.375,5.329-19.193C27.64,40.022,25.158,37.886,22.808,35.534z"></path> <path fill="#F76D57" d="M26.914,61.56c9.271,1.586,19.143-1.189,26.299-8.348c0.027-0.025,0.052-0.055,0.079-0.082 c-7.549-2.016-14.82-5.34-21.445-9.994C28.296,48.724,26.661,55.171,26.914,61.56z"></path> <path fill="#F76D57" d="M61.78,28.437c-9.131-0.83-18.548,2.23-25.538,9.219c-1.206,1.207-2.289,2.49-3.263,3.826 c6.732,4.73,14.15,8.049,21.848,9.971C60.424,44.899,62.741,36.513,61.78,28.437z"></path> </g> <path opacity="0.2" fill="#231F20" d="M26.914,61.56c9.271,1.586,19.143-1.189,26.299-8.348c0.027-0.025,0.052-0.055,0.079-0.082 c-7.549-2.016-14.82-5.34-21.445-9.994C28.296,48.724,26.661,55.171,26.914,61.56z"></path> <path opacity="0.2" fill="#231F20" d="M61.78,28.437c-9.131-0.83-18.548,2.23-25.538,9.219c-1.206,1.207-2.289,2.49-3.263,3.826 c6.732,4.73,14.15,8.049,21.848,9.971C60.424,44.899,62.741,36.513,61.78,28.437z"></path> <g opacity="0.2"> <path fill="#FFFFFF" d="M10.787,10.786c-0.395,0.395-0.773,0.799-1.141,1.207c1.24,3.102,2.721,6.125,4.448,9.047 c3.591-4.961,5.583-10.719,5.978-16.566C16.702,5.933,13.542,8.03,10.787,10.786z"></path> <path fill="#FFFFFF" d="M2.021,31.136c3.167-1.521,6.14-3.582,8.766-6.207c0.703-0.703,1.363-1.436,1.988-2.186 c-1.764-2.902-3.291-5.904-4.582-8.988C4.254,18.882,2.196,24.985,2.021,31.136z"></path> </g> </g> </g></svg>`;

        const svgPlayer = `<svg height="40px" width="40px" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-51.2 -51.2 614.40 614.40" xml:space="preserve" fill="#000000" transform="rotate(0)" stroke="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0" transform="translate(0,0), scale(1)"><rect x="-51.2" y="-51.2" width="614.40" height="614.40" rx="307.2" fill="#3a3b3b" strokewidth="0"></rect></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="8.192"> <style type="text/css"> .st0{fill:#ff5900;} </style> <g> <path class="st0" d="M188.92,1.279C183.735,0.465,178.421,0,173.01,0c-6.785,0-13.379,0.712-19.788,1.984 c-0.916,3.372-1.984,7.545-2.989,12.202c-1.238,5.746-2.34,12.168-2.886,18.461c8.331-3.249,15.15-7.626,21.196-12.449 C176.232,14.063,182.559,7.251,188.92,1.279z"></path> <path class="st0" d="M135.411,36.033c0.41-8.447,1.778-16.942,3.365-24.316c0.472-2.189,0.958-4.275,1.437-6.232 c-14.651,4.979-27.791,13.208-38.612,23.886c7.38,4.658,16.081,7.264,25.759,7.277C129.973,36.648,132.668,36.423,135.411,36.033z"></path> <path class="st0" d="M149.187,275.118v-53.372c-7.21-1.402-14.214-3.434-21.012-6.163v59.536H149.187z"></path> <path class="st0" d="M287.799,145.049l-3.146,7.004c-0.636,1.402-1.266,2.736-1.895,3.994h80.056v119.071h21.012V135.035h-93.222 l0.28,0.137c-0.28,1.122-0.629,2.176-0.978,3.297L287.799,145.049z"></path> <path class="st0" d="M124.583,302.437c0,5.882,4.76,10.643,10.643,10.643h241.547c5.876,0,10.65-4.761,10.65-10.643 c0-5.889-4.774-10.65-10.65-10.65H135.226C129.343,291.787,124.583,296.548,124.583,302.437z"></path> <path class="st0" d="M371.287,320.925l0.212-0.417h-20.589c-0.424,1.046-0.916,2.168-1.402,3.502 c-12.75,7.558-31.381,18.98-51.621,34.104c-2.244-2.168-4.48-4.336-6.656-6.368c-13.03-11.976-24.726-21.012-33.967-26.34 l-2.524-1.539l-2.593,1.539c-9.241,5.328-20.868,14.364-33.899,26.34c-2.244,2.1-4.48,4.132-6.724,6.368 c-20.239-15.123-38.803-26.546-51.552-34.104c-0.486-1.266-0.979-2.456-1.395-3.502h-20.664 c1.751,3.919,15.198,35.65,26.614,82.018c0.698,2.798,1.402,5.67,2.1,8.544c0.424,1.962,0.91,3.994,1.334,6.094 c0.561,2.168,0.978,4.412,1.471,6.655c5.602,26.539,10.014,56.662,11.204,88.181l19.193-0.705 c-0.144-3.919-0.424-7.77-0.629-11.552v-0.075c-0.068-1.259-0.212-2.449-0.349-3.64c5.533-15.759,12.955-30.609,21.71-44.336h0.068 c9.946,10.089,19.474,20.944,28.161,32.776c-5.677,8.195-10.93,16.813-15.691,25.78h11.067c3.29-5.882,6.792-11.696,10.575-17.229 c3.782,5.533,7.284,11.347,10.574,17.229h11.068c-4.761-8.967-10.014-17.585-15.691-25.78c8.686-11.833,18.215-22.688,28.16-32.776 c8.823,13.727,16.177,28.509,21.71,44.268c-0.068,1.19-0.205,2.38-0.349,3.57c-0.212,3.92-0.492,7.846-0.63,11.765L328.777,512 c1.258-31.519,5.67-61.498,11.204-88.044v-0.069c0.492-2.311,1.054-4.556,1.47-6.723c0.424-2.1,0.985-4.132,1.402-6.094 c0.63-2.942,1.334-5.746,2.032-8.544c2.244-9.316,4.624-18.003,7.004-25.985c5.11-17.51,10.089-31.662,13.796-41.471 c1.82-4.973,3.365-8.755,4.412-11.272C370.659,322.532,371.082,321.554,371.287,320.925z M224.974,358.47 c11.484-10.506,21.854-18.564,29.768-23.605c7.982,5.041,18.283,13.098,29.699,23.605c1.888,1.751,3.851,3.571,5.814,5.533 c-6.656,5.178-13.38,10.712-20.103,16.669c-5.185,4.548-10.294,9.385-15.41,14.426c-5.11-5.041-10.295-9.877-15.479-14.426 c-6.724-5.958-13.447-11.56-20.102-16.744C221.123,362.041,223.154,360.221,224.974,358.47z M168.243,346.842v-0.068 c-1.053-3.016-2.107-5.89-3.017-8.55c11.211,6.867,24.87,15.76,39.433,26.69c-6.443,6.512-13.024,13.584-19.748,21.293 c-1.19,1.395-2.455,2.941-3.646,4.411C176.854,373.668,172.305,358.887,168.243,346.842z M196.957,474.872 c-1.54-13.727-3.502-26.963-5.746-39.5c-0.835-4.276-1.608-8.406-2.517-12.538c1.751,1.402,3.502,2.805,5.253,4.276 c2.661,2.236,5.458,4.624,8.126,7.004c3.851,3.434,7.702,6.936,11.553,10.575C207.395,454.284,201.861,464.366,196.957,474.872z M219.023,436.774c-3.434-3.29-6.868-6.443-10.37-9.528c-5.883-5.177-11.765-10.082-17.579-14.706 c-1.895-1.47-3.714-2.804-5.534-4.206c-0.281-1.259-0.561-2.517-0.841-3.708c-0.137-0.909-0.349-1.682-0.561-2.523l0.28-0.349 c1.054-1.402,2.244-2.729,3.366-4.063c8.263-9.877,16.526-18.913,24.583-26.963c6.655,5.178,13.447,10.786,20.239,16.737 c5.184,4.624,10.37,9.385,15.41,14.426C237.723,412.608,227.915,424.236,219.023,436.774z M254.741,476.35 c-8.967-11.772-18.632-22.764-28.714-32.784c8.679-12.537,18.488-24.166,28.714-34.877c10.225,10.712,19.959,22.34,28.714,34.877 C273.373,453.587,263.708,464.51,254.741,476.35z M318.271,435.372c-2.312,12.606-4.275,25.848-5.814,39.5 c-4.836-10.574-10.37-20.588-16.6-30.116c3.851-3.639,7.702-7.209,11.56-10.643c2.729-2.38,5.39-4.768,8.05-6.936 c1.751-1.471,3.502-2.873,5.253-4.275C319.879,427.04,319.037,431.096,318.271,435.372z M324.714,404.626 c-0.28,1.191-0.561,2.518-0.841,3.708c-1.82,1.402-3.646,2.736-5.534,4.206c-5.814,4.692-11.696,9.529-17.578,14.706 c-3.502,3.086-6.936,6.239-10.369,9.46c-8.892-12.538-18.701-24.166-28.927-34.816c5.042-5.041,10.158-9.802,15.343-14.426 c6.792-5.951,13.584-11.56,20.308-16.737c7.914,8.05,16.252,17.086,24.59,27.032c1.19,1.402,2.381,2.941,3.638,4.411 C325.132,403.012,324.927,403.785,324.714,404.626z M341.171,346.774v0.068c-4.063,12.046-8.612,26.895-12.955,43.844 c-1.258-1.471-2.456-2.941-3.714-4.343c-6.58-7.702-13.304-14.849-19.754-21.43c14.569-10.93,28.229-19.754,39.44-26.69 C343.271,340.884,342.225,343.757,341.171,346.774z"></path> <path class="st0" d="M40.623,366.172V54.487h19.124c2.873-7.004,6.443-13.659,10.644-20.034c2.106-3.221,4.418-6.368,6.867-9.384 l4.481-5.602H5.602v381.726h136.936c-3.433-13.167-6.936-25.007-10.157-35.021H40.623z"></path> <path class="st0" d="M264.057,19.467c8.967,10.014,16.389,21.505,21.786,34.247l0.349,0.773h185.186v311.684h-94.344 c-1.608,4.973-3.29,10.37-4.972,16.252c-1.82,6.163-3.434,12.463-5.041,18.769h139.379V19.467H264.057z"></path> <path class="st0" d="M271.499,77.032c-6.977-3.79-16.265-7.032-26.977-9.33c-12.12-2.626-26.047-4.076-40.554-4.069 c-17.038-0.007-34.884,1.997-51.621,6.361c-1.054,0.294-2.1,0.609-3.146,0.903c1.361,8.721,3.139,17.202,5.274,25.39 c3.509-1.232,7.114-2.271,10.814-3.072c5.061-1.095,10.102-1.587,15.062-1.587c16.306,0.007,31.69,5.302,45.547,12.299 c13.865,7.004,26.3,15.766,36.67,23.098c2.571,1.826,4.972,3.509,7.277,5.109c3.037-9.644,4.726-19.904,4.726-30.574 c0-7.223-0.759-14.248-2.216-21.019v-0.034C272.108,79.337,271.78,78.195,271.499,77.032z"></path> <path class="st0" d="M149.364,58.667h0.014c17.852-4.665,36.635-6.744,54.59-6.751c15.288,0,29.98,1.518,43.024,4.33 c7.024,1.519,13.55,3.42,19.481,5.684C254.891,34.61,231.69,13.393,203.079,4.556c-1.655,1.244-3.366,2.674-5.157,4.323 c-4.09,3.762-8.544,8.4-13.714,13.222c-9.214,8.612-20.917,17.763-37.265,23.098c0.007,4.713,0.13,9.371,0.637,13.981 C148.181,59.016,148.763,58.83,149.364,58.667z"></path> <path class="st0" d="M71.539,105.658c6.683-8.161,14.829-15.514,23.769-21.915c12.592-9.002,26.771-16.177,40.896-21.074 c-0.089-0.732-0.191-1.423-0.273-2.154v0.006c-0.465-4.336-0.609-8.55-0.657-12.674c-2.674,0.308-5.315,0.52-7.914,0.52 c-12.517,0.007-24.117-3.618-33.728-10.15C79.74,55.582,71.45,77.558,71.45,101.56C71.45,102.942,71.491,104.303,71.539,105.658z"></path> <path class="st0" d="M102.141,93.27c-11.895,8.495-21.95,18.653-28.421,29.638C77.606,141,86.286,157.319,98.4,170.452 c0.075-0.212,0.144-0.41,0.212-0.615c1.471-4.515,3.14-9.768,5.226-15.397c4.186-11.238,10.028-23.995,19.536-35.417 c5.438-6.539,12.188-12.572,20.349-17.599c-2.339-8.673-4.323-17.641-5.828-26.895C125.527,79.036,113.071,85.432,102.141,93.27z"></path> <path class="st0" d="M125.035,136.868c-6.498,10.684-10.554,22.134-13.748,31.867c-1.272,3.878-2.394,7.408-3.53,10.63 c17.688,14.829,40.37,23.755,65.254,23.755c9.72,0,19.097-1.388,27.996-3.933c-10.499-8.769-20.144-19.822-28.66-32.681 c-10.192-15.424-18.762-33.475-25.199-53.414C137.497,119.672,130.438,127.976,125.035,136.868z"></path> <path class="st0" d="M213.975,194.44c20.062-8.85,36.751-23.974,47.462-42.934l0.007-0.007c1.491-2.634,2.818-5.342,4.07-8.105 c-3.058-2.08-6.293-4.378-9.72-6.799c-6.888-4.877-14.502-10.24-22.634-15.192c-16.266-9.938-34.556-18.099-52.811-18.057 c-4.172,0-8.372,0.41-12.586,1.32c-3.509,0.766-6.813,1.806-10.034,2.968c6.204,19.747,14.542,37.517,24.398,52.408 C191.608,174.379,202.449,186.062,213.975,194.44z"></path> <path class="st0" d="M95.294,189.276l-0.438-0.389c-0.007-0.007-0.014-0.014-0.028-0.021L95.294,189.276z"></path> </g> </g></svg>`;

        const svgBasket = `<svg viewBox="-2.04 -2.04 24.49 24.49" xmlns="http://www.w3.org/2000/svg" fill="#ffffff" width="40" height="40"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#930b0b" stroke-width="3.5098319999999994"> <g id="basketball-dribble" transform="translate(-3.658 -2)"> <circle id="secondary" fill="#ff6600" cx="2" cy="2" r="2" transform="translate(10 3)"></circle> <line id="primary-upstroke" x2="0.1" transform="translate(18.45 14.5)" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></line> <circle id="primary" cx="2" cy="2" r="2" transform="translate(10 3)" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></circle> <path id="primary-2" data-name="primary" d="M19,10l-2.28.76a1,1,0,0,1-1.14-.4l-1-1.47A2,2,0,0,0,12.93,8H10.24a1,1,0,0,0-.45.11L6.3,9.85a1,1,0,0,0-.45.45L5,12" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path> <path id="primary-3" data-name="primary" d="M10,8.05a58,58,0,0,0-1,6.66.86.86,0,0,0,.14.54c.8,1.24,2.74,2.06,3.9,2.46A1,1,0,0,1,13.68,19L13,21" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path> <path id="primary-4" data-name="primary" d="M6,21a15.6,15.6,0,0,0,3.86-4.62" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path> <line id="primary-5" data-name="primary" x1="0.93" y2="4.66" transform="translate(13 8.34)" fill="none" stroke="#b78a8a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line> </g> </g></svg>`;

        const svgdefault = `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-51.2 -51.2 614.40 614.40" xml:space="preserve" fill="#000000" stroke="#000000" transform="matrix(1, 0, 0, 1, 0, 0)" stroke-width="3.0720180000000004"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#c9c5c5" stroke-width="16.384096000000003"></g><g id="SVGRepo_iconCarrier"> <rect x="0.283" y="101.096" style="fill:#fff947;" width="511.72" height="309.81"></rect> <g> <rect x="255.51" y="101.096" style="fill:#ff6600;" width="256.49" height="309.81"></rect> <path style="fill:#ff6600;" d="M0,101.255c85.642,0,155.068,69.3,155.068,154.787S85.642,410.829,0,410.829V101.255z"></path> </g> <path style="fill:#fff947;" d="M0.283,123.542c73.284,0,132.692,59.3,132.692,132.451S73.567,388.443,0.283,388.443V123.542z"></path> <path style="fill:#ff6600;" d="M106.075,217.196H0v77.59h106.075c21.425,0,38.795-17.37,38.795-38.795l0,0 C144.87,234.566,127.5,217.196,106.075,217.196z"></path> <rect x="0.283" y="217.196" style="fill:#eb2300;" width="78.24" height="77.59"></rect> <path style="fill:#ff6600;" d="M512,410.829c-85.642,0-155.068-69.3-155.068-154.787S426.358,101.255,512,101.255V410.829z"></path> <path style="fill:#fff947;" d="M511.717,388.543c-73.284,0-132.692-59.301-132.692-132.451s59.409-132.452,132.692-132.452 L511.717,388.543L511.717,388.543z"></path> <path style="fill:#ff6600;" d="M405.925,294.888H512v-77.59H405.925c-21.425,0-38.795,17.368-38.795,38.795l0,0 C367.13,277.518,384.5,294.888,405.925,294.888z"></path> <g> <rect x="433.48" y="217.306" style="fill:#eb2300;" width="78.24" height="77.59"></rect> <ellipse style="fill:#eb2300;" cx="256.14" cy="255.996" rx="54.874" ry="54.774"></ellipse> </g> </g></svg>`
        courts.forEach(court => {
            const { lat, lng } = court.location;

            const lighting = court.specs.lighting;
            const surface = court.specs.surface.toLowerCase();
            const hoops = court.specs.hoops;

            let iconHtml = '';

            if (lighting === true && surface === 'buona') {
                iconHtml = svgBall;
            } else if (lighting === true && hoops <= 2) {
                iconHtml = svgPlayer;
            } else if (hoops > 2 && surface === 'buona') {
                iconHtml = svgBasket;
            } else {
                iconHtml = svgdefault;
            }


            const courtIcon = L.divIcon({
                className: 'custom-court-marker',
                html: iconHtml,
                iconSize: [20, 20],
                iconAnchor: [20, 20]
            });


            const marker = L.marker([lat, lng], { icon: courtIcon }).addTo(map);

            // Binding dell'evento 'click' per aprire la Court & Canvas Card
            marker.on('click', () => {
                openCourtCard(court);
            });
        });

    } catch (error) {
        console.error('Impossibile caricare i campi:', error);
    }
}

function openCourtCard(court) {
    const card = document.getElementById('court-card');

    card.innerHTML = `
    <button class="close-btn" onclick="closeCard()">✕</button>
    
    <!-- Hero Image -->
    <div class="card-hero" style="background-image: url('${court.art.image_url}');"></div>
    
    <div class="card-content">
      <!-- Header -->
      <header class="card-header">
        <h2>${court.name}</h2>
        <div id="descrCard">
            <p class="artist-name">By ${court.art.artist_name}</p>
                ${court.art.artist_ig 
                ? `<a href="${court.art.artist_ig}" target="_blank" rel="noopener noreferrer" class="artist_ig">more of The artist -> </a>` 
                : ''}
        </div>
      </header>
      
      <!-- Body (Dettagli Tecnici) -->
      <section class="card-body">
        <h3 class="title ">Caratteristiche del <span>Campo:</span></h3>
        <ul class="tech-specs">
          <li><span><strong> Città:</strong> </span>${court.location.city}</li>
          <li><span><strong> Canestri:</strong></span> ${court.specs.hoops}</li>
          <li><span><strong> Fondo:</strong> </span>${court.specs.surface}</li>
          <li><span><strong> Luci:</strong></span> ${court.specs.lighting ? 'Sì' : 'No'}</li>
        </ul>
      </section>
      
      <!-- Call to Action -->
      <a href="https://www.google.com/maps/dir/?api=1&destination=${court.location.lat},${court.location.lng}" 
         target="_blank" class="btn-primary cta-btn">
         Portami Qui
      </a>
    </div>
  `;
    card.classList.add('active');
}

// Funzione di chiusura
function closeCard() {
    const card = document.getElementById('court-card');
    card.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.getElementById('regioniDropdown');
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const selectedText = dropdown.querySelector('.selected-value');
    const options = dropdown.querySelectorAll('.dropdown-option');

    // Apri / Chiudi il menu al click
    trigger.addEventListener('click', () => {
        dropdown.classList.toggle('open');
    });

    // Gestione selezione opzione
    options.forEach(option => {
        option.addEventListener('click', () => {
            // Aggiorna testo visibile
            selectedText.textContent = option.textContent;

            // Gestisci la classe 'selected'
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Chiudi il menu
            dropdown.classList.remove('open');

            const regionValue = option.getAttribute('data-value');
            console.log('Regione selezionata:', regionValue);


            highlightRegion(regionValue);
        });
    });

    // Chiudi il menu se si clicca fuori da esso
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
});



document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('add-court-btn');
  const modal = document.getElementById('FORMbtn');
  const submitBtn = document.getElementById('submit-btn');
  const statusEl = document.getElementById('form-status');

  /* --- CONFIGURAZIONI --- */
  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/IL_TUO_CLOUD_NAME/image/upload";
  const CLOUDINARY_UPLOAD_PRESET = "IL_TUO_PRESET"; // Deve essere un "unsigned preset"

  const EMAILJS_CONFIG = {
    service_id: 'service_otx8vp6',
    template_id: 'template_9kjmaqx',
    user_id: 'pG1Obo4krnQ5alTI0'
  };

  /* --- FUNZIONE ORIGINALE (NON TOCCATA ) --- */
  function AggiungiForm() {
    if (btn.innerText === "+ Aggiungi Campo") {
      btn.innerText = "✖";
      modal.style.display = "block";
    } else {
      btn.innerText = "+ Aggiungi Campo";
      modal.style.display = "none";
    }
  }
  btn.addEventListener('click', AggiungiForm);

  const showStatus = (msg, type) => {
    statusEl.textContent = msg;
    statusEl.style.color = type === 'error' ? '#fe5314' : type === 'success' ? '#4CAF50' : '#B3B3B3';
  };

  modal.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'ELABORAZIONE...';
    showStatus('Inizio caricamento...', 'info');

    try {
      let finalImageUrl = "Nessuna immagine caricata";

      // --- CORREZIONE QUI ---
      const imageInput = document.getElementById('ImmagineCam');
      
      // Controlliamo che l'elemento esista e che l'utente abbia selezionato un file
      if (imageInput && imageInput.files && imageInput.files.length > 0) {
        const imageFile = imageInput.files[0];
        
        showStatus('Caricamento immagine...', 'info');
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const cloudRes = await fetch(CLOUDINARY_URL, {
          method: 'POST',
          body: formData
        });

        if (!cloudRes.ok) throw new Error("Errore Cloudinary: verifica il Preset.");
        const cloudData = await cloudRes.json();
        finalImageUrl = cloudData.secure_url;
      } else {
        // Se l'utente non mette un file, ma mette un link (opzionale)
        // finalImageUrl = imageInput.value; // Decommenta se vuoi supportare ancora i link testo
      }

      // 2. RICERCA COORDINATE (Nominatim)
      showStatus('Ricerca coordinate...', 'info');
      const addressInput = document.getElementById('IndirizzoCam');
      const address = addressInput ? addressInput.value : "";
      
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address )}`);
      const geoData = await geoRes.json();
      
      // Protezione anche qui: se geoData è null o vuoto, non crasha
      const coords = (geoData && geoData.length > 0) ? 
        { lat: geoData[0].lat, lng: geoData[0].lon, full: geoData[0].display_name } : 
        { lat: "N/D", lng: "N/D", full: address };

      // 3. INVIO EMAILJS
      showStatus('Invio segnalazione...', 'info');
      const templateParams = {
        nome_campo: document.getElementById('NomeCam').value,
        indirizzo: address,
        citta_rilevata: coords.full,
        latitudine: coords.lat,
        longitudine: coords.lng,
        artista: document.getElementById('ArtistaCam').value || "Sconosciuto",
        instagram: document.getElementById('ArtistaIgCam').value || "N/D",
        canestri: document.getElementById('CanestriCam').value || "N/D",
        superficie: document.getElementById('SuperficieCam').value,
        illuminazione: document.getElementById('IlluminazioneCam').checked ? "SÌ" : "NO",
        url_immagine: finalImageUrl
      };

      const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_CONFIG.service_id,
          template_id: EMAILJS_CONFIG.template_id,
          user_id: EMAILJS_CONFIG.user_id,
          template_params: templateParams
        } )
      });

      if (!emailRes.ok) throw new Error("Errore EmailJS: verifica Service ID.");

      showStatus('Segnalazione inviata! ✓', 'success');
      
      setTimeout(() => {
        modal.reset();
        if (typeof AggiungiForm === 'function') AggiungiForm(); 
        submitBtn.disabled = false;
        submitBtn.textContent = 'INVIA E VALIDA';
        showStatus('', '');
      }, 2500);

    } catch (err) {
      console.error(err);
      showStatus(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'RIPROVA';
    }
  });

});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("active");
        }
    });
}, {
    threshold: 0.15
});

document.querySelectorAll(
    ".reveal, .reveal-left, .reveal-right, .reveal-scale"
).forEach(el => observer.observe(el));



