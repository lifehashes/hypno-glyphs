class MapManager {
    constructor(physicsEngine) {
        this.engine = physicsEngine;
        this.currentMapId = null;
    }

    // Capture canvas state & send to backend
    async saveMap(mapName, userName, gridSize = '1920x1080') {
        const elements = this.engine.getElementsPayload(); // Serializes canvas shapes/modules

        const payload = {
            map_id: this.currentMapId,
            map_name: mapName,
            user_name: userName,
            grid_size: gridSize,
            elements: elements
        };

        try {
            const response = await fetch('php/save_map.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status === 'success') {
                this.currentMapId = result.map_id;
                console.log(`Map saved successfully! ID: ${result.map_id}`);
                return result;
            } else {
                console.error('Save error:', result.error);
            }
        } catch (err) {
            console.error('Network or server error:', err);
        }
    }

    // Load layout by ID and instantiate into simulation
    async loadMap(mapId) {
        try {
            const response = await fetch(`php/get_map.php?id=${mapId}`);
            const result = await response.json();

            if (result.success) {
                const mapData = result.data;
                this.currentMapId = mapData.id;

                // 1. Reset current canvas/simulation world
                this.engine.clearWorld();

                // 2. Hydrate physics entities from payload
                this.engine.loadElementsPayload(mapData.payload);

                console.log(`Loaded map "${mapData.map_name}"`);
            } else {
                console.error('Failed to load map:', result.error);
            }
        } catch (err) {
            console.error('Error fetching map:', err);
        }
    }

    // Fetch list of maps for UI selection
    async fetchMapList() {
        try {
            const response = await fetch('php/list_maps.php');

            // Check if server returned 200 OK
            if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`);
                return [];
            }

            const text = await response.text();
            if (!text) {
                console.error('php/list_maps.php returned an empty response.');
                return [];
            }

            const result = JSON.parse(text);
            return result.success ? result.data : [];
        } catch (err) {
            console.error('Error fetching map list:', err);
            return [];
        }
    }
}