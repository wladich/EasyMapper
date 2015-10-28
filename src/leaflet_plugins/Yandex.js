/* copied from https://github.com/shramov/leaflet-plugins @1e8779ef1f */
//@require leaflet
//@require yandex-api

/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

/* global ymaps: true */

L.Yandex = L.Class.extend({
	includes: L.Mixin.Events,

	yandexAnimationOptions: {duration: 250, delay: 0, timingFunction: 'cubic-bezier(0,0,0.25,1)'},

	options: {
		minZoom: 0,
		maxZoom: 18,
		attribution: '',
		opacity: 1,
		traffic: false
	},

	possibleShortMapTypes: {
		schemaMap: 'map',
		satelliteMap: 'satellite',
		hybridMap: 'hybrid',
		publicMap: 'publicMap',
		publicMapInHybridView: 'publicMapHybrid'
	},
	
	_getPossibleMapType: function (mapType) {
		var result = 'yandex#map';
		if (typeof mapType !== 'string') {
			return result;
		}
		for (var key in this.possibleShortMapTypes) {
			if (mapType === this.possibleShortMapTypes[key]) {
				result = 'yandex#' + mapType;
				break;
			}
			if (mapType === ('yandex#' + this.possibleShortMapTypes[key])) {
				result = mapType;
			}
		}
		return result;
	},
	
	// Possible types: yandex#map, yandex#satellite, yandex#hybrid, yandex#publicMap, yandex#publicMapHybrid
	// Or their short names: map, satellite, hybrid, publicMap, publicMapHybrid
	initialize: function(type, options, yandexMapOptions) {
		L.Util.setOptions(this, options);
		//Assigning an initial map type for the Yandex layer
		this._type = this._getPossibleMapType(type);
		this._yandexMapOptions = yandexMapOptions;
	},

	onAdd: function(map, insertAtTheBottom) {
		this._map = map;
		this._animated = map._zoomAnimated;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on({
			'viewreset': this._viewReset,
			'move': this._move,
			'resize': this._resize,
			'zoomend': this._setZoom,
			'zoomstart': this._beforeZoom},
			this);

		if (this._animated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		map._controlCorners.bottomright.style.marginBottom = '3em';

		this._viewReset();
	},

	onRemove: function(map) {
		this._map._container.removeChild(this._container);

		map.off({
			'viewreset': this._viewReset,
			'move': this._move,
			'resize': this._resize,
			'zoomend': this._setZoom,
			'zoomstart': this._beforeZoom},
			this);

		if (this._animated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		map._controlCorners.bottomright.style.marginBottom = '0em';
	},

	getAttribution: function() {
		return this.options.attribution;
	},

	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + 'px';
		e.style.height = size.y + 'px';
	},

	_initContainer: function() {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-yandex-layer leaflet-top leaflet-left');
			this._container.id = '_YMapContainer_' + L.Util.stamp(this);
			this._container.style.zIndex = 'auto';
		}

		if (this.options.overlay) {
			first = this._map._container.getElementsByClassName('leaflet-map-pane')[0];
			first = first.nextSibling;
			// XXX: Bug with layer order
			if (L.Browser.opera)
				this._container.className += ' leaflet-objects-pane';
		}
		tilePane.insertBefore(this._container, first);

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._container, this._map.getSize());
	},

	_initMapObject: function() {
		if (this._yandex) return;

		// Check that ymaps.Map is ready
		if (ymaps.Map === undefined) {
			return ymaps.load(['package.map'], this._initMapObject, this);
		}

		// If traffic layer is requested check if control.TrafficControl is ready
		if (this.options.traffic)
			if (ymaps.control === undefined ||
					ymaps.control.TrafficControl === undefined) {
				return ymaps.load(['package.traffic', 'package.controls'],
					this._initMapObject, this);
			}
		//Creating ymaps map-object without any default controls on it
		var map = new ymaps.Map(this._container, { center: [0, 0], zoom: 0, behaviors: [], controls: [] }, this._yandexMapOptions);

		if (this.options.traffic)
			map.controls.add(new ymaps.control.TrafficControl({shown: true}));

		if (this._type === 'yandex#null') {
			this._type = new ymaps.MapType('null', []);
			map.container.getElement().style.background = 'transparent';
		}
		map.setType(this._type);

		this._yandex = map;
		//Reporting that map-object was initialized
		this.fire('MapObjectInitialized', { mapObject: map });
	},

	_viewReset: function(e) {
		//if (!this._zooming) {
			var center = this._map.getCenter();
			center = [center.lat, center.lng];
			var zoom = this._map.getZoom();
			this._yandex.setCenter(center, zoom, (this._animated && this._zooming) ? this.yandexAnimationOptions : {});
			//this._yandex.setCenter(center, zoom);
		//}
	},

	_setZoom: function() {
		var zoom = this._map.getZoom();
		if (zoom !== this._yandex.getZoom()){
			var zoomOptions = this._animated ? this.yandexAnimationOptions : {};
			this._yandex.setZoom(zoom, zoomOptions);
		}
		this._zooming = false;
	},

	_move: function() {
		if (!this._zooming) {
			var center = this._map.getCenter();
			center = [center.lat, center.lng];
			this._yandex.setCenter(center);
		}
	},

	_animateZoom: function(e) {
		var center = [e.center.lat, e.center.lng];
		var zoom = e.zoom;
		this._yandex.setCenter(center, zoom, this.yandexAnimationOptions);
	},

	_beforeZoom: function() {
		this._zooming = true;
	},

	_resize: function(force) {
		var size = this._map.getSize(), style = this._container.style;
		if (style.width === size.x + 'px' && style.height === size.y + 'px')
			if (force !== true) return;
		this.setElementSize(this._container, size);
		var b = this._map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
		this._yandex.container.fitToViewport();
	}
});
