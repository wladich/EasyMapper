//@require leaflet
window.layers = {};

window.layers.getBaseMaps = function getBaseMaps() {
    return {
            'OpenStreetMap': L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
    };
};

window.layers.getOverlays = function getOverlays() {
    return {
            "Slazav map": new L.TileLayer("http://tiles.wladich.tk/map_podm/{z}/{x}/{y}", {tms: true, minZoom: 0, maxZoom: 18, maxNativeZoom: 14})
    };
};

window.mapLayers = layers;
