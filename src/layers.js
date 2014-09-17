//@require leaflet
//@require vendor/shramov/Yandex.js
window.layers = {};

window.layers.getBaseMaps = function getBaseMaps() {
    return {
        'OpenStreetMap': L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        'ESRI Sat': L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',             {maxNativeZoom: 17}),
        'Yandex': new L.Yandex('map', {yandexMapAutoSwitch: false, 'scaleDependent': true}),
        'Yandex Public': new L.Yandex('publicMap', {'scaleDependent': true}),
        'Yandex Sat': new L.Yandex('satellite'),

        'Topomapper 2km': L.tileLayer('http://maps.atlogis.com/cgi-bin/tilecache-2.11/tilecache.py/1.0.0/topomapper_gmerc/{z}/{x}/{y}.jpg', {maxNativeZoom: 12})
    };
};

window.layers.getOverlays = function getOverlays() {
    return {
        "Poehali 10km": new L.TileLayer("http://tiles.wladich.tk/poehali001m/{z}/{x}/{y}", {tms: true, maxNativeZoom: 9}),
        "ArbaletMO": new L.TileLayer("http://tiles.wladich.tk/ArbaletMO/{z}/{x}/{y}",      {tms: true, maxNativeZoom: 13}),
        "topo500": new L.TileLayer("http://tiles.wladich.tk/topo500/{z}/{x}/{y}",          {tms: true, maxNativeZoom: 14}),
        "topo1000": new L.TileLayer("http://tiles.wladich.tk/topo1000/{z}/{x}/{y}",        {tms: true, maxNativeZoom: 13}),
        "Slazav map": new L.TileLayer("http://tiles.wladich.tk/map_podm/{z}/{x}/{y}",      {tms: true, maxNativeZoom: 14}),
        "O-sport": new L.TileLayer("http://tiles.wladich.tk/osport/{z}/{x}/{y}",           {tms: true, maxNativeZoom: 18}),
    };
};

window.mapLayers = layers;
