class LifeEngine {
    constructor(canvasId, gridSize) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.n = gridSize;
        this.grid = this.createGrid();
        this.opacityMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.iteration = 0;

        this.originHash = "";
        this.currentHash = "";
        this.intrinsicColor = "#42f485";

        this.history = new Map();
        this.isActive = true;

        this.peakMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.density = [];
        this.terminal = null;

        this.activeThreats = []; 

        // Auto-fit canvas resolution to parent layout dimensions
        this.resize();
    }

    resize() {
        const parent = this.canvas.parentElement;
        const size = parent ? parent.clientWidth : 256;
        
        this.canvas.width = size;
        this.canvas.height = size;
        this.render();
    }

    getBinaryString() {
        return this.grid.flat().join('');
    }

    // Initialize an empty 2D array
    createGrid() {
        return Array.from({ length: this.n }, () => Array(this.n).fill(0));
    }

    // Fill the grid from your 256-bit binary string (or any length n*n)
    loadFromBinary(binaryString) {

        this.iteration = 0;
        this.history.clear();
        this.isActive = true;
        this.peakMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.opacityMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));

        for (let i = 0; i < binaryString.length; i++) {
            const x = i % this.n;
            const y = Math.floor(i / this.n);
            if (y < this.n) {
                const val = parseInt(binaryString[i]);
                this.grid[y][x] = val;               
                this.opacityMap[y][x] = val ? 1.0 : 0.0; // Start alive cells at full opacity
                if (val === 1) { this.peakMap[y][x] = 1; }
            }
        }

        this.density = [this.getPopulationCount()];

        this.originHash = sha256(binaryString);
        this.currentHash = this.originHash;
        this.history.set(this.originHash, 0);

        const hexColor = this.originHash.substring(3, 9);
        this.intrinsicColor = "#" + hexColor;

        this.render();
    }

    classifyPeriod(period, aliveCells) {
        if (period === 1 && aliveCells === 0) {
            return "Void";
        }

        switch (period) {
            case 1:
                return "Static"; 
            case 2:
                return "Flicker"; 
            case 64:
                return "Glider"; 
            default:
                if (period % 4 === 0) {
                    return `Spaceship / Complex (P${period})`;
                }
                return `Oscillator (P${period})`;
        }
    }

    // The core GOL logic with Toroidal wrapping
    computeNextGeneration() {
        let nextGrid = this.createGrid();

        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                const neighbors = this.countNeighbors(x, y);
                const currentState = this.grid[y][x];

                if (currentState === 1 && (neighbors === 2 || neighbors === 3)) {
                    nextGrid[y][x] = 1; // Survival
                } else if (currentState === 0 && neighbors === 3) {
                    nextGrid[y][x] = 1; // Birth
                } else {
                    nextGrid[y][x] = 0; // Death
                }

                if (nextGrid[y][x] === 1) { this.peakMap[y][x]++; }
            }
        }

        // Calculate hash of the potential next state
        const nextBinary = nextGrid.flat().join('');
        const nextHash = sha256(nextBinary);

        // Check if this state has appeared before (Cycle Detection)
        if (this.history.has(nextHash)) {
            // Determine the current generation we are computing
            const currentGen = this.iteration + 1;
            // Get the generation index when it was first encountered
            const firstSeenGen = this.history.get(nextHash);
            // Calculate the exact cycle period
            const period = currentGen - firstSeenGen;

            // Classify and set the terminal state metric
            const aliveCells = (nextBinary.match(/1/g) || []).length;
            this.terminal = this.classifyPeriod(period, aliveCells);

            this.isActive = false;
            return false; 
        }

        // State is unique: Proceed with update
        this.grid = nextGrid;
        this.iteration++;
        this.currentHash = nextHash;
        this.history.set(nextHash, this.iteration);
        this.density.push(this.getPopulationCount());
        return true;
    }

    countNeighbors(x, y) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                
                // Torus wrapping logic: (coord + max) % max
                const nx = (x + j + this.n) % this.n;
                const ny = (y + i + this.n) % this.n;
                count += this.grid[ny][nx];
            }
        }
        return count;
    }

    getPeakMetric() {
        let maxPeak = 0;
        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                if (this.peakMap[y][x] > maxPeak) {
                    maxPeak = this.peakMap[y][x];
                }
            }
        }
        return maxPeak;
    }

    /**
     * Snapshots the current opacity map before computing the next step.
     */
    snapshotOpacities() {
        this.startOpacityMap = this.opacityMap.map(row => [...row]);
    }

    /**
     * Smoothly interpolates opacity between startOpacityMap and target grid state.
     * @param {number} progress - Progress fraction from 0.0 to 1.0
     */
    updateCellOpacities(progress) {
        if (!this.startOpacityMap) {
            this.startOpacityMap = this.opacityMap.map(row => [...row]);
        }

        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                const targetOpacity = this.grid[y][x];
                const startOpacity = this.startOpacityMap[y][x];
                
                // Linear interpolation: start + (target - start) * progress
                this.opacityMap[y][x] = startOpacity + (targetOpacity - startOpacity) * progress;
            }
        }
    }

    /**
     * Registers an edge threat or takeover indicator for the current render frame
     */
    setEdgeIndicator(edge, color, isSolid) {
        this.activeThreats.push({ edge, color, isSolid });
    }

    /**
     * Renders active edge indicators superimposed over pattern cells
     */
    renderEdgeIndicators() {
        if (!this.activeThreats || this.activeThreats.length === 0) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const arrowSize = Math.max(8, Math.floor(w * 0.08)); // Scale arrow relative to canvas size

        this.activeThreats.forEach(threat => {
            ctx.save();
            ctx.fillStyle = threat.color;
            ctx.strokeStyle = threat.color;
            ctx.lineWidth = 2;

            ctx.beginPath();

            if (threat.edge === 'right') {
                ctx.moveTo(w - arrowSize - 4, h / 2 - arrowSize / 2);
                ctx.lineTo(w - 4, h / 2);
                ctx.lineTo(w - arrowSize - 4, h / 2 + arrowSize / 2);
            } else if (threat.edge === 'left') {
                ctx.moveTo(arrowSize + 4, h / 2 - arrowSize / 2);
                ctx.lineTo(4, h / 2);
                ctx.lineTo(arrowSize + 4, h / 2 + arrowSize / 2);
            } else if (threat.edge === 'top') {
                ctx.moveTo(w / 2 - arrowSize / 2, arrowSize + 4);
                ctx.lineTo(w / 2, 4);
                ctx.lineTo(w / 2 + arrowSize / 2, arrowSize + 4);
            } else if (threat.edge === 'bottom') {
                ctx.moveTo(w / 2 - arrowSize / 2, h - arrowSize - 4);
                ctx.lineTo(w / 2, h - 4);
                ctx.lineTo(w / 2 + arrowSize / 2, h - arrowSize - 4);
            }

            ctx.closePath();

            if (threat.isSolid) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = threat.color;
                ctx.fill();
            } else {
                ctx.stroke();
            }

            ctx.restore();
        });

        // Clear threat buffer after rendering for the frame
        this.activeThreats = [];
    }

    render() {
        const cellSize = this.canvas.width / this.n;
        const radius = (cellSize / 2) * 0.8;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                const alpha = this.opacityMap[y][x];
                
                // Skip rendering completely invisible cells
                if (alpha <= 0.01) continue;

                const centerX = x * cellSize + (cellSize / 2);
                const centerY = y * cellSize + (cellSize / 2);
                
                // Identify perimeter border cells along the torus boundaries
                const isEdge = (x === 0 || x === this.n - 1 || y === 0 || y === this.n - 1);

                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.shadowBlur = 5 * alpha;
                this.ctx.shadowColor = this.intrinsicColor;

                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

                if (isEdge) {
                    // Border/Perimeter cells render as SOLID filled discs
                    this.ctx.fillStyle = this.intrinsicColor;
                    this.ctx.fill();
                } else {
                    // Interior cells render as HOLLOW rings
                    this.ctx.strokeStyle = this.intrinsicColor;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                }
                
                this.ctx.restore();
            }
        }

        // Render superimposed edge threat indicators if active
        this.renderEdgeIndicators();
    }

    getPopulationCount() {
        let count = 0;
        // Iterate through the rows
        for (let y = 0; y < this.n; y++) {
            // Iterate through the columns
            for (let x = 0; x < this.n; x++) {
                if (this.grid[y][x] === 1) count++;
            }
        }
        return count;
    }

    resetToOrigin(binaryString) {
        this.iteration = 0;
        this.history.clear();
        this.isActive = true;
        
        // Reload the grid from the binary string we started with
        for (let i = 0; i < binaryString.length; i++) {
            const x = i % this.n;
            const y = Math.floor(i / this.n);
            if (y < this.n) {
                this.grid[y][x] = parseInt(binaryString[i]);
            }
        }
        
        this.currentHash = this.originHash;
        this.history.set(this.originHash, 0);
        this.density = [this.getPopulationCount()];
        this.render();
    }

}