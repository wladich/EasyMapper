//@require leaflet
//@require custom_layers.css
//@require leaflet.hash_state
//@require nordeskart.js

(function() {
    'use strict';
    var originalOnAdd = L.Control.Layers.prototype.onAdd;
    var originalAddItem = L.Control.Layers.prototype._addItem;
    var originalunserializeState = L.Control.Layers.prototype._unserializeState;

    L.Control.Layers.include({
            onAdd: function(map) {
                var container = originalOnAdd.call(this, map);
                L.DomEvent.on(container, 'contextmenu', this.showNewLayerForm, this);
                var plusButton = L.DomUtil.create('div', 'custom-layers-add-button', container);
                L.DomEvent.on(plusButton, 'click', this.showNewLayerForm, this);
                return container;
            },

            showLayerForm: function(buttons, fieldValues) {
                if (this.newLayerFormContainer) {
                    return;
                }

                this.newLayerFormContainer =
                    L.DomUtil.create('div', 'custom-layers-dialog-container', this._map._controlContainer);
                if (!L.Browser.touch) {
                    L.DomEvent
                        .disableClickPropagation(this.newLayerFormContainer)
                        .disableScrollPropagation(this.newLayerFormContainer);
                } else {
                    L.DomEvent.on(this.newLayerFormContainer, 'click', L.DomEvent.stopPropagation);
                }

                var form = this.newLayerForm =
                    L.DomUtil.create('form', 'custom-layers-dialog-form', this.newLayerFormContainer);
                L.DomEvent.on(form, 'submit', L.DomEvent.preventDefault);
                var formHtml = [
                    '<p><a href="https://checkvist.com/checklists/568202" target="_blank">Custom layers examples</a></p>' +
                    '<label>Layer name<br/>' +
                    '<input name="name"/></label><br/>' +
                    '<label>Tile url<br/>' +
                    '<textarea name="url" style="width: 100%"></textarea></label><br/>' +
                    '<label><input type="radio" name="overlay" value="no">Base layer</label><br/>' +
                    '<label><input type="radio" name="overlay" value="yes">Overlay</label><br/>' +
                    '<label><input type="checkbox" name="scaleDependent"/>Content depends on scale(like OSM or Google maps)</label><br/>' +
                    '<label><input type="checkbox" name="tms" />TMS rows order</label><br />' +

                    '<label>Max zoom<br>' +
                    '<select name="maxZoom">' +
                    '<option value="9">9</option>' +
                    '<option value="10">10</option>' +
                    '<option value="11">11</option>' +
                    '<option value="12">12</option>' +
                    '<option value="13">13</option>' +
                    '<option value="14">14</option>' +
                    '<option value="15">15</option>' +
                    '<option value="16">16</option>' +
                    '<option value="17">17</option>' +
                    '<option value="18" selected>18</option>' +
                    '</select></label>' +
                    '<br />'
                    // + '<a class="button" name="add">Add layer</a><a class="button" name="cancel">Cancel</a>'
                ];
                var btnCaption, btnCallback, btnCaptions, i, button;
                btnCaptions = Object.keys(buttons);
                for (i = 0; i < btnCaptions.length; i++) {
                    btnCaption = btnCaptions[i];
                    formHtml.push('<a class="button" name="btn-' + i + '">' + btnCaption + '</a>');
                }
                this.newLayerForm.innerHTML = formHtml.join('');

                form.name.value = fieldValues.name;
                form.url.value = fieldValues.url;
                form.tms.checked = fieldValues.tms;
                form.scaleDependent.checked = fieldValues.scaleDependent;
                form.maxZoom.value = fieldValues.maxZoom;
                form.overlay[fieldValues.isOverlay ? 1 : 0].checked = true;

                function buttonClicked(callback) {
                    var fieldValues = {
                        name: form.name.value,
                        url: form.url.value,
                        tms: form.tms.checked,
                        scaleDependent: form.scaleDependent.checked,
                        maxZoom: form.maxZoom.value,
                        isOverlay: form.overlay.value == 'yes'
                    };
                    callback(fieldValues);
                }

                for (i = 0; i < btnCaptions.length; i++) {
                    btnCaption = btnCaptions[i];
                    btnCallback = buttons[btnCaption];
                    button = form.querySelector('[name="btn-' + i + '"]')
                    L.DomEvent.on(button, 'click', buttonClicked.bind(this, btnCallback));
                }
            },

            cancelEdit: function() {
                this.hideLayerForm();
            },

            addLayer: function(fieldValues) {
                var url = fieldValues.url.trim();
                if (!url) {
                    return;
                }
                var serialized = '-cs' + this.serializeValues(fieldValues);
                for (var layerId in this._layers) {
                    if (this._layers[layerId].layer._customSerialized == serialized) {
                        return;
                    }
                }

                var layer = new L.TileLayer(url, {
                        tms: fieldValues.tms,
                        maxNativeZoom: fieldValues.maxZoom,
                        scaleDependent: fieldValues.scaleDependent,
                        print: true,
                        jnx: true,
                        code: serialized,
                        zIndexOffset: fieldValues.isOverlay ? 1000 : 0,
                        noCors: true
                    }
                );
                var name = fieldValues['name'].trim();
                if (fieldValues.isOverlay) {
                    this.addOverlay(layer, name);
                } else {
                    this.addBaseLayer(layer, name);
                    layer.setZIndex(0);
                }
                this._layers[L.stamp(layer)].custom = true;
                layer._fieldValues = fieldValues;
                this.hideLayerForm();
                this._update();
                if (window.Storage && window.localStorage) {
                    localStorage.setItem(serialized, '1');
                    layer._customSerialized = serialized;
                }
                return layer;
            },

            _addItem: function(obj) {
                var label = originalAddItem.call(this, obj);
                if (obj.custom) {
                    var editButton = L.DomUtil.create('div', 'custom-layer-edit-button', label);
                    editButton._layer = obj.layer;
                    L.DomEvent.on(editButton, 'click', this.onEditButtonClicked, this);
                }
                return label;
            },

            changeLayer: function(layer, newFieldValues) {
                var layerVisible = this._map.hasLayer(layer);
                this.removeLayer(layer);
                this._map.removeLayer(layer);
                if (window.Storage && window.localStorage) {
                    localStorage.removeItem(layer._customSerialized);
                }
                var newLayer = this.addLayer(newFieldValues);
                if (layerVisible) {
                    setTimeout(function() {
                            this._map.addLayer(newLayer);
                        }.bind(this), 10
                    );
                }
            },

            removeCustomLayer: function(layer) {
                if (window.Storage && window.localStorage) {
                    localStorage.removeItem(layer._customSerialized);
                }
                if (this._map.hasLayer(layer)) {
                    this._map.removeLayer(layer);
                    if (!layer._fieldValues.isOverlay) {
                        for (var k in this._layers) {
                            if (!this._layers[k].overlay) {
                                this._map.addLayer(this._layers[k].layer);
                                break
                            }
                        }
                    }
                }
                this.removeLayer(layer);
                this.hideLayerForm();
            },

            onEditButtonClicked: function(e) {
                if (this.newLayerFormContainer) {
                    return;
                }
                var layer = e.target._layer;
                this.showLayerForm({
                        'Save': this.changeLayer.bind(this, layer),
                        'Delete': this.removeCustomLayer.bind(this, layer),
                        'Cancel': this.cancelEdit.bind(this)
                    }, layer._fieldValues
                );
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
            },

            hideLayerForm: function() {
                if (!this.newLayerFormContainer) {
                    return;
                }
                this.newLayerFormContainer.parentNode.removeChild(this.newLayerFormContainer);
                this.newLayerFormContainer = null;
            },

            showNewLayerForm: function(e) {
                L.DomEvent.stop(e);
                this.showLayerForm({
                        'Add layer': this.addLayer.bind(this),
                        'Cancel': this.cancelEdit.bind(this)
                    }, {
                        name: 'Custom layer',
                        url: '',
                        tms: false,
                        maxZoom: 18,
                        isOverlay: false,
                        scaleDependent: false
                    }
                );
            },

            serializeValues: function(fieldValues) {
                var s = JSON.stringify(fieldValues);

                function encodeUrlSafeBase64(s) {
                    return (btoa(s)
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=+$/, '')
                    );
                }

                return encodeUrlSafeBase64(s);
            },

            tryLoadFromString: function (s) {
                var m, fieldValues;
                m = s.match(/^-cs(.+)$/);
                if (m && m[1] !== undefined) {
                    s = m[1].replace(/-/g, '+').replace(/_/g, '/');
                    try {
                        s = atob(s);
                        fieldValues = JSON.parse(s);
                    this.addLayer(fieldValues);
                    } catch (e) {}
                }
            },

            _unserializeState: function(values) {
                var i;
                for (i = 0; i < values.length; i++) {
                    this.tryLoadFromString(values[i]);
                }
                return originalunserializeState.call(this, values);
            },

            loadCustomLayers: function() {
                if (!(window.Storage && window.localStorage)) {
                    return;
                }

                var i, key, m, fieldValues, s;
                for (i = 0; i < localStorage.length; i++) {
                    key = localStorage.key(i);
                    this.tryLoadFromString(key)
                }
            }
        }
    );

})();