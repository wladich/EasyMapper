//@require leaflet
//@require edit_line.css

(function() {
    "use strict";

    function cloneLatLng(ll) {
        return L.latLng(ll.lat, ll.lng);
    }

    function closestPointOnSegmentLatLng(p, p1, p2) {
        var xy = L.LineUtil.closestPointOnSegment(L.point([p.lng, p.lat]), L.point([p1.lng, p1.lat]), L.point([p2.lng, p2.lat]));
        return L.latLng([xy.y, xy.x]);
    }

    L.Polyline.EditMixin = {
        _nodeMarkersZOffset: 10000,

        startEdit: function() {
            if (this._map && !this._editing) {
                this._editing = true;
                this._drawingDirection = 0;
                this.setupMarkers();
                this.on('remove', this.stopEdit.bind(this));
                this._map
                    .on('click', this.onMapClick, this)
                    .on('dragend', this.onMapEndDrag, this);
                L.DomEvent.on(document, 'keyup', this.onKeyPress, this);
                this._storedStyle = {weight: this.options.weight, opacity: this.options.opacity};
                this.setStyle({weight: 1.5, opacity: 1});
                L.DomUtil.addClass(this._map._container, 'leaflet-line-editing');
            }
        },

        stopEdit: function() {
            if (this._editing) {
                this.stopDrawingLine();
                this._editing = false;
                this.removeMarkers();
                L.DomEvent.off(document, 'keyup', this.onKeyPress, this);
                this.off('remove', this.stopEdit.bind(this));
                this._map
                    .off('click', this.onMapClick, this)
                    .off('dragend', this.onMapEndDrag, this);
                this.setStyle(this._storedStyle);
                L.DomUtil.removeClass(this._map._container, 'leaflet-line-editing');
                this.fire('editend', {target: this});
            }
        },

        removeMarkers: function() {
            if (this._nodeMarkers) {
                this._nodeMarkers.forEach(function(marker) {
                    this._map.removeLayer(marker);
                }.bind(this));
            }

            if (this._segmentOverlays) {
                this._segmentOverlays.forEach(function(segment) {
                    this._map.removeLayer(segment);
                }.bind(this));
            }

            this._nodeMarkers = null;
            this._segmentOverlays = null;
        },

        onNodeMarkerDragEnd: function(e) {
            this.onNodeMarkerMovedChangeNode(e);
            this.setupMarkers();
        },

        onNodeMarkerMovedChangeNode: function(e) {
            var marker = e.target,
                nodeIndex = this.getLatLngs().indexOf(marker._lineNode),
                newNode = cloneLatLng(marker.getLatLng());
            this.spliceLatLngs(nodeIndex, 1, newNode);
            marker._lineNode = newNode;
            this.fire('nodeschanged');
        },
        
        onNodeMarkerDblClickedRemoveNode: function(e) {
            var marker = e.target,
                nodeIndex = this.getLatLngs().indexOf(marker._lineNode);
                this.spliceLatLngs(nodeIndex, 1);
                this.setupMarkers();
                this.fire('nodeschanged');
        },


        onMapMouseDown: function(e) {
            this._mapMousDownPosition = e.containerPoint;
        },

        onMapClick: function(e) {
            if (this._drawingDirection) {
                this.setupMarkers();
                var newNodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length;
                this.spliceLatLngs(newNodeIndex, 0, e.latlng);
                this.setupMarkers();
            } else {
                this.stopEdit();
            }
        },

        onMapEndDrag: function(e) {
            if (e.distance < 15) {
                // get mouse position from map drag handler
                var handler = e.target.dragging._draggable;
                var mousePos = handler._startPoint.add(handler._newPos).subtract(handler._startPos);
                var latlng = e.target.mouseEventToLatLng({clientX: mousePos.x, clientY: mousePos.y});
                this.onMapClick({latlng: latlng});
            }
        },

        startDrawingLine: function(direction, e) {
            if (!this._editing) {
                return;
            }
            if (direction === undefined) {
                direction = 1;
            }

            if (this._drawingDirection == direction) {
                return;
            }
            this.stopDrawingLine();
            this._drawingDirection = direction;
            
            if (e) {
                var newNodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length;
                this.spliceLatLngs(newNodeIndex, 0, e.latlng);
                this.fire('nodeschanged');
            }
            
            this._map
                //.on('click', this.onMapClickAddNode, this)
                //.on('dragend', this.onMapEndDrag, this)
                .on('mousemove', this.onMouseMoveFollowEndNode, this);
            L.DomUtil.addClass(this._map._container, 'leaflet-line-drawing');
        },


        stopDrawingLine: function() {
            if (!this._drawingDirection) {
                return;
            }
            this._map
                //.off('click', this.onMapClickAddNode, this)
                //.off('dragend', this.onMapEndDrag, this)
                .off('mousemove', this.onMouseMoveFollowEndNode, this);
            var nodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length-1;
            this.spliceLatLngs(nodeIndex, 1);
            this.fire('nodeschanged');
            this._drawingDirection = 0;
            L.DomUtil.removeClass(this._map._container, 'leaflet-line-drawing');
            
        },

        onKeyPress: function(e) {
            if ('input' == e.target.tagName.toLowerCase()) {
                return;
            }
            var code = e.keyCode;
            switch (code) {
                case 27:
                case 13:
                    if (this._drawingDirection) {
                        this.stopDrawingLine();
                    } else {
                        this.stopEdit();
                    }
                    break;
            }
        },

        onMouseMoveFollowEndNode: function(e) {
            var nodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length-1;
            this.spliceLatLngs(nodeIndex, 1, e.latlng);
            this.fire('nodeschanged');
        },

        makeNodeMarker: function(nodeIndex) {
            var node = this.getLatLngs()[nodeIndex],
                marker = L.marker(cloneLatLng(node), {
                    icon: L.divIcon({className: 'line-editor-node-marker'}),
                    draggable: true,
                    zIndexOffset: this._nodeMarkersZOffset
                });
                marker
                    .on('drag', this.onNodeMarkerMovedChangeNode, this)
                    //.on('dragstart', this.fire.bind(this, 'editingstart'))
                    .on('dragend', this.onNodeMarkerDragEnd, this)
                    .on('dblclick', this.onNodeMarkerDblClickedRemoveNode, this)
                    .on('click', this.onNodeMarkerClickStartStopDrawing, this);
                marker._lineNode = node;
                node._nodeMarker = marker;
            return marker;

        },

        onNodeMarkerClickStartStopDrawing: function(e) {
            var marker = e.target,
                latlngs = this.getLatLngs(),
                latlngs_n = latlngs.length,
                nodeIndex = latlngs.indexOf(marker._lineNode);
            if ((this._drawingDirection == -1 && nodeIndex == 1) || ((this._drawingDirection == 1 && nodeIndex == latlngs_n-2))) {
                this.stopDrawingLine();
            } else if (nodeIndex === 0) {
                this.startDrawingLine(-1, e);
            } else if (nodeIndex === this.getLatLngs().length - 1) {
                this.startDrawingLine(1, e);
            }
        },

        makeSegmentOverlay: function(nodeIndex) {
            var latlngs = this.getLatLngs(),
                p1 = latlngs[nodeIndex],
                p2 = latlngs[nodeIndex + 1],
                segment = L.polyline([p1, p2], {weight: 10, opacity: 0});
                segment.on('mousedown', this.onSegmentMouseDownAddNode, this);
                segment._lineNode = p1;
                p1._overlay = segment;
            return segment;
        },

        onSegmentMouseDownAddNode: function(e) {
            if (e.originalEvent.button !== 0) {
                return;
            }
            var segmentOverlay = e.target,
                latlngs = this.getLatLngs(),
                nodeIndex = latlngs.indexOf(segmentOverlay._lineNode),
                latlng = cloneLatLng(e.latlng);
            this.spliceLatLngs(nodeIndex+1, 0, latlng);
            this.setupMarkers();
            // TODO: hack, may be replace with sending mouse event
            latlng._nodeMarker.dragging._draggable._onDown(e.originalEvent);
            this.fire('nodeschanged');
        },

        setupMarkers: function() {
            this.removeMarkers();
            this._nodeMarkers = [];
            this._segmentOverlays = [];
            var latlngs = this.getLatLngs(),
                marker,
                segment,
                startNode = 0,
                endNode = latlngs.length - 1;
            if (this._drawingDirection == -1) {
                startNode += 1;
            }
            if (this._drawingDirection == 1) {
                endNode -= 1;
            }
            for (var i=startNode; i <= endNode; i++) {
                marker = this.makeNodeMarker(i);
                this._nodeMarkers.push(marker);
                marker.addTo(this._map);
                if (i < endNode) {
                    segment = this.makeSegmentOverlay(i);
                    this._segmentOverlays.push(segment);
                    segment.addTo(this._map);
                }
            }
        }
    };
})();