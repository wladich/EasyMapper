//@require leaflet
//@require papersheet_feature.css

(function(){
    "use strict";
    L.PaperSheet = L.Marker.extend({
        initialize: function(latlng, paperSize, scale, label){
            this.paperSize = paperSize;
            this.scale = scale;
            var icon = L.divIcon({className: "paper-sheet-label", html: label});
            L.Marker.prototype.initialize.call(this, latlng, {
                icon: icon,
                draggable: true,
                title: 'Left click to rotate, right click for menu'});
            this.on('drag', this.updateSize, this);
        },

        onAdd: function(map){
            L.Marker.prototype.onAdd.call(this, map);
            map.on('viewreset', this.updateSize, this);
            this.updateSize();
        },
        
        onRemove: function(map) {
            map.off('viewreset', this.updateSize, this);
            L.Marker.prototype.onRemove.call(this, map);
        },
        
       
        getLatLngBounds: function() {
            var latlng = this.getLatLng(),
                lng = latlng.lng,
                lat = latlng.lat;
            var width = this.paperSize[0] * this.scale / 10 / 111319.49 / Math.cos(lat * Math.PI / 180);
            var height = this.paperSize[1] * this.scale / 10 / 111319.49;
            var latlng_sw = [lat - height / 2, lng - width / 2];
            var latlng_ne = [lat + height / 2, lng + width / 2];
            return L.latLngBounds([latlng_sw, latlng_ne]);
        },

        _animateZoom: function(e) {
            L.Marker.prototype._animateZoom.call(this, e);
            this._updateSize(e.zoom);
        },

        updateSize: function() {
            this._updateSize();
        },

        _updateSize: function(newZoom){
            if (this._map) {
                var bounds = this.getLatLngBounds();
                var pixel_sw = this._map.project(bounds.getSouthWest(), newZoom);
                var pixel_ne = this._map.project(bounds.getNorthEast(), newZoom);
                var pixel_center = this._map.project(this.getLatLng(), newZoom);
                var st = this._icon.style;
                var pixel_width = pixel_ne.x - pixel_sw.x;
                var pixel_height = pixel_sw.y - pixel_ne.y;
                st.width = pixel_width + 'px';
                st.height = pixel_height + 'px';
                st.marginLeft = (pixel_sw.x - pixel_center.x) + 'px';
                st.marginTop = (pixel_ne.y - pixel_center.y) + 'px';
                st.fontSize = Math.min(pixel_width, pixel_height, 500) / 2 + 'px';
                st.lineHeight = pixel_height + 'px';
            }
        },
    });
})();
