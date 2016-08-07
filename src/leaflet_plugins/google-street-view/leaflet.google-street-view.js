//@require leaflet
//@require leaflet.google
//@require leaflet.google-street-view.css

(function() {
    'use strict';

    L.GoogleStreetView = L.TileLayer.extend({
        initialize: function(panoramaContainerId, options) {
            L.TileLayer.prototype.initialize.call(this,
                'https://mts1.googleapis.com/vt?lyrs=svv|cb_client:apiv3&style=40,18&x={x}&y={y}&z={z}',
                options);
            this.container = document.getElementById(panoramaContainerId);
            this.svService = new google.maps.StreetViewService();
            this.panorama = new google.maps.StreetViewPanorama(this.container, {
                enableCloseButton: true,
                imageDateControl: true
            });
            this.panorama.addListener('position_changed', this.onPanoramaChangePosition.bind(this));
            this.panorama.addListener('pov_changed', this._onPanoramaChangeView.bind(this));
            this.panorama.addListener('pano_changed', this._showPanorama.bind(this));
            this.panorama.addListener('closeclick', this._hidePanorama.bind(this));
            var icon = L.divIcon({
                className: 'gsv-camera-container',
                html: '<div class="gsv-camera"></div>'
            });
            this.marker = L.marker([0, 0], {
                icon: icon
            });
            //this.camera-icon = 
        },


        _onPanoramaChangeView: function() {
            var el = this.marker._icon.getElementsByTagName('div')[0];
            var angle = this.panorama.getPov()['heading'];
            el.style.transform = 'rotate(' + angle + 'deg)';
        },

        _showPanorama: function() {
            this.container.style.display = 'block';
            this.panorama.setVisible(true);
            window.dispatchEvent(new Event('resize'));
            this.marker.addTo(this._map);
            this._onPanoramaChangeView();
        },

        _hidePanorama: function() {
            this.container.style.display = 'none';
            window.dispatchEvent(new Event('resize'));
            this._map.removeLayer(this.marker);
        },

        onAdd: function(map) {
            L.TileLayer.prototype.onAdd.call(this, map);
            map.on('click', this.onMapClick, this);
        },

        onRemove: function(map) {
            this._hidePanorama();
            L.TileLayer.prototype.onRemove.call(this, map);
            map.off('click', this.onMapClick, this);

        },

        onMapClick: function(e) {
            var ll1 = e.latlng;
            var ll2 = this._map.containerPointToLatLng(e.containerPoint.add([24, 0]));
            var radius = ll1.distanceTo(ll2);
            console.log(radius);
            this.svService.getPanorama({
                location: e.latlng,
                radius: radius,
                preference: google.maps.StreetViewPreference.NEAREST
            }, function(panoData, status) {
                if (status == google.maps.StreetViewStatus.OK) {
                    this.panorama.setPosition(panoData.location.latLng);
                }
            }.bind(this));
        },

        onPanoramaChangePosition: function() {
            var pos = this.panorama.getPosition();
            if (pos) {
                pos = L.latLng([pos.lat(), pos.lng()]);
                this.marker.setLatLng(pos);
                if (!this._map.getBounds().contains(pos)) {
                    this._map.panTo(pos);
                }
            }
        }

    });

})();