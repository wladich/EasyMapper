//@require leaflet
//@require leaflet.contextmenu.css
(function(){
    L.Contextmenu = L.Class.extend({
        initialize: function (items) {
            this._visible = false;
            this._items = items;
            this._container = L.DomUtil.create('div', 'leaflet-contextmenu');
            this._container.style.zIndex = 10000;
            this.boundOnMouseDown = this.onMouseDown.bind(this);
        },

        show: function(position){
            if (this.visible) {
                return;
            }
            this._createItems();
            document.body.appendChild(this._container);
            
            L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
            document.body.addEventListener('mousedown', this.boundOnMouseDown, true);
            this._setPosition(position);
            this.visible = true;
        },

        showOnMouseEvent: function(e) {
            if (e.originalEvent) {
                e = e.originalEvent;
            }
            this.show({x: e.clientX, y: e.clientY});
            L.DomEvent.preventDefault(e);
        },

        onMouseDown: function(e) {
            this.hide();
        },

        hide: function() {
            if (!this.visible) {
                return;
            }
            document.body.removeChild(this._container);
            var rows = this._container.children;
            while (rows.length) {
                this._container.removeChild(rows[0]);
            }
            L.DomEvent.off(document, 'keydown', this._onKeyDown);
            document.body.removeEventListener('mousedown', this.boundOnMouseDown, true);
            this.visible = false;
        },

        _createItems: function () {
            var items = this._items,
                itemOptions;
            if (typeof items === 'function') {
                items = items();
            }
            for (var i = 0; i < items.length; i++) {
                itemOptions = items[i];
                if (itemOptions === '-' || itemOptions.separator) {
                    this._createSeparator(itemOptions);
                } else {
                    this._createItem(itemOptions);
                }
            }
        },

        _createItem: function (itemOptions) {
            var el = L.DomUtil.create('a', 'item', this._container);
            el.innerHTML = itemOptions.text;
            var callback = itemOptions.callback;
            if (callback) {
                L.DomEvent.addListener(el, 'mousedown', function(e) {
                    callback();
                    L.DomEvent.stopPropagation(e);
                    this.hide();
                }, this);
            }
        },


        _createSeparator: function (itemOptions) {
            var el = L.DomUtil.create('div', 'separator', this._container);
            if (itemOptions.text)
                el.innerHTML = '<span>' + itemOptions.text + '</span>';
        },

        _setPosition: function (position) {
            var window_width = window.innerWidth;
            var window_height = window.innerHeight;
            var menu_width = this._container.offsetWidth;
            var menu_height  = this._container.offsetHeight;
            var x = (position.x + menu_width < window_width) ? position.x : position.x - menu_width;
            var y = (position.y + menu_height < window_height) ? position.y : position.y - menu_height;

            this._container.style.left = x + 'px';
            this._container.style.top = y + 'px';
        },

        _onKeyDown: function (e) {
            var key = e.keyCode;
            if (key === 27) {
                this.hide();
            }
        }
    });

    L.Mixin.Contextmenu = {
        bindContextmenu: function(items) {
            this._contextMenu = new L.Contextmenu(items);
            this.on('contextmenu', this._contextMenu.showOnMouseEvent, this._contextMenu);
            this.on('remove', this.hideContextmenu, this);
        },

        hideContextmenu: function() {
            this._contextMenu.hide();
        }
    };


    L.Marker.include(L.Mixin.Contextmenu);
})();