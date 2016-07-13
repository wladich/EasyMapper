//@require leaflet
//@require leaflet.contextmenu
//@require fileutils

(function() {
    'use strict';

    L.Control.Coordinates = L.Control.extend({
            options: {
                position: 'bottomleft'
            },

            onAdd: function(map) {
                this._map = map;
                var container = this._container = L.DomUtil.create('div', 'leaflet-control leaflet-control-coordinates');
                this._field_lat = L.DomUtil.create('div', 'leaflet-control-coordinates-text', container);
                this._field_lon = L.DomUtil.create('div', 'leaflet-control-coordinates-text', container);
                L.DomEvent
                    .on(container, 'dblclick', L.DomEvent.stop)
                    .on(container, 'click', this.onClick, this);
                map.on('mousemove', this.onMouseMove, this);
                this.menu = new L.Contextmenu([
                        {text: 'Click to copy to clipboard', callback: this.prepareForClickOnMap.bind(this)},
                        '-',
                        {text: 'ddd.ddddd&deg;', callback: this.onMenuSelect.bind(this, 'D')},
                        {text: 'ddd&deg;mm.mmm\'', callback: this.onMenuSelect.bind(this, 'DM')},
                        {text: 'ddd&deg;mm\'ss.s"', callback: this.onMenuSelect.bind(this, 'DMS')}
                    ]
                );
                this.loadStateFromStorage();
                this.onMouseMove();
                L.DomEvent.on(container, 'contextmenu', this.onRightClick, this);
                return container;
            },

            loadStateFromStorage: function() {
                var active = false,
                    fmt = 'D';
                if (window.Storage && window.localStorage) {
                    active = localStorage.leafletCoordinatesActive === '1';
                    fmt = localStorage.leafletCoordinatesFmt || fmt;
                }
                this.setEnabled(active);
                this.setFormat(fmt);
            },

            saveStateToStorage: function() {
                if (!(window.Storage && window.localStorage)) {
                    return;
                }
                localStorage.leafletCoordinatesActive = this.isEnabled() ? '1' : '0';
                localStorage.leafletCoordinatesFmt = this.fmt;
            },

            formatCoodinate: function(value, isLat) {
                function pad(s, n) {
                    var j = s.indexOf('.');
                    if (j === -1) {
                        j = s.length;
                    }
                    var zeroes = (n - j);
                    if (zeroes > 0) {
                        s = Array(zeroes + 1).join('0') + s;
                    }
                    return s;
                }
                var h, d, m, s;
                if (isLat) {
                    if (value < 0) {
                        h = 'S';
                    } else {
                        h = 'N';
                    }
                } else {
                    if (value < 0) {
                        h = 'W';
                    } else {
                        h = 'E';
                    }
                }
                value = Math.abs(value);
                if (this.fmt == 'D') {
                    d = value.toFixed(5);
                    d = pad(d, isLat ? 2 : 3);
                    return L.Util.template('{h} {d}&deg;', {h: h, d: d});
                }
                if (this.fmt == 'DM') {
                    d = Math.floor(value).toString();
                    d = pad(d, isLat ? 2 : 3);
                    m = ((value - d) * 60).toFixed(3);
                    m = pad(m, 2);
                    return L.Util.template('{h} {d}&deg;{m}\'', {h: h, d: d, m: m});
                }
                if (this.fmt == 'DMS') {
                    d = Math.floor(value).toString();
                    d = pad(d, isLat ? 2 : 3);
                    m = Math.floor((value - d) * 60).toString();
                    m = pad(m, 2);
                    s = ((value - d - m / 60) * 3600).toFixed(2);
                    s = pad(s, 2);
                    return L.Util.template('{h} {d}&deg;{m}\'{s}"', {h: h, d: d, m: m, s: s});
                }
            },

            onMenuSelect: function(fmt) {
                this.setFormat(fmt);
                this.saveStateToStorage();
            },

            setFormat: function(fmt) {
                this.fmt = fmt;
                this.onMouseMove();
            },

            onMouseMove: function(e) {
                if (!this.isEnabled()) {
                    return;
                }
                var latlng = e ? e.latlng : this._map.getCenter();
                this._field_lat.innerHTML = this.formatCoodinate(latlng.lat, true);
                this._field_lon.innerHTML = this.formatCoodinate(latlng.lng, false);
            },

            setEnabled: function(enabled) {
                if (enabled) {
                    L.DomUtil.addClass(this._container, 'expanded');
                    L.DomUtil.addClass(this._map._container, 'coordinates-control-active');
                } else {
                    L.DomUtil.removeClass(this._container, 'expanded');
                    L.DomUtil.removeClass(this._map._container, 'coordinates-control-active');
                }
            },

            isEnabled: function() {
                return L.DomUtil.hasClass(this._container, 'expanded');
            },

            onClick: function(e) {
                this.setEnabled(!this.isEnabled());
                this.saveStateToStorage();
                this.onMouseMove();
            },

            onRightClick: function(e) {
                this.menu.showOnMouseEvent(e);
            },

            onMapClick: function(e) {
                console.log('2');
                var s = this.formatCoodinate(e.latlng.lat, true) + ' ' + this.formatCoodinate(e.latlng.lng, false);
                s = s.replace(/&deg;/g, '°');
                fileutils.copyToClipboard(s, e.originalEvent);
            },

            prepareForClickOnMap: function() {
                console.log('1');
                this._map.once('click', this.onMapClick, this);
            }



            // TODO: onRemove

        }
    );
})();
