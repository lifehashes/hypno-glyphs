class LifeEngine {
    constructor(canvasId, gridSize) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.n = gridSize;
        this.grid = this.createGrid();
        this.opacityMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.iteration = 0;
        this.maxGenerations = 500; // Default max lifespan

        this.originHash = "";
        this.currentHash = "";
        this.intrinsicColor = "#42f485";

        this.history = new Map();
        this.isActive = true;

        this.peakMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.density = [];
        this.terminal = null;
        this.activeThreats = []; 

        this.resize();
    }

    // Add getter for engine status
    get isHalted() {
        return !this.isActive;
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

    createGrid() {
        return Array.from({ length: this.n }, () => Array(this.n).fill(0));
    }

    resetToInitial() {
        if (!this.initialBinary) return;
        this.loadFromBinary(this.initialBinary, this.maxGenerations);
    }

    loadFromBinary(binaryString, maxGen = 500) {
        this.initialBinary = binaryString;
        this.iteration = 0;
        this.maxGenerations = maxGen;
        this.history.clear();
        this.isActive = true;
        this.terminal = null;
        this.peakMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));
        this.opacityMap = Array.from({ length: this.n }, () => Array(this.n).fill(0));

        for (let i = 0; i < binaryString.length; i++) {
            const x = i % this.n;
            const y = Math.floor(i / this.n);
            if (y < this.n) {
                const val = parseInt(binaryString[i]);
                this.grid[y][x] = val;               
                this.opacityMap[y][x] = val ? 1.0 : 0.0;
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
        if (period === 1 && aliveCells === 0) return "Void";
        switch (period) {
            case 1: return "Static"; 
            case 2: return "Flicker"; 
            case 64: return "Glider"; 
            default:
                if (period % 4 === 0) return `Spaceship / Complex (P${period})`;
                return `Oscillator (P${period})`;
        }
    }

    computeNextGeneration() {
        if (!this.isActive) return false;

        let nextGrid = this.createGrid();

        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                const neighbors = this.countNeighbors(x, y);
                const currentState = this.grid[y][x];

                if (currentState === 1 && (neighbors === 2 || neighbors === 3)) {
                    nextGrid[y][x] = 1;
                } else if (currentState === 0 && neighbors === 3) {
                    nextGrid[y][x] = 1;
                } else {
                    nextGrid[y][x] = 0;
                }

                if (nextGrid[y][x] === 1) { this.peakMap[y][x]++; }
            }
        }

        const nextBinary = nextGrid.flat().join('');
        const nextHash = sha256(nextBinary);

        // Check cycle/repeat detection OR maximum database generation cap
        if (this.history.has(nextHash) || (this.iteration + 1) >= this.maxGenerations) {
            const currentGen = this.iteration + 1;
            const firstSeenGen = this.history.get(nextHash) || currentGen;
            const period = currentGen - firstSeenGen;

            const aliveCells = (nextBinary.match(/1/g) || []).length;
            this.terminal = this.classifyPeriod(period, aliveCells);

            this.isActive = false; // HALT ENGINE
            return false; 
        }

        // Apply new grid state & update opacity map directly for rendering
        this.grid = nextGrid;
        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                this.opacityMap[y][x] = this.grid[y][x] ? 1.0 : 0.0;
            }
        }

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
                const nx = (x + j + this.n) % this.n;
                const ny = (y + i + this.n) % this.n;
                count += this.grid[ny][nx];
            }
        }
        return count;
    }

    getPopulationCount() {
        let count = 0;
        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                if (this.grid[y][x] === 1) count++;
            }
        }
        return count;
    }

    render() {
        const cellSize = this.canvas.width / this.n;
        const radius = (cellSize / 2) * 0.8;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let y = 0; y < this.n; y++) {
            for (let x = 0; x < this.n; x++) {
                const alpha = this.opacityMap[y][x];
                if (alpha <= 0.01) continue;

                const centerX = x * cellSize + (cellSize / 2);
                const centerY = y * cellSize + (cellSize / 2);
                const isEdge = (x === 0 || x === this.n - 1 || y === 0 || y === this.n - 1);

                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.shadowBlur = 5 * alpha;
                this.ctx.shadowColor = this.intrinsicColor;

                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

                if (isEdge) {
                    this.ctx.fillStyle = this.intrinsicColor;
                    this.ctx.fill();
                } else {
                    this.ctx.strokeStyle = this.intrinsicColor;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.stroke();
                }
                
                this.ctx.restore();
            }
        }
    }
}