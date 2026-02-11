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
        
        // Drawing Variables
        this.drawControl = null;
        this.drawnItems = new L.FeatureGroup();
        this.drawingMode = null;
        this.selectedDrawing = null;
        this.drawings = [];
        this.nextDrawingId = 1;
        this.isDrawingActive = false;
        this.isDrawingEnabled = false;
        this.drawingToolsPanel = document.querySelector('.drawing-tools-panel');
        
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
        // Create map centered on Philippines
        this.map = L.map('baseMap', {
            center: [12.8797, 121.7740], // Center of Philippines
            zoom: 6,
            zoomControl: true,
            attributionControl: false
        });
        
        // Add base tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Add scale control
        L.control.scale({ imperial: false }).addTo(this.map);
        
        // Add custom attribution
        L.control.attribution({
            position: 'bottomright'
        }).addTo(this.map).addAttribution('QuakePH | Philippine Earthquake Monitor');
        
        // Create layer groups
        this.quakeLayerGroup = L.layerGroup().addTo(this.map);
        this.faultLayerGroup = L.layerGroup();
        
        // Add drawing layer to map
        this.drawnItems.addTo(this.map);
    }
    
    // Initialize Drawing System
    initDrawingSystem() {
        // Initialize draw control (only when needed)
        this.drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
                polyline: {
                    shapeOptions: {
                        color: this.drawColor.value,
                        weight: parseInt(this.lineWidth.value)
                    }
                },
                polygon: {
                    shapeOptions: {
                        color: this.drawColor.value,
                        weight: parseInt(this.lineWidth.value),
                        fillColor: this.drawColor.value,
                        fillOpacity: parseInt(this.fillOpacity.value) / 100
                    }
                },
                rectangle: {
                    shapeOptions: {
                        color: this.drawColor.value,
                        weight: parseInt(this.lineWidth.value),
                        fillColor: this.drawColor.value,
                        fillOpacity: parseInt(this.fillOpacity.value) / 100
                    }
                },
                circle: {
                    shapeOptions: {
                        color: this.drawColor.value,
                        weight: parseInt(this.lineWidth.value),
                        fillColor: this.drawColor.value,
                        fillOpacity: parseInt(this.fillOpacity.value) / 100
                    }
                },
                marker: {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background: ${this.drawColor.value}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })
                }
            },
            edit: {
                featureGroup: this.drawnItems,
                remove: false
            }
        });
        
        // Add draw control to map
        this.map.addControl(this.drawControl);
        
        // Handle drawing created event
        this.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            const type = e.layerType;
            
            // Style the drawn item
            this.styleDrawnItem(layer, type);
            
            // Add to drawn items
            this.drawnItems.addLayer(layer);
            
            // Save drawing
            this.saveDrawing(layer, type);
            
            // Exit drawing mode
            this.exitDrawingMode();
            
            // Select the new drawing
            this.selectDrawing(layer);
        });
        
        // Handle drawing edited event
        this.map.on(L.Draw.Event.EDITED, (e) => {
            const layers = e.layers;
            layers.eachLayer((layer) => {
                this.updateDrawing(layer);
            });
        });
        
        // Handle drawing selection
        this.map.on('click', (e) => {
            if (!e.originalEvent.propagatedFromDrawing) {
                this.deselectAllDrawings();
            }
        });
    }
    
    // Style a drawn item
    styleDrawnItem(layer, type) {
        const color = this.drawColor.value;
        const width = parseInt(this.lineWidth.value);
        const opacity = parseInt(this.fillOpacity.value) / 100;
        
        switch(type) {
            case 'marker':
                // Already styled by the draw control
                break;
                
            case 'polyline':
                layer.setStyle({
                    color: color,
                    weight: width,
                    opacity: 0.8
                });
                break;
                
            case 'polygon':
            case 'rectangle':
                layer.setStyle({
                    color: color,
                    weight: width,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: opacity
                });
                break;
                
            case 'circle':
                layer.setStyle({
                    color: color,
                    weight: width,
                    opacity: 0.8,
                    fillColor: color,
                    fillOpacity: opacity * 0.5
                });
                break;
        }
        
        // Store drawing properties
        layer.drawingId = this.nextDrawingId++;
        layer.drawingType = type;
        layer.drawingProperties = {
            color: color,
            width: width,
            opacity: opacity,
            createdAt: new Date().toISOString()
        };
        
        // Add click event for selection
        layer.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(layer);
        });
    }
    
    // Save drawing to list
    saveDrawing(layer, type) {
        const drawing = {
            id: layer.drawingId,
            type: type,
            layer: layer,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.drawings.length + 1}`,
            color: layer.drawingProperties.color,
            createdAt: new Date().toISOString()
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
        this.selectedDrawing = null;
    }
    
    // Select a drawing
    selectDrawing(layer) {
        this.deselectAllDrawings();
        
        // Highlight selected drawing
        if (layer.setStyle && layer.drawingProperties) {
            const currentColor = layer.drawingProperties.color || this.drawColor.value;
            const currentWidth = layer.drawingProperties.width || parseInt(this.lineWidth.value);
            layer.setStyle({
                color: '#ffeb3b',
                weight: currentWidth + 2,
                fillColor: currentColor
            });
        }
        
        if (layer._path) {
            layer._path.classList.add('selected-drawing');
        }
        this.selectedDrawing = layer;
        
        // Highlight in list
        const listItem = document.querySelector(`.drawing-item[data-id="${layer.drawingId}"]`);
        if (listItem) {
            listItem.classList.add('active');
            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    // Deselect all drawings
    deselectAllDrawings() {
        // Reset styles for all drawings
        this.drawnItems.eachLayer((layer) => {
            if (layer.drawingProperties && layer.setStyle) {
                layer.setStyle({
                    color: layer.drawingProperties.color,
                    weight: layer.drawingProperties.width,
                    fillColor: layer.drawingProperties.color,
                    fillOpacity: layer.drawingProperties.opacity
                });
            }
            if (layer._path) {
                layer._path.classList.remove('selected-drawing');
            }
        });
        
        // Clear list selection
        document.querySelectorAll('.drawing-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.selectedDrawing = null;
    }
    
    // Update drawings list in sidebar
    updateDrawingsList() {
        this.drawingsList.innerHTML = '';
        
        if (this.drawings.length === 0) {
            this.drawingsList.innerHTML = '<div class="no-drawings" style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem; font-style: italic;">No drawings yet</div>';
            return;
        }
        
        // Sort by creation date (newest first)
        const sortedDrawings = [...this.drawings].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        sortedDrawings.forEach(drawing => {
            const drawingItem = document.createElement('div');
            drawingItem.className = 'drawing-item';
            drawingItem.dataset.id = drawing.id;
            
            drawingItem.innerHTML = `
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
            
            // Add click event to select drawing
            drawingItem.addEventListener('click', (e) => {
                if (!e.target.closest('.drawing-actions')) {
                    if (drawing.layer.getBounds) {
                        this.map.setView(drawing.layer.getBounds().getCenter(), this.map.getZoom());
                    } else if (drawing.layer.getLatLng) {
                        this.map.setView(drawing.layer.getLatLng(), this.map.getZoom());
                    }
                    this.selectDrawing(drawing.layer);
                }
            });
            
            // Add delete button event
            const deleteBtn = drawingItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.drawnItems.removeLayer(drawing.layer);
                this.removeDrawing(drawing.layer);
                this.showNotification('Drawing deleted', 'success');
            });
            
            this.drawingsList.appendChild(drawingItem);
        });
    }
    
    // Save drawings to localStorage
    saveDrawingsToStorage() {
        try {
            const drawingsData = this.drawings.map(drawing => ({
                id: drawing.id,
                type: drawing.type,
                name: drawing.name,
                color: drawing.color,
                createdAt: drawing.createdAt,
                // Convert layer to GeoJSON for storage
                geojson: drawing.layer.toGeoJSON()
            }));
            localStorage.setItem('quakeph_drawings', JSON.stringify(drawingsData));
        } catch (error) {
            console.error('Error saving drawings:', error);
        }
    }
    
    // Load drawings from localStorage
    loadSavedDrawings() {
        try {
            const savedDrawings = localStorage.getItem('quakeph_drawings');
            if (savedDrawings) {
                const drawingsData = JSON.parse(savedDrawings);
                
                drawingsData.forEach(data => {
                    const layer = L.geoJSON(data.geojson).getLayers()[0];
                    if (layer) {
                        // Restore drawing properties
                        layer.drawingId = data.id;
                        layer.drawingType = data.type;
                        layer.drawingProperties = {
                            color: data.color,
                            width: 3,
                            opacity: 0.3,
                            createdAt: data.createdAt
                        };
                        
                        // Style the layer
                        this.styleDrawnItem(layer, data.type);
                        
                        // Add to map and list
                        this.drawnItems.addLayer(layer);
                        this.drawings.push({
                            id: data.id,
                            type: data.type,
                            layer: layer,
                            name: data.name,
                            color: data.color,
                            createdAt: data.createdAt
                        });
                        
                        // Update next ID
                        this.nextDrawingId = Math.max(this.nextDrawingId, data.id + 1);
                    }
                });
                
                this.updateDrawingsList();
            }
        } catch (error) {
            console.error('Error loading drawings:', error);
        }
    }
    
    // Enter drawing mode
    enterDrawingMode(mode) {
        // Only allow drawing on earthquake map layer
        if (this.currentLayer !== 'earthquake' && this.currentLayer !== 'fault') {
            this.showNotification('Drawing is only available on the Earthquake Map layer', 'error');
            return;
        }
        
        this.exitDrawingMode();
        this.drawingMode = mode;
        
        // Initialize drawing system if not already initialized
        if (!this.drawControl) {
            this.initDrawingSystem();
        }
        
        // Activate corresponding draw control
        switch(mode) {
            case 'marker':
                new L.Draw.Marker(this.map, this.drawControl.options.draw.marker).enable();
                break;
            case 'polyline':
                new L.Draw.Polyline(this.map, this.drawControl.options.draw.polyline).enable();
                break;
            case 'polygon':
                new L.Draw.Polygon(this.map, this.drawControl.options.draw.polygon).enable();
                break;
            case 'rectangle':
                new L.Draw.Rectangle(this.map, this.drawControl.options.draw.rectangle).enable();
                break;
            case 'circle':
                new L.Draw.Circle(this.map, this.drawControl.options.draw.circle).enable();
                break;
        }
        
        // Update button states
        Object.values(this.drawButtons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (this.drawButtons[mode]) {
            this.drawButtons[mode].classList.add('active');
        }
        
        this.isDrawingActive = true;
        this.showDrawingModeIndicator(mode);
    }
    
    // Exit drawing mode
    exitDrawingMode() {
        if (this.drawingMode) {
            this.map.fire('draw:drawstop');
            this.drawingMode = null;
            this.isDrawingActive = false;
            
            // Update button states
            Object.values(this.drawButtons).forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            
            this.hideDrawingModeIndicator();
        }
    }
    
    // Show drawing mode indicator
    showDrawingModeIndicator(mode) {
        let indicator = document.querySelector('.drawing-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drawing-mode-indicator';
            document.querySelector('.map-container').appendChild(indicator);
        }
        
        const modeNames = {
            marker: 'Marker',
            polyline: 'Line',
            polygon: 'Polygon',
            rectangle: 'Rectangle',
            circle: 'Circle'
        };
        
        indicator.innerHTML = `
            <i class="fas fa-pencil-alt"></i>
            <span>Drawing Mode: ${modeNames[mode] || mode}</span>
            <button class="exit-drawing-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        indicator.classList.add('active');
        
        // Add exit button event
        const exitBtn = indicator.querySelector('.exit-drawing-btn');
        exitBtn.addEventListener('click', () => {
            this.exitDrawingMode();
        });
    }
    
    // Hide drawing mode indicator
    hideDrawingModeIndicator() {
        const indicator = document.querySelector('.drawing-mode-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }
    
    // Add text annotation
    addTextAnnotation(latlng, text) {
        const fontSize = parseInt(this.textSize.value);
        const textColor = this.textColor.value;
        const backgroundColor = this.textBackground.value;
        
        const textDiv = L.divIcon({
            className: 'text-annotation',
            html: `
                <div style="
                    color: ${textColor};
                    background: ${backgroundColor};
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: ${fontSize}px;
                    font-weight: 500;
                    max-width: 200px;
                    word-wrap: break-word;
                ">
                    ${text}
                </div>
            `,
            iconSize: null,
            iconAnchor: [0, 0]
        });
        
        const marker = L.marker(latlng, {
            icon: textDiv,
            draggable: true,
            autoPan: true
        }).addTo(this.drawnItems);
        
        // Store text properties
        marker.drawingId = this.nextDrawingId++;
        marker.drawingType = 'text';
        marker.drawingProperties = {
            text: text,
            fontSize: fontSize,
            textColor: textColor,
            backgroundColor: backgroundColor,
            createdAt: new Date().toISOString()
        };
        
        // Add to drawings list
        const drawing = {
            id: marker.drawingId,
            type: 'text',
            layer: marker,
            name: `Text ${this.drawings.filter(d => d.type === 'text').length + 1}`,
            color: textColor,
            createdAt: new Date().toISOString()
        };
        
        this.drawings.push(drawing);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
        
        // Add click event for selection
        marker.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(marker);
        });
        
        return marker;
    }
    
    // Open text input modal
    openTextModal(latlng) {
        // Only allow drawing on earthquake map layer
        if (this.currentLayer !== 'earthquake' && this.currentLayer !== 'fault') {
            this.showNotification('Drawing is only available on the Earthquake Map layer', 'error');
            return;
        }
        
        this.textContent.value = '';
        this.textSize.value = '16';
        this.textSizeValue.textContent = '16px';
        this.textColor.value = '#ffffff';
        this.textBackground.value = '#000000';
        this.textModalLatLng = latlng;
        this.textModal.classList.add('active');
        this.textContent.focus();
    }
    
    // Close text input modal
    closeTextModal() {
        this.textModal.classList.remove('active');
        this.textModalLatLng = null;
    }
    
    // Save text annotation from modal
    saveTextAnnotation() {
        const text = this.textContent.value.trim();
        if (text && this.textModalLatLng) {
            this.addTextAnnotation(this.textModalLatLng, text);
            this.closeTextModal();
            this.exitDrawingMode();
            this.showNotification('Text annotation added', 'success');
        }
    }
    
    // Export drawings as GeoJSON
    exportDrawings() {
        try {
            if (this.drawings.length === 0) {
                this.showNotification('No drawings to export', 'info');
                return;
            }
            
            const featureCollection = {
                type: "FeatureCollection",
                features: []
            };
            
            // Add drawn items
            this.drawnItems.eachLayer((layer) => {
                const geojson = layer.toGeoJSON();
                geojson.properties = {
                    ...geojson.properties,
                    drawingId: layer.drawingId,
                    drawingType: layer.drawingType,
                    ...layer.drawingProperties
                };
                featureCollection.features.push(geojson);
            });
            
            // Create download link
            const dataStr = JSON.stringify(featureCollection, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `quakeph_drawings_${new Date().toISOString().slice(0,10)}.geojson`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            // Show success message
            this.showNotification('Drawings exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting drawings:', error);
            this.showNotification('Error exporting drawings', 'error');
        }
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Update drawing buttons state based on current layer
    updateDrawingButtonsState() {
        const isDrawingAvailable = this.currentLayer === 'earthquake' || this.currentLayer === 'fault';
        
        Object.values(this.drawButtons).forEach(btn => {
            if (btn && btn !== this.drawButtons.clear && btn !== this.drawButtons.export) {
                if (isDrawingAvailable) {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                } else {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                }
            }
        });
    }
    
    // ... (rest of the existing earthquake-related methods remain the same)
    
    // Load fault lines data
    loadFaultLines() {
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(response => response.json())
            .then(data => {
                this.faultLines = L.geoJSON(data, {
                    style: {
                        color: '#facc15',
                        weight: 2,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties && feature.properties.Name) {
                            layer.bindPopup(`<b>Fault Line:</b> ${feature.properties.Name}`);
                        }
                    }
                });
                
                // Add to layer group
                this.faultLayerGroup.addLayer(this.faultLines);
            })
            .catch(error => {
                console.error('Error loading fault lines:', error);
            });
    }
    
    // Load earthquake data from USGS
    loadEarthquakeData() {
        this.showLoading(true);
        
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')
            .then(response => response.json())
            .then(data => {
                this.earthquakeData = data.features;
                this.displayEarthquakes();
                this.updateEarthquakeList();
                this.updateLastUpdateTime();
                this.showLoading(false);
            })
            .catch(error => {
                console.error('Error loading earthquake data:', error);
                this.showLoading(false);
                this.showNotification('Failed to load earthquake data. Please try again.', 'error');
            });
    }
    
    // Display earthquakes on map
    displayEarthquakes() {
        // Clear existing markers
        this.quakeLayerGroup.clearLayers();
        this.quakeMarkers = [];
        
        this.earthquakeData.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const latlng = [coords[1], coords[0]];
            const mag = feature.properties.mag;
            const place = feature.properties.place;
            const time = new Date(feature.properties.time);
            
            // Determine color based on magnitude
            const color = this.getMagnitudeColor(mag);
            const radius = this.getMarkerRadius(mag);
            
            // Create custom marker
            const marker = L.circleMarker(latlng, {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            });
            
            // Create popup content
            const popupContent = `
                <div class="quake-popup">
                    <h3>M ${mag.toFixed(1)}</h3>
                    <p><strong>Location:</strong> ${place}</p>
                    <p><strong>Time:</strong> ${time.toLocaleString()}</p>
                    <p><strong>Depth:</strong> ${coords[2].toFixed(1)} km</p>
                    <p><strong>Status:</strong> ${feature.properties.status}</p>
                    <button onclick="quakeMap.zoomToEarthquake(${coords[1]}, ${coords[0]})" 
                            style="margin-top: 10px; padding: 5px 10px; background: #00b4d8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Zoom to Location
                    </button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.addTo(this.quakeLayerGroup);
            
            // Store marker reference
            this.quakeMarkers.push({
                marker: marker,
                magnitude: mag,
                time: time
            });
        });
        
        // Update earthquake count badge
        this.quakeCount.textContent = this.earthquakeData.length;
    }
    
    // Update earthquake list in sidebar
    updateEarthquakeList() {
        this.quakeList.innerHTML = '';
        
        // Sort by magnitude (highest first)
        const sortedQuakes = [...this.earthquakeData].sort((a, b) => b.properties.mag - a.properties.mag);
        
        sortedQuakes.forEach(feature => {
            const mag = feature.properties.mag;
            const place = feature.properties.place;
            const time = new Date(feature.properties.time);
            const coords = feature.geometry.coordinates;
            
            const quakeItem = document.createElement('div');
            quakeItem.className = 'quake-item';
            quakeItem.style.borderLeftColor = this.getMagnitudeColor(mag);
            quakeItem.innerHTML = `
                <div class="quake-magnitude" style="color: ${this.getMagnitudeColor(mag)}">
                    M ${mag.toFixed(1)}
                </div>
                <div class="quake-location">${place}</div>
                <div class="quake-time">
                    <i class="far fa-clock"></i>
                    ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            `;
            
            // Add click event to zoom to earthquake
            quakeItem.addEventListener('click', () => {
                this.zoomToEarthquake(coords[1], coords[0]);
                this.highlightEarthquakeMarker(coords[1], coords[0]);
            });
            
            this.quakeList.appendChild(quakeItem);
        });
    }
    
    // Zoom to specific earthquake location
    zoomToEarthquake(lat, lng) {
        this.map.setView([lat, lng], 8);
        
        // Find and open marker popup
        const marker = this.quakeMarkers.find(m => 
            m.marker.getLatLng().lat === lat && m.marker.getLatLng().lng === lng
        );
        
        if (marker) {
            marker.marker.openPopup();
        }
    }
    
    // Highlight earthquake marker
    highlightEarthquakeMarker(lat, lng) {
        this.quakeMarkers.forEach(m => {
            const markerLat = m.marker.getLatLng().lat;
            const markerLng = m.marker.getLatLng().lng;
            
            if (markerLat === lat && markerLng === lng) {
                m.marker.setStyle({
                    color: '#ffffff',
                    weight: 3,
                    fillOpacity: 0.9
                });
                
                // Reset style after 3 seconds
                setTimeout(() => {
                    m.marker.setStyle({
                        color: '#ffffff',
                        weight: 1,
                        fillOpacity: 0.7
                    });
                }, 3000);
            }
        });
    }
    
    // Get color based on magnitude
    getMagnitudeColor(magnitude) {
        if (magnitude < 3) return '#4cd964'; // Green
        if (magnitude < 4) return '#ffcc00'; // Yellow
        if (magnitude < 5) return '#ff9500'; // Orange
        if (magnitude < 6) return '#ff3b30'; // Red
        return '#8b0000'; // Dark Red for 6+
    }
    
    // Get marker radius based on magnitude
    getMarkerRadius(magnitude) {
        return Math.max(magnitude * 3, 8);
    }
    
    // Update legend based on current layer
    updateLegend() {
        let legendHTML = '';
        
        if (this.currentLayer === 'earthquake') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background: #4cd964;"></div>
                    <span>Magnitude < 3.0</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ffcc00;"></div>
                    <span>Magnitude 3.0 - 3.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff9500;"></div>
                    <span>Magnitude 4.0 - 4.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff3b30;"></div>
                    <span>Magnitude 5.0 - 5.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #8b0000;"></div>
                    <span>Magnitude ≥ 6.0</span>
                </div>
            `;
        } else if (this.currentLayer === 'hazard') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-info">
                        <p>Seismic Hazard Map shows probability of strong ground shaking.</p>
                        <p>Colors indicate Peak Ground Acceleration (PGA).</p>
                    </div>
                </div>
            `;
        } else if (this.currentLayer === 'risk') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-info">
                        <p>Seismic Risk Map shows estimated economic losses.</p>
                        <p>Darker colors indicate higher risk areas.</p>
                    </div>
                </div>
            `;
        } else if (this.currentLayer === 'fault') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background: #facc15;"></div>
                    <span>Major Fault Lines</span>
                </div>
            `;
        }
        
        this.legendContent.innerHTML = legendHTML;
    }
    
    // Update last update time
    updateLastUpdateTime() {
        const now = new Date();
        this.lastUpdate.textContent = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // Show/hide loading overlay
    showLoading(show) {
        if (show) {
            this.loadingOverlay.style.display = 'flex';
        } else {
            this.loadingOverlay.style.display = 'none';
        }
    }
    
    // Setup auto-refresh of earthquake data
    setupAutoRefresh() {
        // Clear existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Set new interval (5 minutes)
        this.autoRefreshInterval = setInterval(() => {
            this.loadEarthquakeData();
        }, 5 * 60 * 1000);
    }
    
    // Switch between map layers
    switchLayer(layerId) {
        // Hide all layers
        Object.values(this.mapLayers).forEach(layer => {
            layer.classList.remove('active');
        });
        
        // Remove fault lines from map
        if (this.faultLayerGroup && this.map.hasLayer(this.faultLayerGroup)) {
            this.map.removeLayer(this.faultLayerGroup);
        }
        
        // Exit drawing mode when switching layers
        this.exitDrawingMode();
        
        // Update current layer
        this.currentLayer = layerId;
        
        // Show selected layer
        if (layerId === 'earthquake') {
            this.mapLayers.base.classList.add('active');
            this.currentLayerTitle.textContent = 'Philippine Earthquake Map';
            this.map.invalidateSize();
        } 
        else if (layerId === 'hazard') {
            this.mapLayers.hazard.classList.add('active');
            this.currentLayerTitle.textContent = 'Seismic Hazard Map';
        }
        else if (layerId === 'risk') {
            this.mapLayers.risk.classList.add('active');
            this.currentLayerTitle.textContent = 'Seismic Risk Map';
        }
        else if (layerId === 'fault') {
            this.mapLayers.base.classList.add('active');
            this.currentLayerTitle.textContent = 'Philippine Fault Lines';
            
            // Add fault lines to map
            if (this.faultLines) {
                this.map.addLayer(this.faultLayerGroup);
                this.map.invalidateSize();
            }
        }
        
        // Update legend
        this.updateLegend();
        
        // Update drawing buttons state
        this.updateDrawingButtonsState();
    }
    
    // Toggle sidebar
    toggleSidebarView() {
        this.sidebar.classList.toggle('collapsed');
        this.sidebar.classList.toggle('active');
        
        // Update toggle button icon
        const icon = this.toggleSidebar.querySelector('i');
        if (this.sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }
        
        // Invalidate map size when sidebar changes
        setTimeout(() => {
            this.map.invalidateSize();
        }, 300);
    }
    
    // Toggle earthquake panel
    toggleEarthquakePanel() {
        this.quakePanel.classList.toggle('active');
    }
    
    // Locate user
    locateUser() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }
        
        this.showLoading(true);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 10);
                this.showLoading(false);
                
                // Add user marker
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<i class="fas fa-user" style="color: #00b4d8; font-size: 24px;"></i>',
                        iconSize: [30, 30]
                    })
                })
                .addTo(this.map)
                .bindPopup('Your Location')
                .openPopup();
            },
            (error) => {
                this.showLoading(false);
                this.showNotification('Unable to retrieve your location', 'error');
            }
        );
    }
    
    // Toggle fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    
    // Initialize event listeners
    initEventListeners() {
        // Sidebar toggle
        this.toggleSidebar.addEventListener('click', () => this.toggleSidebarView());
        this.mobileToggle.addEventListener('click', () => this.toggleSidebarView());
        
        // Layer buttons
        this.layerButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update button states
                this.layerButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Switch layer
                const layerId = button.dataset.layer;
                this.switchLayer(layerId);
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
        
        // Drawing buttons
        this.drawButtons.marker.addEventListener('click', () => this.enterDrawingMode('marker'));
        this.drawButtons.line.addEventListener('click', () => this.enterDrawingMode('polyline'));
        this.drawButtons.polygon.addEventListener('click', () => this.enterDrawingMode('polygon'));
        this.drawButtons.rectangle.addEventListener('click', () => this.enterDrawingMode('rectangle'));
        this.drawButtons.circle.addEventListener('click', () => this.enterDrawingMode('circle'));
        this.drawButtons.text.addEventListener('click', () => this.startTextDrawing());
        this.drawButtons.delete.addEventListener('click', () => this.deleteSelectedDrawing());
        this.drawButtons.clear.addEventListener('click', () => this.clearAllDrawings());
        this.drawButtons.export.addEventListener('click', () => this.exportDrawings());
        
        // Drawing property controls
        this.lineWidth.addEventListener('input', (e) => {
            this.widthValue.textContent = e.target.value + 'px';
        });
        
        this.fillOpacity.addEventListener('input', (e) => {
            this.opacityValue.textContent = e.target.value + '%';
        });
        
        this.textSize.addEventListener('input', (e) => {
            this.textSizeValue.textContent = e.target.value + 'px';
        });
        
        // Modal events
        this.closeTextModal.addEventListener('click', () => this.closeTextModal());
        this.cancelText.addEventListener('click', () => this.closeTextModal());
        this.saveText.addEventListener('click', () => this.saveTextAnnotation());
        
        // Text drawing on map click
        this.map.on('click', (e) => {
            if (this.drawingMode === 'text') {
                this.openTextModal(e.latlng);
            }
        });
        
        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        });
        
        // Close earthquake panel when clicking outside on mobile
        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && 
                this.quakePanel.classList.contains('active') &&
                !this.quakePanel.contains(event.target) &&
                !this.toggleQuakePanel.contains(event.target)) {
                this.toggleEarthquakePanel();
            }
        });
        
        // Escape key to exit drawing mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDrawingActive) {
                this.exitDrawingMode();
            }
        });
    }
    
    // Toggle drawing tools visibility
    toggleDrawingTools() {
        this.drawingToolsPanel.classList.toggle('active');
        this.toggleDrawing.classList.toggle('active');
        
        if (this.drawingToolsPanel.classList.contains('active')) {
            this.showNotification('Drawing tools activated. Drawings are only available on Earthquake Map and Fault Lines layers.', 'info');
        }
    }
    
    // Start text drawing mode
    startTextDrawing() {
        this.drawingMode = 'text';
        this.showNotification('Click on the map to add text annotation', 'info');
        
        // Update button states
        Object.values(this.drawButtons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        this.drawButtons.text.classList.add('active');
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
        if (this.drawings.length > 0) {
            if (confirm('Are you sure you want to clear all drawings? This cannot be undone.')) {
                this.drawnItems.clearLayers();
                this.drawings = [];
                this.updateDrawingsList();
                localStorage.removeItem('quakeph_drawings');
                this.showNotification('All drawings cleared', 'success');
            }
        } else {
            this.showNotification('No drawings to clear', 'info');
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.quakeMap = new QuakePHMap();
});