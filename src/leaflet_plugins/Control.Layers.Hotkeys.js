//@require leaflet
//@require Control.Layers.Hotkeys.css
(function(){
    "use strict";
    var originalOnAdd = L.Control.Layers.prototype.onAdd;
    var originalOnRemove = L.Control.Layers.prototype.onRemove;
    var originalAddItem = L.Control.Layers.prototype._addItem;
    
    L.Control.Layers.include({
        _addItem: function (obj) {
            var label = originalAddItem.call(this, obj);
            var layerId = label.getElementsByTagName('input')[0].layerId;
            var layer = this._layers[layerId].layer;
            var code = layer.options.code;
            if (code.length === 1) {
                var hotkeySpan = L.DomUtil.create('span', 'layers-control-hotkey', label);
                hotkeySpan.innerHTML = ' (' + code +')';
            }
            return label;
        },

        onAdd: function(map) {
            var result = originalOnAdd.call(this, map);
            L.DomEvent.on(document, 'keypress', this._onHotkeyPress, this);
            return result;
        },

        oninRemove: function(map) {
            L.DomEvent.off(document, 'keypress', this._onHotkeyPress, this);
            originalOnRemove.call(this, map);

        },

        _onHotkeyPress: function(e) {
            var key = String.fromCharCode(e.charCode);
            for (var layerId in this._layers) {
                var layer = this._layers[layerId];
                if (layer.layer.options.code.toLowerCase() === key) {
                    var inputs = this._form.getElementsByTagName('input');
                    for (var j in inputs) {
                        var input = inputs[j];
                        if (input.layerId == layerId) {
                            input.click();
                            break;
                        }
                    }
                    break;
                }
            }
        }

    });

})();