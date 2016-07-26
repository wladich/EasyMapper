//@require leaflet
//@require leaflet.control.elevation-profile.css
(function() {
    'use strict';

    function createSvg(tagName, attributes, parent) {
        var element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        if (attributes) {
            var keys = Object.keys(attributes),
                key, value;
            for (var i = 0; i < keys.length; i++) {
                key  = keys[i];
                value = attributes[key];
                element.setAttribute(key, value);
            }
        }
        if (parent) {
            parent.appendChild(element);
        }
        return element;
    }

    L.Control.ElevationProfile = L.Class.extend({
            initialize: function(path, options) {
                L.setOptions(this, options);
                this.values = [1,2,3,4,5,6,7,8,9,10,8,5,2,2,6,7];
            },

            addTo: function(map) {
                this._map = map;
                var container = L.DomUtil.create('div', 'elevation-profile-container');
                this._map._controlContainer.appendChild(container);
                this.propsContainer = L.DomUtil.create('div', 'elevation-profile-properties', container);
                this.graphContainer = L.DomUtil.create('div', 'elevation-profile-graph', container);
                this.updatePropsDisplay();
                this.setupGraph();
                return this;
            },

            removeFrom: function(map) {
                this._map._controlContainer.removeChild(this._container);
                this._map = null;
                this.onRemove(map);
                return this;
            },


            updatePropsDisplay: function() {
                if (!this._map) {
                    return;
                }
                this.propsContainer.innerHTML =
                    '<table>' +
                        '<tr><td>Max elevation:</td><td></td></tr>' +
                        '<tr><td>Min elevation:</td><td></td></tr>' +
                        '<tr><td>Ascent:</td><td></td></tr>' +
                        '<tr><td>Descent:</td><td></td></tr>' +
                    '</table>'
            },

            setupGraph: function() {
                if (!this._map) {
                    return;
                }
                var i, x, y, line, path;
                var svg = createSvg('svg', {width: '100%', 'height': '100%'}, this.graphContainer);
                var width = this.graphContainer.offsetWidth;
                var height = this.graphContainer.offsetHeight;
                var step = height / 5;
                for (i = 0; i < 5; i++) {
                    y = i * step;
                    y = Math.round(y);
                    path = L.Util.template('M0 {y} L{w} {y}', {y: y, w: width});
                    createSvg('path', {d: path, "stroke-width": "1", stroke: "green", fill: 'none'}, svg);
                    // line = createSvg(path);
                    // line

                }


                // var step = width / this.values.length;
                // var range = Math.max(this.values) - Math.min(this.values);
                // var verticalMultiplier = height / m



            },

            onRemove: function(map) {

            }

        }
    );

})();