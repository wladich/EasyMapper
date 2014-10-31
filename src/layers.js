//@require leaflet
//@require leaflet.yandex
//@require leaflet.google
window.layers = {};

window.layers.getBaseMaps = function getBaseMaps() {
    return {
        'OpenStreetMap': L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                     {code: 'O', scaleDependent: true}),
        'ESRI Sat': L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                                {code: 'E', maxNativeZoom: 17}),
        'Yandex': new L.Yandex('map', {scaleDependent: true, code: 'Y', noCors: true}, {yandexMapAutoSwitch: false}),
        'Yandex Public': new L.Yandex('publicMap', {code: 'P', scaleDependent: true, noCors: true}),
        'Yandex Sat': new L.Yandex('satellite', {code: 'S'}),
        'Google': new L.Google('ROADMAP', {code: 'G', scaleDependent: true}),
        'Google Sat': new L.Google('SATELLITE', {code: 'L'}),
        'Google Sat Hybrid': new L.Google('HYBRID', {code: 'H', scaleDependent: true}),
        'marshruty.ru': L.tileLayer('http://maps.marshruty.ru/ml.ashx?x={x}&y={y}&z={z}&i=1&al=1',
                                      {code: 'M', maxNativeZoom: 18, noCors: true, scaleDependent: true}),
        'Topomapper 2km': L.tileLayer('http://maps.atlogis.com/cgi-bin/tilecache-2.11/tilecache.py/1.0.0/topomapper_gmerc/{z}/{x}/{y}.jpg',
                                      {code: 'T', maxNativeZoom: 12, noCors: true})
    };
};

window.layers.getOverlays = function getOverlays() {
    return {
        "Poehali 10km": new L.TileLayer("http://tiles.wladich.tk/poehali001m/{z}/{x}/{y}",
                                        {code: 'D', tms: true, maxNativeZoom: 9}),
        "ArbaletMO": new L.TileLayer("http://tiles.wladich.tk/ArbaletMO/{z}/{x}/{y}",
                                     {code: 'A', tms: true, maxNativeZoom: 13}),
        "topo500": new L.TileLayer("http://tiles.wladich.tk/topo500/{z}/{x}/{y}",
                                   {code: 'B', tms: true, maxNativeZoom: 14}),
        "topo1000": new L.TileLayer("http://tiles.wladich.tk/topo1000/{z}/{x}/{y}",
                                    {code: 'C', tms: true, maxNativeZoom: 13}),
        "Slazav map": new L.TileLayer("http://tiles.wladich.tk/map_podm/{z}/{x}/{y}",
                                      {code: 'Z', tms: true, maxNativeZoom: 14}),
        "O-sport": new L.TileLayer("http://tiles.wladich.tk/osport/{z}/{x}/{y}",
                                   {code: 'R', tms: true, maxNativeZoom: 18}),
    };
};

window.mapLayers = layers;
