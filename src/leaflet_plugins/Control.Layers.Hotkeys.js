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
            var code;
            if (layer.options && (code=layer.options.code) && code.length == 1) {
                var hotkeySpan = L.DomUtil.create('span', 'layers-control-hotkey', label);
                hotkeySpan.innerHTML = ' (' + code +')';
            }
            return label;
        },

        onAdd: function(map) {
            var result = originalOnAdd.call(this, map);
            L.DomEvent.on(document, 'keyup', this._onHotkeyUp, this);
            return result;
        },

        onRemove: function(map) {
            L.DomEvent.off(document, 'keyup', this._onHotkeyUp, this);
            originalOnRemove.call(this, map);

        },

        _onHotkeyUp: function(e) {
            if ('input' == e.target.tagName.toLowerCase()) {
                return;
            }
            var key = String.fromCharCode(e.keyCode);
            for (var layerId in this._layers) {
                var layer = this._layers[layerId];
                if (layer.layer.options.code.toUpperCase() === key) {
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
