//@require leaflet
//@require custom_layers.css

(function() {
    'use strict';
    var originalOnAdd = L.Control.Layers.prototype.onAdd;

    L.Control.Layers.include({
        onAdd: function(map) {
            var container = originalOnAdd.call(this, map);
            L.DomEvent.on(container, 'contextmenu', this.onRightClick, this);
            return container;
        },

        createNewLayerForm: function() {
            this.newLayerFormContainer = L.DomUtil.create('div', 'custom-layers-dialog-container', this._map._controlContainer);
            if (!L.Browser.touch) {
                L.DomEvent
                    .disableClickPropagation(this.newLayerFormContainer)
                    .disableScrollPropagation(this.newLayerFormContainer);
            } else {
                L.DomEvent.on(this.newLayerFormContainer, 'click', L.DomEvent.stopPropagation);
            }

            this.newLayerForm = L.DomUtil.create('form', 'custom-layers-dialog-form', this.newLayerFormContainer);
            this.newLayerForm.innerHTML =
                '<label>Tile url<br/>' +
                '<textarea name="url" style="width: 100%"></textarea></label><br/>' +
                '<label>Layer name<br/>' +
                '<input name="name" value="Custom layer"/></label><br/>' +
                '<label><input type="radio" name="overlay" value="no" checked>Base layer</label><br/>' +
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
                '<br /><a class="button" name="add">Add layer</a><a class="button" name="cancel">Cancel</a>';
            var buttonAdd = (this.newLayerForm.querySelector('a[name="add"]'));
            var buttonCancel = (this.newLayerForm.querySelector('a[name="cancel"]'));
            L.DomEvent.addListener(buttonAdd, 'click', this.onButtonAddClicked, this);
            L.DomEvent.addListener(buttonCancel, 'click', this.removeNewLayerForm, this);
        },

        onButtonAddClicked: function() {
            console.log(this.newLayerForm.elements['name']);
            console.log(this.newLayerForm.elements['url']);
            var e = this.newLayerForm.elements,
                url = e['url'].value,
                name = e['name'].value,
                isTms = e['tms'].checked,
                isOverlay = e['overlay'].value === 'yes',
                maxZoom = +e['maxZoom'].value,
                scaleDependent = e['scaleDependent'].checked;
            if (url) {
                var layer = new L.TileLayer(url, {
                    tms: isTms,
                    maxNativeZoom: maxZoom,
                    scaleDependent: scaleDependent,
                    print: true,
                    jnx: true
                });
                if (isOverlay) {
                    this.addOverlay(layer, name);
                } else {
                    this.addBaseLayer(layer, name);
                }
                this.removeNewLayerForm();
            }
        },

        removeNewLayerForm: function() {
            this.newLayerFormContainer.parentNode.removeChild(this.newLayerFormContainer);
            this.newLayerFormContainer = null;
        },

        onRightClick: function(e) {
            L.DomEvent.stop(e);
            this.createNewLayerForm();
        }

    });


})();