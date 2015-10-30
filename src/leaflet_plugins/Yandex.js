//@require leaflet


(function() {
    'use strict';

    var yandexCrs = L.CRS.EPSG3395;

    L.Yandex = L.TileLayer.extend({
        options: {
            subdomains: '1234'
        },

        initialize: function(mapType, options) {
            var url;
            this._mapType = mapType;
            if (mapType == 'sat') {
                url = 'https://sat03.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}';
            } else {
                url = 'https://vec0{s}.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}';
            }

            L.TileLayer.prototype.initialize.call(this, url, options);
        },

        _adjustTilePoint: function(tilepoint) {
            L.TileLayer.prototype._adjustTilePoint.call(this, tilepoint);
            var tileSize = this._getTileSize(),
                zoom = this._map.getZoom();
            var refPoint = tilepoint.multiplyBy(tileSize).add([tileSize / 2, tileSize / 2]);
            refPoint = this._map.unproject(refPoint);
            refPoint = yandexCrs.latLngToPoint(refPoint, zoom);
            var tilepointYandex = refPoint.divideBy(tileSize)._floor();
            tilepoint.x = tilepointYandex.x;
            tilepoint.y = tilepointYandex.y;
        },

        _getYandexTilePos: function(tilePoint) {
            var origin = this._map.getPixelOrigin(),
                tileSize = this._getTileSize(),
                zoom = this._map.getZoom();
            var tileTopLeft = tilePoint.multiplyBy(tileSize);
            tileTopLeft = yandexCrs.pointToLatLng(tileTopLeft, zoom);
            tileTopLeft = this._map.project(tileTopLeft);
            return tileTopLeft.subtract(origin).round();
        },

        _getTilePos: function(tilePoint) {
            var tilePoint2 = L.point([tilePoint.x, tilePoint.y]);
            this._adjustTilePoint(tilePoint2);
            return this._getYandexTilePos(tilePoint2);
        },

        _addTile: function(tilePoint, container) {
            var origTilepointX = tilePoint.x,
                origTilepointY = tilePoint.y;
            L.TileLayer.prototype._addTile.call(this, tilePoint, container);
            var tile = this._tiles[origTilepointX + ':' + origTilepointY];
            var belowTilePoint = L.point(tilePoint.x, tilePoint.y + 1);
            var height = this._getYandexTilePos(belowTilePoint).y - this._getYandexTilePos(tilePoint).y;
            tile.style.height = height + 'px';
        }
    });
})();