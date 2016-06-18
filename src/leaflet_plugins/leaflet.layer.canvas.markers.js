//@require rbush
//@require leaflet

(function() {
    'use strict';

    /*
     Marker definition:
     {
     latlng: L.Latlng,
     icon: {url: string, center: [x, y]} or function(marker) returning icon,
     label: sting,
     any other fields
     }
     */


    L.TileLayer.Markers = L.TileLayer.Canvas.extend({
            initialize: function(markers) {
                this.rtree = rbush(9, ['.latlng.lng', '.latlng.lat', '.latlng.lng', '.latlng.lat']);
                this.addMarkers(markers);
                this._images = {};
            },

            addMarkers: function(markers) {
                if (markers) {
                    this.rtree.load(markers);
                }
                this.redraw();
            },

            drawMarker: function(canvas, p, icon, marker) {
                var ctx = canvas.getContext('2d'),
                    img = this._images[icon.url].img,
                    x = p.x - icon.center[0],
                    y = p.y - icon.center[1];
                x = Math.round(x);
                y = Math.round(y);
                ctx.drawImage(img, x, y);
            },

            loadIconImage: function(url) {
                var img = new Image(),
                    self = this;
                img.onload = function() {
                    var imageRec = self._images[url],
                        i, job;
                    imageRec.img = img;
                    imageRec.loaded = true;
                    for (i = 0; i < imageRec.queue.length; i++) {
                        job = imageRec.queue[i];
                        self.drawMarker.apply(self, job);
                    }
                };
                img.src = url;
            },

            drawTile: function(canvas, tilePoint, zoom) {
                console.time('draw tile ' + tilePoint.x + ',' + tilePoint.y);
                var bounds = this._getTileBounds(tilePoint, zoom);
                bounds = bounds.pad(1);
                var markers = this.rtree.search([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
                var marker, p, icon, image;
                for (var i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    p = this._map.project(marker.latlng, zoom);
                    p = p.subtract(this._getTileProjectedOrigin(tilePoint));
                    icon = marker.icon;
                    if (typeof icon === 'function') {
                        icon = icon(marker);
                    }
                    if (icon.url in this._images) {
                        image = this._images[icon.url];
                        if (image.loaded) {
                            this.drawMarker(canvas, p, icon, marker);
                        } else {
                            image.queue.push([canvas, p, icon, marker]);
                        }
                    } else {
                        this._images[icon.url] = {
                            loaded: false,
                            queue: [[canvas, p, icon, marker]]
                        };
                        this.loadIconImage(icon.url);
                    }
                }
                console.timeEnd('draw tile ' + tilePoint.x + ',' + tilePoint.y);
                return this;
            },

            _getTileProjectedOrigin: function(tilePoint) {
                return tilePoint.multiplyBy(this.options.tileSize);
            },

            _getTileBounds: function(tilePoint, zoom) {
                var size = this.options.tileSize,
                    nw = tilePoint.multiplyBy(size),
                    se = nw.add([size, size]),
                    bounds = L.latLngBounds(this._map.unproject(se, zoom), this._map.unproject(nw, zoom));
                return bounds;

            }
        }
    );
})();