//@require leaflet
//@require leaflet.hash_state.js

(function() {
    L.Control.Layers.include(L.Mixin.HashState);

    L.Control.Layers.include({
        stateChangeEvents: ['baselayerchange', 'overlayadd', 'overlayremove'],
        stateChangeEventsSource: '_map',
        
        _serializeState: function(e){
            var state = [];
            for (var layer_id in this._map._layers) {
                var layer = this._map._layers[layer_id];
                var isControlled = layer_id in this._layers;
                var isOverlay = isControlled && this._layers[layer_id].overlay;
                var isStale = isControlled && e && e.type == 'baselayerchange' && !isOverlay && layer != e.layer;
                if (isControlled && !isStale && layer.options && layer.options.code) {
                    layer_id = layer.options.code || layer_id;
                    state.push(layer_id);
                }
            }
            return state;
        },
        
        _unserializeState: function(values){
            if (!values || values.length === 0) {
                return false;
            }
            
            var layer,
                layer_id,
                i,
                new_layers = [];
            for (i in values) {
                layer_id = parseInt(values[i], 10);
                if (isNaN(layer_id)) {
                    for (layer_id in this._layers) {
                        layer = this._layers[layer_id].layer;
                        if (layer.options.code == values[i]) {
                            break;
                        }
                        layer = null;
                    }
                } else {
                    layer = this._layers[layer_id].layer;
                }
                if (layer && (!(layer in new_layers))) {
                    new_layers.push(layer);
                }
            }
            if (new_layers.length) {
                for (layer_id in this._map._layers) {
                    var isControlled = layer_id in this._layers;
                    if (isControlled) {
                        this._map.removeLayer(this._map._layers[layer_id]);
                    }
                }
                for (i in new_layers) {
                    this._map.addLayer(new_layers[i]);
                }
                return true;
            }
        }
    });
})();
