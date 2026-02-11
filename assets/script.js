// Main Application
class QuakePHMap {
    constructor() {
        // DOM Elements
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebar = document.getElementById('toggleSidebar');
        this.mobileToggle = document.getElementById('mobileToggle');
        this.layerButtons = document.querySelectorAll('.layer-btn');
        this.mapLayers = {
            base: document.getElementById('baseMap'),
            hazard: document.getElementById('hazardMap'),
            risk: document.getElementById('riskMap')
        };
        this.currentLayerTitle = document.getElementById('currentLayerTitle');
        this.legendContent = document.getElementById('legendContent');
        this.lastUpdate = document.getElementById('lastUpdate');
        this.quakeList = document.getElementById('quakeList');
        this.quakePanel = document.getElementById('quakePanel');
        this.closeQuakePanel = document.getElementById('closeQuakePanel');
        this.toggleQuakePanel = document.getElementById('toggleQuakePanel');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.locateBtn = document.getElementById('locateBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.quakeCount = document.getElementById('quakeCount');
        this.toggleLayers = document.getElementById('toggleLayers');
        this.toggleDrawing = document.getElementById('toggleDrawing');
        
        // Drawing Tools Elements
        this.drawButtons = {
            marker: document.getElementById('drawMarker'),
            line: document.getElementById('drawLine'),
            polygon: document.getElementById('drawPolygon'),
            rectangle: document.getElementById('drawRectangle'),
            circle: document.getElementById('drawCircle'),
            text: document.getElementById('drawText'),
            delete: document.getElementById('deleteSelected'),
            clear: document.getElementById('clearAllDrawings'),
            export: document.getElementById('exportDrawings')
        };
        this.drawColor = document.getElementById('drawColor');
        this.lineWidth = document.getElementById('lineWidth');
        this.widthValue = document.getElementById('widthValue');
        this.fillOpacity = document.getElementById('fillOpacity');
        this.opacityValue = document.getElementById('opacityValue');
        this.drawingsList = document.getElementById('drawingsList');
        
        // Modal Elements
        this.textModal = document.getElementById('textModal');
        this.textContent = document.getElementById('textContent');
        this.textSize = document.getElementById('textSize');
        this.textSizeValue = document.getElementById('textSizeValue');
        this.textColor = document.getElementById('textColor');
        this.textBackground = document.getElementById('textBackground');
        this.closeTextModal = document.getElementById('closeTextModal');
        this.cancelText = document.getElementById('cancelText');
        this.saveText = document.getElementById('saveText');
        
        // Map Variables
        this.map = null;
        this.quakeMarkers = [];
        this.faultLines = null;
        this.earthquakeData = [];
        this.currentLayer = 'earthquake';
        this.autoRefreshInterval = null;
        
        // Drawing Variables - NO LEAFLET.DRAW
        this.drawnItems = new L.FeatureGroup();
        this.drawingMode = null;
        this.selectedDrawing = null;
        this.drawings = [];
        this.nextDrawingId = 1;
        this.isDrawingActive = false;
        this.drawingToolsPanel = document.querySelector('.drawing-tools-panel');
        
        // Custom drawing state
        this.tempLayer = null;
        this.drawPoints = [];
        this.isDrawing = false;

        // Initialize
        this.initMap();
        this.initEventListeners();
        this.loadFaultLines();
        this.loadEarthquakeData();
        this.setupAutoRefresh();
        this.updateLegend();
        this.loadSavedDrawings();
        this.updateDrawingButtonsState();
    }
    
    // Initialize Leaflet Map
    initMap() {
        this.map = L.map('baseMap', {
            center: [12.8797, 121.7740],
            zoom: 6,
            zoomControl: true,
            attributionControl: false
        });
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        L.control.scale({ imperial: false }).addTo(this.map);
        
        L.control.attribution({
            position: 'bottomright'
        }).addTo(this.map).addAttribution('QuakePH | Philippine Earthquake Monitor');
        
        this.quakeLayerGroup = L.layerGroup().addTo(this.map);
        this.faultLayerGroup = L.layerGroup();
        this.drawnItems.addTo(this.map);
    }
    
    // ============ CUSTOM DRAWING IMPLEMENTATION ============
    // NO LEAFLET.DRAW - NO BLUE SQUARE PREVIEW
    
    enterDrawingMode(mode) {
        if (this.currentLayer !== 'earthquake' && this.currentLayer !== 'fault') {
            this.showNotification('Drawing is only available on the Earthquake Map layer', 'error');
            return;
        }
        
        this.exitDrawingMode();
        this.drawingMode = mode;
        this.isDrawingActive = true;
        
        // Set up map event listeners based on mode
        this.map.on('mousedown', this.onDrawStart, this);
        this.map.on('mousemove', this.onDrawMove, this);
        this.map.on('mouseup', this.onDrawEnd, this);
        this.map.on('click', this.onDrawClick, this);
        
        // Update UI
        Object.values(this.drawButtons).forEach(btn => btn?.classList.remove('active'));
        if (this.drawButtons[mode]) this.drawButtons[mode].classList.add('active');
        
        this.showDrawingModeIndicator(mode);
        this.map.getContainer().style.cursor = 'crosshair';
    }
    
    exitDrawingMode() {
        this.drawingMode = null;
        this.isDrawingActive = false;
        this.isDrawing = false;
        this.drawPoints = [];
        
        // Remove temporary preview layer
        if (this.tempLayer) {
            this.map.removeLayer(this.tempLayer);
            this.tempLayer = null;
        }
        
        // Remove event listeners
        this.map.off('mousedown', this.onDrawStart, this);
        this.map.off('mousemove', this.onDrawMove, this);
        this.map.off('mouseup', this.onDrawEnd, this);
        this.map.off('click', this.onDrawClick, this);
        
        // Reset cursor
        this.map.getContainer().style.cursor = '';
        
        // Update UI
        Object.values(this.drawButtons).forEach(btn => btn?.classList.remove('active'));
        this.hideDrawingModeIndicator();
    }
    
    onDrawStart(e) {
        if (!this.isDrawingActive) return;
        
        if (this.drawingMode === 'marker') {
            // Marker: single click
            this.addMarker(e.latlng);
            this.exitDrawingMode();
        } 
        else if (this.drawingMode === 'rectangle' || this.drawingMode === 'circle') {
            // Rectangle and Circle: drag to draw
            this.isDrawing = true;
            this.drawPoints = [e.latlng];
            
            // Create temporary preview
            if (this.tempLayer) this.map.removeLayer(this.tempLayer);
            
            if (this.drawingMode === 'rectangle') {
                this.tempLayer = L.rectangle([e.latlng, e.latlng], {
                    color: this.drawColor.value,
                    weight: parseInt(this.lineWidth.value),
                    fillColor: this.drawColor.value,
                    fillOpacity: 0.1,
                    opacity: 0.8,
                    clickable: false,
                    interactive: false
                }).addTo(this.map);
            } else if (this.drawingMode === 'circle') {
                this.tempLayer = L.circle(e.latlng, {
                    radius: 0,
                    color: this.drawColor.value,
                    weight: parseInt(this.lineWidth.value),
                    fillColor: this.drawColor.value,
                    fillOpacity: 0.1,
                    opacity: 0.8,
                    clickable: false,
                    interactive: false
                }).addTo(this.map);
            }
        }
    }
    
    onDrawMove(e) {
        if (!this.isDrawing || !this.tempLayer) return;
        
        if (this.drawingMode === 'rectangle' && this.drawPoints[0]) {
            // Update rectangle preview
            const bounds = L.latLngBounds(this.drawPoints[0], e.latlng);
            this.tempLayer.setBounds(bounds);
        } else if (this.drawingMode === 'circle' && this.drawPoints[0]) {
            // Update circle preview
            const radius = this.drawPoints[0].distanceTo(e.latlng);
            this.tempLayer.setRadius(radius);
        }
    }
    
    onDrawEnd(e) {
        if (!this.isDrawing || !this.tempLayer) return;
        
        if (this.drawingMode === 'rectangle' && this.drawPoints[0]) {
            // Create final rectangle
            const bounds = L.latLngBounds(this.drawPoints[0], e.latlng);
            const rectangle = L.rectangle(bounds, {
                color: this.drawColor.value,
                weight: parseInt(this.lineWidth.value),
                fillColor: this.drawColor.value,
                fillOpacity: parseInt(this.fillOpacity.value) / 100,
                opacity: 0.8
            });
            
            this.finalizeDrawing(rectangle, 'rectangle');
        } 
        else if (this.drawingMode === 'circle' && this.drawPoints[0]) {
            // Create final circle
            const radius = this.drawPoints[0].distanceTo(e.latlng);
            const circle = L.circle(this.drawPoints[0], {
                radius: radius,
                color: this.drawColor.value,
                weight: parseInt(this.lineWidth.value),
                fillColor: this.drawColor.value,
                fillOpacity: parseInt(this.fillOpacity.value) / 100,
                opacity: 0.8
            });
            
            this.finalizeDrawing(circle, 'circle');
        }
        
        // Clean up
        this.isDrawing = false;
        this.drawPoints = [];
        if (this.tempLayer) {
            this.map.removeLayer(this.tempLayer);
            this.tempLayer = null;
        }
    }
    
    onDrawClick(e) {
        if (!this.isDrawingActive) return;
        
        if (this.drawingMode === 'polyline' || this.drawingMode === 'polygon') {
            // Start or continue drawing
            if (!this.isDrawing) {
                // Start new drawing
                this.isDrawing = true;
                this.drawPoints = [e.latlng];
                
                // Create temporary line
                if (this.tempLayer) this.map.removeLayer(this.tempLayer);
                this.tempLayer = L.polyline([e.latlng], {
                    color: this.drawColor.value,
                    weight: parseInt(this.lineWidth.value),
                    opacity: 0.8
                }).addTo(this.map);
            } else {
                // Add point to existing drawing
                this.drawPoints.push(e.latlng);
                this.tempLayer.setLatLngs(this.drawPoints);
            }
        }
    }
    
    // Double-click to finish polygon/polyline
    onDrawDoubleClick(e) {
        if (this.isDrawing && (this.drawingMode === 'polyline' || this.drawingMode === 'polygon') && this.drawPoints.length >= 2) {
            if (this.drawingMode === 'polyline') {
                const polyline = L.polyline(this.drawPoints, {
                    color: this.drawColor.value,
                    weight: parseInt(this.lineWidth.value),
                    opacity: 0.8
                });
                this.finalizeDrawing(polyline, 'polyline');
            } else if (this.drawingMode === 'polygon') {
                const polygon = L.polygon(this.drawPoints, {
                    color: this.drawColor.value,
                    weight: parseInt(this.lineWidth.value),
                    fillColor: this.drawColor.value,
                    fillOpacity: parseInt(this.fillOpacity.value) / 100,
                    opacity: 0.8
                });
                this.finalizeDrawing(polygon, 'polygon');
            }
            
            this.isDrawing = false;
            this.drawPoints = [];
            if (this.tempLayer) {
                this.map.removeLayer(this.tempLayer);
                this.tempLayer = null;
            }
        }
    }
    
    addMarker(latlng) {
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background: ${this.drawColor.value}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            }),
            draggable: true
        });
        
        this.finalizeDrawing(marker, 'marker');
    }
    
    finalizeDrawing(layer, type) {
        // Add common properties
        layer.drawingId = this.nextDrawingId++;
        layer.drawingType = type;
        layer.drawingProperties = {
            color: this.drawColor.value,
            width: parseInt(this.lineWidth.value),
            opacity: parseInt(this.fillOpacity.value) / 100,
            createdAt: new Date().toISOString()
        };
        
        // Add to map and group
        this.drawnItems.addLayer(layer);
        
        // Add event handlers
        layer.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(layer);
        });
        
        if (type === 'marker' || type === 'text') {
            layer.on('dragend', () => {
                this.updateDrawing(layer);
                this.saveDrawingsToStorage();
            });
        }
        
        // Save drawing
        this.saveDrawing(layer, type);
        this.selectDrawing(layer);
        this.exitDrawingMode();
        this.showNotification(`${type} added`, 'success');
    }
    
    // Start text drawing mode
    startTextDrawing() {
        if (this.currentLayer !== 'earthquake' && this.currentLayer !== 'fault') {
            this.showNotification('Drawing is only available on the Earthquake Map layer', 'error');
            return;
        }
        
        this.exitDrawingMode();
        this.drawingMode = 'text';
        this.isDrawingActive = true;
        
        // Update UI
        Object.values(this.drawButtons).forEach(btn => btn?.classList.remove('active'));
        this.drawButtons.text?.classList.add('active');
        
        this.showDrawingModeIndicator('text');
        this.showNotification('Click on the map to add text annotation', 'info');
    }
    
    // Open text input modal
    openTextModal(latlng) {
        this.textContent.value = '';
        this.textSize.value = '16';
        this.textSizeValue.textContent = '16px';
        this.textColor.value = '#ffffff';
        this.textBackground.value = '#000000';
        this.textModalLatLng = latlng;
        this.textModal.classList.add('active');
        this.textContent.focus();
    }
    
    // Save text annotation from modal
    saveTextAnnotation() {
        const text = this.textContent.value.trim();
        if (text && this.textModalLatLng) {
            this.addTextAnnotation(this.textModalLatLng, text);
            this.closeTextModal();
            this.exitDrawingMode();
        }
    }
    
    // Add text annotation
    addTextAnnotation(latlng, text) {
        const marker = L.marker(latlng, {
            icon: L.divIcon({
                className: 'text-annotation',
                html: `<div style="color: ${this.textColor.value}; background: ${this.textBackground.value}; padding: 5px 10px; border-radius: 4px; font-size: ${this.textSize.value}px; font-weight: 500; max-width: 200px; word-wrap: break-word;">${text}</div>`,
                iconSize: null,
                iconAnchor: [0, 0]
            }),
            draggable: true
        });
        
        marker.drawingId = this.nextDrawingId++;
        marker.drawingType = 'text';
        marker.drawingProperties = {
            text: text,
            fontSize: parseInt(this.textSize.value),
            textColor: this.textColor.value,
            backgroundColor: this.textBackground.value,
            createdAt: new Date().toISOString()
        };
        
        this.drawnItems.addLayer(marker);
        
        marker.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(marker);
        });
        
        marker.on('dragend', () => {
            this.updateDrawing(marker);
            this.saveDrawingsToStorage();
        });
        
        this.saveDrawing(marker, 'text');
        this.selectDrawing(marker);
        this.showNotification('Text annotation added', 'success');
    }
    
    // Save drawing to list
    saveDrawing(layer, type) {
        const drawing = {
            id: layer.drawingId,
            type: type,
            layer: layer,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.drawings.filter(d => d.type === type).length + 1}`,
            color: layer.drawingProperties.color || this.drawColor.value,
            createdAt: layer.drawingProperties.createdAt
        };
        
        this.drawings.push(drawing);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
    }
    
    // Update drawing in list
    updateDrawing(layer) {
        const drawing = this.drawings.find(d => d.id === layer.drawingId);
        if (drawing) {
            drawing.layer = layer;
            this.saveDrawingsToStorage();
        }
    }
    
    // Remove drawing from list
    removeDrawing(layer) {
        this.drawings = this.drawings.filter(d => d.id !== layer.drawingId);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
        if (this.selectedDrawing === layer) this.selectedDrawing = null;
    }
    
    // Select a drawing
    selectDrawing(layer) {
        this.deselectAllDrawings();
        
        if (layer.setStyle) {
            const currentColor = layer.drawingProperties?.color || this.drawColor.value;
            const currentWidth = layer.drawingProperties?.width || parseInt(this.lineWidth.value);
            
            layer.setStyle({
                color: '#ffeb3b',
                weight: currentWidth + 2,
                fillColor: currentColor
            });
        }
        
        if (layer._path) layer._path.classList.add('selected-drawing');
        this.selectedDrawing = layer;
        
        const listItem = document.querySelector(`.drawing-item[data-id="${layer.drawingId}"]`);
        if (listItem) {
            listItem.classList.add('active');
            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    // Deselect all drawings
    deselectAllDrawings() {
        this.drawnItems.eachLayer(layer => {
            if (layer.drawingProperties && layer.setStyle) {
                layer.setStyle({
                    color: layer.drawingProperties.color,
                    weight: layer.drawingProperties.width,
                    fillColor: layer.drawingProperties.color,
                    fillOpacity: layer.drawingProperties.opacity
                });
            }
            if (layer._path) layer._path.classList.remove('selected-drawing');
        });
        
        document.querySelectorAll('.drawing-item').forEach(item => item.classList.remove('active'));
        this.selectedDrawing = null;
    }
    
    // Update drawings list in sidebar
    updateDrawingsList() {
        this.drawingsList.innerHTML = '';
        
        if (this.drawings.length === 0) {
            this.drawingsList.innerHTML = '<div class="no-drawings" style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem; font-style: italic;">No drawings yet</div>';
            return;
        }
        
        [...this.drawings]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .forEach(drawing => {
                const item = document.createElement('div');
                item.className = 'drawing-item';
                item.dataset.id = drawing.id;
                item.innerHTML = `
                    <div class="drawing-info">
                        <div class="drawing-color" style="background: ${drawing.color}"></div>
                        <span class="drawing-name">${drawing.name}</span>
                    </div>
                    <div class="drawing-actions">
                        <button class="drawing-action-btn delete-btn" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.drawing-actions')) {
                        if (drawing.layer.getBounds) {
                            this.map.setView(drawing.layer.getBounds().getCenter(), this.map.getZoom());
                        } else if (drawing.layer.getLatLng) {
                            this.map.setView(drawing.layer.getLatLng(), this.map.getZoom());
                        }
                        this.selectDrawing(drawing.layer);
                    }
                });
                
                item.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.drawnItems.removeLayer(drawing.layer);
                    this.removeDrawing(drawing.layer);
                    this.showNotification('Drawing deleted', 'success');
                });
                
                this.drawingsList.appendChild(item);
            });
    }
    
    // Save drawings to localStorage
    saveDrawingsToStorage() {
        try {
            const data = this.drawings.map(d => ({
                id: d.id,
                type: d.type,
                name: d.name,
                color: d.color,
                createdAt: d.createdAt,
                geojson: d.layer.toGeoJSON()
            }));
            localStorage.setItem('quakeph_drawings', JSON.stringify(data));
        } catch (e) {
            console.error('Error saving drawings:', e);
        }
    }
    
    // Load drawings from localStorage
    loadSavedDrawings() {
        try {
            const saved = localStorage.getItem('quakeph_drawings');
            if (saved) {
                JSON.parse(saved).forEach(data => {
                    const layer = L.geoJSON(data.geojson).getLayers()[0];
                    if (layer) {
                        layer.drawingId = data.id;
                        layer.drawingType = data.type;
                        layer.drawingProperties = {
                            color: data.color,
                            width: 3,
                            opacity: 0.3,
                            createdAt: data.createdAt
                        };
                        
                        // Reapply styles
                        if (data.type === 'marker') {
                            layer.setIcon(L.divIcon({
                                className: 'custom-marker',
                                html: `<div style="background: ${data.color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                            }));
                        } else if (data.type === 'text') {
                            // Text annotations handle their own styling
                        } else {
                            layer.setStyle({
                                color: data.color,
                                weight: 3,
                                fillColor: data.color,
                                fillOpacity: 0.3
                            });
                        }
                        
                        this.drawnItems.addLayer(layer);
                        this.drawings.push({
                            id: data.id,
                            type: data.type,
                            layer,
                            name: data.name,
                            color: data.color,
                            createdAt: data.createdAt
                        });
                        
                        this.nextDrawingId = Math.max(this.nextDrawingId, data.id + 1);
                    }
                });
                this.updateDrawingsList();
            }
        } catch (e) {
            console.error('Error loading drawings:', e);
        }
    }
    
    // Delete selected drawing
    deleteSelectedDrawing() {
        if (this.selectedDrawing) {
            this.drawnItems.removeLayer(this.selectedDrawing);
            this.removeDrawing(this.selectedDrawing);
            this.showNotification('Drawing deleted', 'success');
        } else {
            this.showNotification('No drawing selected', 'error');
        }
    }
    
    // Clear all drawings
    clearAllDrawings() {
        if (this.drawings.length && confirm('Are you sure you want to clear all drawings? This cannot be undone.')) {
            this.drawnItems.clearLayers();
            this.drawings = [];
            this.updateDrawingsList();
            localStorage.removeItem('quakeph_drawings');
            this.showNotification('All drawings cleared', 'success');
        }
    }
    
    // Export drawings as GeoJSON
    exportDrawings() {
        if (this.drawings.length === 0) {
            this.showNotification('No drawings to export', 'info');
            return;
        }
        
        const collection = {
            type: "FeatureCollection",
            features: []
        };
        
        this.drawnItems.eachLayer(layer => {
            const geojson = layer.toGeoJSON();
            geojson.properties = {
                ...geojson.properties,
                drawingId: layer.drawingId,
                drawingType: layer.drawingType,
                ...layer.drawingProperties
            };
            collection.features.push(geojson);
        });
        
        const link = document.createElement('a');
        link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(collection, null, 2));
        link.download = `quakeph_drawings_${new Date().toISOString().slice(0, 10)}.geojson`;
        link.click();
        this.showNotification('Drawings exported successfully!', 'success');
    }
    
    // Show drawing mode indicator
    showDrawingModeIndicator(mode) {
        let indicator = document.querySelector('.drawing-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drawing-mode-indicator';
            document.querySelector('.map-container').appendChild(indicator);
        }
        
        const names = {
            marker: 'Marker',
            polyline: 'Line',
            polygon: 'Polygon',
            rectangle: 'Rectangle',
            circle: 'Circle',
            text: 'Text'
        };
        
        indicator.innerHTML = `
            <i class="fas fa-pencil-alt"></i>
            <span>Drawing Mode: ${names[mode] || mode}</span>
            <button class="exit-drawing-btn"><i class="fas fa-times"></i></button>
        `;
        indicator.classList.add('active');
        indicator.querySelector('.exit-drawing-btn').onclick = () => this.exitDrawingMode();
    }
    
    // Hide drawing mode indicator
    hideDrawingModeIndicator() {
        document.querySelector('.drawing-mode-indicator')?.classList.remove('active');
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
    
    // Update drawing buttons state based on current layer
    updateDrawingButtonsState() {
        const enabled = this.currentLayer === 'earthquake' || this.currentLayer === 'fault';
        Object.values(this.drawButtons).forEach(btn => {
            if (btn && btn !== this.drawButtons.clear && btn !== this.drawButtons.export) {
                btn.classList.toggle('disabled', !enabled);
                btn.disabled = !enabled;
            }
        });
    }
    
    // Toggle drawing tools visibility
    toggleDrawingTools() {
        this.drawingToolsPanel.classList.toggle('active');
        this.toggleDrawing.classList.toggle('active');
    }
    
    // ============ EXISTING EARTHQUAKE CODE (UNCHANGED) ============
    loadFaultLines() {
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(r => r.json())
            .then(data => {
                this.faultLines = L.geoJSON(data, {
                    style: { color: '#facc15', weight: 2, opacity: 0.7, dashArray: '5, 5' },
                    onEachFeature: (f, l) => f.properties?.Name && l.bindPopup(`<b>Fault Line:</b> ${f.properties.Name}`)
                });
                this.faultLayerGroup.addLayer(this.faultLines);
            })
            .catch(e => console.error('Error loading fault lines:', e));
    }
    
    loadEarthquakeData() {
        this.showLoading(true);
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')
            .then(r => r.json())
            .then(data => {
                this.earthquakeData = data.features;
                this.displayEarthquakes();
                this.updateEarthquakeList();
                this.updateLastUpdateTime();
                this.showLoading(false);
            })
            .catch(e => {
                console.error('Error loading earthquake data:', e);
                this.showLoading(false);
                this.showNotification('Failed to load earthquake data.', 'error');
            });
    }
    
    displayEarthquakes() {
        this.quakeLayerGroup.clearLayers();
        this.quakeMarkers = [];
        
        this.earthquakeData.forEach(f => {
            const c = f.geometry.coordinates;
            const m = L.circleMarker([c[1], c[0]], {
                radius: Math.max(f.properties.mag * 3, 8),
                fillColor: this.getMagnitudeColor(f.properties.mag),
                color: '#fff',
                weight: 1,
                fillOpacity: 0.7
            }).bindPopup(`
                <div class="quake-popup">
                    <h3>M ${f.properties.mag.toFixed(1)}</h3>
                    <p><strong>Location:</strong> ${f.properties.place}</p>
                    <p><strong>Time:</strong> ${new Date(f.properties.time).toLocaleString()}</p>
                    <p><strong>Depth:</strong> ${c[2].toFixed(1)} km</p>
                    <button onclick="quakeMap.zoomToEarthquake(${c[1]}, ${c[0]})" style="margin-top:10px;padding:5px 10px;background:#00b4d8;color:white;border:none;border-radius:4px;cursor:pointer;">Zoom</button>
                </div>
            `).addTo(this.quakeLayerGroup);
            
            this.quakeMarkers.push({ marker: m, magnitude: f.properties.mag, time: new Date(f.properties.time) });
        });
        
        this.quakeCount.textContent = this.earthquakeData.length;
    }
    
    updateEarthquakeList() {
        this.quakeList.innerHTML = '';
        [...this.earthquakeData]
            .sort((a, b) => b.properties.mag - a.properties.mag)
            .forEach(f => {
                const item = document.createElement('div');
                item.className = 'quake-item';
                item.style.borderLeftColor = this.getMagnitudeColor(f.properties.mag);
                item.innerHTML = `
                    <div class="quake-magnitude" style="color: ${this.getMagnitudeColor(f.properties.mag)}">M ${f.properties.mag.toFixed(1)}</div>
                    <div class="quake-location">${f.properties.place}</div>
                    <div class="quake-time"><i class="far fa-clock"></i> ${new Date(f.properties.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                `;
                item.onclick = () => {
                    this.zoomToEarthquake(f.geometry.coordinates[1], f.geometry.coordinates[0]);
                    this.highlightEarthquakeMarker(f.geometry.coordinates[1], f.geometry.coordinates[0]);
                };
                this.quakeList.appendChild(item);
            });
    }
    
    zoomToEarthquake(lat, lng) {
        this.map.setView([lat, lng], 8);
        this.quakeMarkers.find(m => m.marker.getLatLng().lat === lat && m.marker.getLatLng().lng === lng)?.marker.openPopup();
    }
    
    highlightEarthquakeMarker(lat, lng) {
        this.quakeMarkers.forEach(m => {
            if (m.marker.getLatLng().lat === lat && m.marker.getLatLng().lng === lng) {
                m.marker.setStyle({ color: '#fff', weight: 3, fillOpacity: 0.9 });
                setTimeout(() => m.marker.setStyle({ color: '#fff', weight: 1, fillOpacity: 0.7 }), 3000);
            }
        });
    }
    
    getMagnitudeColor(m) {
        if (m < 3) return '#4cd964';
        if (m < 4) return '#ffcc00';
        if (m < 5) return '#ff9500';
        if (m < 6) return '#ff3b30';
        return '#8b0000';
    }
    
    updateLegend() {
        let html = '';
        if (this.currentLayer === 'earthquake') {
            html = `
                <div class="legend-item"><div class="legend-color" style="background:#4cd964;"></div><span>Magnitude < 3.0</span></div>
                <div class="legend-item"><div class="legend-color" style="background:#ffcc00;"></div><span>Magnitude 3.0-3.9</span></div>
                <div class="legend-item"><div class="legend-color" style="background:#ff9500;"></div><span>Magnitude 4.0-4.9</span></div>
                <div class="legend-item"><div class="legend-color" style="background:#ff3b30;"></div><span>Magnitude 5.0-5.9</span></div>
                <div class="legend-item"><div class="legend-color" style="background:#8b0000;"></div><span>Magnitude ≥ 6.0</span></div>
            `;
        } else if (this.currentLayer === 'fault') {
            html = `<div class="legend-item"><div class="legend-color" style="background:#facc15;"></div><span>Major Fault Lines</span></div>`;
        } else {
            html = `<div class="legend-item"><div class="legend-info"><p>${this.currentLayer === 'hazard' ? 'Seismic Hazard Map' : 'Seismic Risk Map'}</p></div></div>`;
        }
        this.legendContent.innerHTML = html;
    }
    
    updateLastUpdateTime() {
        this.lastUpdate.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    
    setupAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => this.loadEarthquakeData(), 5 * 60 * 1000);
    }
    
    switchLayer(layerId) {
    // Remove fault lines from map
    if (this.faultLayerGroup && this.map.hasLayer(this.faultLayerGroup)) {
        this.map.removeLayer(this.faultLayerGroup);
    }
    
    this.exitDrawingMode();
    this.currentLayer = layerId;
    
    // SIMPLE: Just toggle active classes
    this.mapLayers.base.classList.remove('active');
    this.mapLayers.hazard.classList.remove('active');
    this.mapLayers.risk.classList.remove('active');
    
    if (layerId === 'earthquake') {
        this.mapLayers.base.classList.add('active');
        this.currentLayerTitle.textContent = 'Philippine Earthquake Map';
        setTimeout(() => this.map.invalidateSize(), 50);
    }
    else if (layerId === 'fault') {
        this.mapLayers.base.classList.add('active');
        this.currentLayerTitle.textContent = 'Philippine Fault Lines';
        setTimeout(() => this.map.invalidateSize(), 50);
        if (this.faultLines) {
            this.map.addLayer(this.faultLayerGroup);
        }
    }
    else if (layerId === 'hazard') {
        this.mapLayers.hazard.classList.add('active');
        this.currentLayerTitle.textContent = 'Seismic Hazard Map';
    }
    else if (layerId === 'risk') {
        this.mapLayers.risk.classList.add('active');
        this.currentLayerTitle.textContent = 'Seismic Risk Map';
    }
    
    this.updateLegend();
    this.updateDrawingButtonsState();
}

// Also add this to your constructor to pre-clear iframes:
constructor() {
    // ... existing code ...
    
    // Initialize - add this BEFORE your other inits
    this.initMap();
    
    // NUKE the iframes immediately
    setTimeout(() => {
        document.getElementById('hazardMap').src = 'about:blank';
        document.getElementById('riskMap').src = 'about:blank';
        document.getElementById('hazardMap').style.display = 'none';
        document.getElementById('riskMap').style.display = 'none';
    }, 10);

    
    this.updateLegend();
    this.updateDrawingButtonsState();
}

    
    toggleSidebarView() {
        this.sidebar.classList.toggle('collapsed');
        this.sidebar.classList.toggle('active');
        const icon = this.toggleSidebar.querySelector('i');
        icon.className = this.sidebar.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        setTimeout(() => this.map.invalidateSize(), 300);
    }
    
    toggleEarthquakePanel() {
        this.quakePanel.classList.toggle('active');
    }
    
    locateUser() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation not supported', 'error');
            return;
        }
        this.showLoading(true);
        navigator.geolocation.getCurrentPosition(
            p => {
                this.map.setView([p.coords.latitude, p.coords.longitude], 10);
                this.showLoading(false);
                L.marker([p.coords.latitude, p.coords.longitude], {
                    icon: L.divIcon({ className: 'user-marker', html: '<i class="fas fa-user" style="color:#00b4d8;font-size:24px;"></i>', iconSize: [30, 30] })
                }).addTo(this.map).bindPopup('Your Location').openPopup();
            },
            () => {
                this.showLoading(false);
                this.showNotification('Unable to retrieve your location', 'error');
            }
        );
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    }
    
    initEventListeners() {
        // Sidebar
        this.toggleSidebar.addEventListener('click', () => this.toggleSidebarView());
        this.mobileToggle.addEventListener('click', () => this.toggleSidebarView());
        
        // Layer buttons
        this.layerButtons.forEach(b => {
            b.addEventListener('click', () => {
                this.layerButtons.forEach(btn => btn.classList.remove('active'));
                b.classList.add('active');
                this.switchLayer(b.dataset.layer);
            });
        });
        
        // Earthquake panel
        this.toggleQuakePanel.addEventListener('click', () => this.toggleEarthquakePanel());
        this.closeQuakePanel.addEventListener('click', () => this.toggleEarthquakePanel());
        
        // Control buttons
        this.toggleDrawing.addEventListener('click', () => this.toggleDrawingTools());
        this.refreshBtn.addEventListener('click', () => this.loadEarthquakeData());
        this.locateBtn.addEventListener('click', () => this.locateUser());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.toggleLayers.addEventListener('click', () => this.toggleSidebarView());
        
        // Drawing buttons - CUSTOM IMPLEMENTATION
        this.drawButtons.marker?.addEventListener('click', () => this.enterDrawingMode('marker'));
        this.drawButtons.line?.addEventListener('click', () => this.enterDrawingMode('polyline'));
        this.drawButtons.polygon?.addEventListener('click', () => this.enterDrawingMode('polygon'));
        this.drawButtons.rectangle?.addEventListener('click', () => this.enterDrawingMode('rectangle'));
        this.drawButtons.circle?.addEventListener('click', () => this.enterDrawingMode('circle'));
        this.drawButtons.text?.addEventListener('click', () => this.startTextDrawing());
        this.drawButtons.delete?.addEventListener('click', () => this.deleteSelectedDrawing());
        this.drawButtons.clear?.addEventListener('click', () => this.clearAllDrawings());
        this.drawButtons.export?.addEventListener('click', () => this.exportDrawings());
        
        // Drawing property controls
        this.lineWidth.addEventListener('input', e => this.widthValue.textContent = e.target.value + 'px');
        this.fillOpacity.addEventListener('input', e => this.opacityValue.textContent = e.target.value + '%');
        this.textSize.addEventListener('input', e => this.textSizeValue.textContent = e.target.value + 'px');
        
        // Text modal
        this.closeTextModal.addEventListener('click', () => this.closeTextModal());
        this.cancelText.addEventListener('click', () => this.closeTextModal());
        this.saveText.addEventListener('click', () => this.saveTextAnnotation());
        
        // Map double-click for finishing polygon/polyline
        this.map.on('dblclick', (e) => this.onDrawDoubleClick(e));
        
        // Text drawing on map click
        this.map.on('click', (e) => {
            if (this.drawingMode === 'text') {
                this.openTextModal(e.latlng);
            }
        });
        
        // Fullscreen and resize
        document.addEventListener('fullscreenchange', () => setTimeout(() => this.map.invalidateSize(), 300));
        window.addEventListener('resize', () => setTimeout(() => this.map.invalidateSize(), 100));
        
        // Close earthquake panel when clicking outside on mobile
        document.addEventListener('click', e => {
            if (window.innerWidth <= 768 && this.quakePanel.classList.contains('active') &&
                !this.quakePanel.contains(e.target) && !this.toggleQuakePanel.contains(e.target)) {
                this.toggleEarthquakePanel();
            }
        });
        
        // Escape key to exit drawing mode
        document.addEventListener('keydown', e => e.key === 'Escape' && this.isDrawingActive && this.exitDrawingMode());
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.quakeMap = new QuakePHMap();
});