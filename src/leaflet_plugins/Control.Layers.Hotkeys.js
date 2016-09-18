//@require leaflet
//@require Control.Layers.Hotkeys.css
(function(){
    'use strict';
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
                hotkeySpan.innerHTML = code;
            }
            return label;
        },

        onAdd: function(map) {
            var result = originalOnAdd.call(this, map);
            L.DomEvent.on(document, 'keyup', this._onHotkeyUp, this);
            L.DomEvent.on(document, 'keydown', this.onKeyDown, this);
            return result;
        },

        onRemove: function(map) {
            L.DomEvent.off(document, 'keyup', this._onHotkeyUp, this);
            L.DomEvent.off(document, 'keydown', this.onKeyDown, this);
            originalOnRemove.call(this, map);

        },

        onKeyDown: function(e) {
            if (e.altKey || e.ctrlKey || e.shiftKey) {
                return;
            }
            this._keyDown = e.keyCode;
        },

        _onHotkeyUp: function(e) {
            var pressedKey = this._keyDown;
            this._keyDown = null;
            var tagName = e.target.tagName.toLowerCase();
            if ('input' ==  tagName|| 'textarea' == tagName|| pressedKey != e.keyCode) {
                return;
            }
            var key = String.fromCharCode(e.keyCode);
            for (var layerId in this._layers) {
                var layer = this._layers[layerId];
                if (layer.layer.options && layer.layer.options.code &&  layer.layer.options.code.toUpperCase() === key) {
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
