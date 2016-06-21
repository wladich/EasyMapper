//@require leaflet
//@require leaflet.google
//@require leaflet.bing
//@require leaflet_plugins/leaflet.soviet-topomaps-grid.js
//@require leaflet_plugins/leaflet.wikimapia.js
//@require leaflet_plugins/google-street-view/leaflet.google-street-view.js
//@require leaflet.yandex
//@require leaflet_plugins/leaflet.layer.westra/westraPasses.js
window.layers = {};


window.layers.getBaseMaps = function getBaseMaps() {
    var bingKey = 'AhZy06XFi8uAADPQvWNyVseFx4NHYAOH-7OTMKDPctGtYo86kMfx2T0zUrF5AAaM';
    return {
        'OpenStreetMap': L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                     {code: 'O', scaleDependent: true}),
        'ESRI Sat': L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                                {code: 'E', maxNativeZoom: 17}),
        'Yandex': new L.Yandex('map', {scaleDependent: true, code: 'Y'}),
        'Yandex Sat': new L.Yandex('sat', {scaleDependent: false, code: 'S'}),
        'Google': new L.Google('ROADMAP', {code: 'G', scaleDependent: true}),
        'Google Sat': new L.Google('SATELLITE', {code: 'L'}),
        'Google Sat Hybrid': new L.Google('HYBRID', {code: 'H', scaleDependent: true}),
        'Bing Sat': L.bingLayer(bingKey, {code: 'I'}),
        'marshruty.ru': L.tileLayer('http://maps.marshruty.ru/ml.ashx?x={x}&y={y}&z={z}&i=1&al=1',
                                      {code: 'M', maxNativeZoom: 18, noCors: true, scaleDependent: true}),
        'Topomapper 1km': L.tileLayer('http://144.76.234.107//cgi-bin/ta/tilecache.py/1.0.0/topomapper_v2/{z}/{x}/{y}.jpg',
                                      {code: 'T', maxNativeZoom: 13, noCors: true}),
    };
};

window.layers.getOverlays = function getOverlays() {
    return {
        "Poehali 10km": new L.TileLayer("http://{s}.tiles.nakarte.tk/poehali001m/{z}/{x}/{y}",
                                        {code: 'D', tms: true, maxNativeZoom: 9}),
        "ArbaletMO": new L.TileLayer("http://{s}.tiles.nakarte.tk/ArbaletMO/{z}/{x}/{y}",
                                     {code: 'A', tms: true, maxNativeZoom: 13}),
        "Slazav mountains": new L.TileLayer("http://{s}.tiles.nakarte.tk/map_hr/{z}/{x}/{y}",
                                      {code: 'Q', tms: true, maxNativeZoom: 13}),
        "GGC 1km": new L.TileLayer("http://{s}.tiles.nakarte.tk/ggc1000/{z}/{x}/{y}",
                                   {code: 'J', tms: true, maxNativeZoom: 13}),
        "Topo 1km": new L.TileLayer("http://{s}.tiles.nakarte.tk/topo1000/{z}/{x}/{y}",
                                    {code: 'C', tms: true, maxNativeZoom: 13}),
        "GGC 500m": new L.TileLayer("http://{s}.tiles.nakarte.tk/ggc500/{z}/{x}/{y}",
                                   {code: 'F', tms: true, maxNativeZoom: 14}),
        "Topo 500m": new L.TileLayer("http://{s}.tiles.nakarte.tk/topo500/{z}/{x}/{y}",
                                   {code: 'B', tms: true, maxNativeZoom: 14}),
        "GGC 250m": new L.TileLayer("http://{s}.tiles.nakarte.tk/ggc250/{z}/{x}/{y}",
                                   {code: 'K', tms: true, maxNativeZoom: 15}),
        "Slazav map": new L.TileLayer("http://{s}.tiles.nakarte.tk/map_podm/{z}/{x}/{y}",
                                      {code: 'Z', tms: true, maxNativeZoom: 14}),
        "O-sport": new L.TileLayer("http://{s}.tiles.nakarte.tk/osport/{z}/{x}/{y}",
                                   {code: 'R', tms: true, maxNativeZoom: 17}),
        "Soviet military grid": new L.SovietTopoGrid({code: 'Ng'}),
        "Wikimapia": new L.Wikimapia({code: 'W'}),
        "Google Street View": new L.GoogleStreetView('street-view'),
        "Mountain passes (Westra)": new L.WestraPasses('/westraPasses/')
    };
};

window.mapLayers = layers;
