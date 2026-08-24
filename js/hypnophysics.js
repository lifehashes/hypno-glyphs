/**
 * 1. Particle Definition
 * Simple physical entities that move through the arena.
 */
class Particle {
    constructor(x, y, vx, vy, charge = 1, color = '#ffffff') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.ax = 0;
        this.ay = 0;
        this.charge = charge; // e.g., positive, negative, neutral
        this.color = color;
        this.life = 1.0;     // Opacity / lifespan factor
        this.dead = false;
    }

    update(dt) {
        // Integrate forces
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Reset accelerations for next frame
        this.ax = 0;
        this.ay = 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * 2. Abstract Base Module
 * Base container footprint (e.g. 70x70) for grid-packing 20-50 modules.
 */
class ArenaModule {
    constructor(id, x, y, width = 70, height = 70, type = 'GENERIC') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    // Centroid of the module box
    get center() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    update(dt, arena) {}

    // Physics modules influence particles directly
    affectParticle(particle, dt) {}

    draw(ctx) {
        // Render modular border footprint
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * 3. Source / Spawn Module (Emits particles based on live outer edge cells)
 */
class SourceSpawnModule extends ArenaModule {
    constructor(id, x, y, width, height, lifeEngine, label = 'EMITTER') {
        super(id, x, y, width, height, 'SOURCE_SPAWN');
        this.engine = lifeEngine;
        this.label = label;
        this.stepTimer = 0;
        this.stepInterval = 0.2;
    }

    update(dt, arena) {
        // Do not update or emit if engine has reached its terminal/halt state
        if (!this.engine.isActive) return;

        this.stepTimer += dt;
        if (this.stepTimer >= this.stepInterval) {
            this.stepTimer = 0;

            const n = this.engine.n;
            const c = this.center;
            const color = this.engine.intrinsicColor;
            const baseSpeed = 80;

            // Iterate over the grid to locate outer edge live cells
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const isEdge = (x === 0 || x === n - 1 || y === 0 || y === n - 1);
                    
                    if (isEdge && this.engine.grid[y][x] === 1) {
                        // Calculate offset coordinates mapped to module box bounds
                        const offsetX = (x / (n - 1) - 0.5) * this.width;
                        const offsetY = (y / (n - 1) - 0.5) * this.height;

                        const spawnX = c.x + offsetX;
                        const spawnY = c.y + offsetY;

                        // Calculate outward direction vector away from module center
                        let dx = spawnX - c.x;
                        let dy = spawnY - c.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        // Fallback vector for exact center corner cases
                        if (dist === 0) {
                            dx = 1;
                            dy = 0;
                            dist = 1;
                        }

                        const vx = (dx / dist) * baseSpeed;
                        const vy = (dy / dist) * baseSpeed;

                        // Emit particle from exact edge cell position
                        const p = new Particle(spawnX, spawnY, vx, vy, 1.0, color);
                        p.sourceId = this.id;
                        p.originHash = this.engine.originHash;
                        p.currentHash = this.engine.currentHash;

                        arena.addParticle(p);
                    }
                }
            }

            // Advance state
            this.engine.computeNextGeneration();
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();
        ctx.fillStyle = this.engine.intrinsicColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.engine.intrinsicColor;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(this.label, this.x + 4, this.y + 12);
        ctx.restore();
    }
}

/**
 * 4. Example Physics Module: Gravity/Attractor (NO GOL involved)
 */
class AttractorModule extends ArenaModule {
    constructor(id, x, y, width, height, strength = 5000) {
        super(id, x, y, width, height, 'ATTRACTOR');
        this.strength = strength;
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = c.x - particle.x;
        const dy = c.y - particle.y;
        const distSq = Math.max(100, dx * dx + dy * dy); // Clamp min distance
        const force = this.strength / distSq;

        const dist = Math.sqrt(distSq);
        particle.ax += (dx / dist) * force;
        particle.ay += (dy / dist) * force;
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();
        ctx.strokeStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * 5. Master Arena Manager
 */
class ArenaManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.modules = new Map();
        this.particles = [];
        this.lastTime = performance.now();
    }

    addModule(module) { this.modules.set(module.id, module); }
    addParticle(particle) { this.particles.push(particle); }

    // Auto-arrange 20 to 50 modules cleanly
    layoutGrid(cols = 8, padding = 15, modWidth = 65, modHeight = 65) {
        let idx = 0;
        this.modules.forEach(mod => {
            const c = idx % cols;
            const r = Math.floor(idx / cols);
            mod.x = padding + c * (modWidth + padding);
            mod.y = padding + r * (modHeight + padding);
            mod.width = modWidth;
            mod.height = modHeight;
            idx++;
        });
    }

    updateAndRender() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Update Modules[cite: 23]
        this.modules.forEach(mod => mod.update(dt, this));

        // 2. Physics pass on Particles[cite: 23]
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            this.modules.forEach(mod => {
                if (mod.affectParticle) {
                    mod.affectParticle(p, dt);
                }
            });

            p.update(dt);

            if (p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) {
                p.dead = true;
            }

            if (p.dead) {
                this.particles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }

        // 3. Resolve Particle-to-Particle Collisions
        this.handleParticleCollisions();

        // 4. Render Module Boundaries & Nodes[cite: 23]
        this.modules.forEach(mod => mod.draw(this.ctx));
    }

    // Add this method inside ArenaManager class in js/hypnophysics.js
    handleParticleCollisions() {
        const particleRadius = 2.5; // Radius from Particle.draw()
        const minDist = particleRadius * 2;
        const minDistSq = minDist * minDist;
        const len = this.particles.length;

        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];

            for (let j = i + 1; j < len; j++) {
                const p2 = this.particles[j];

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                // Collision detected!
                if (distSq < minDistSq && distSq > 0) {
                    const dist = Math.sqrt(distSq);

                    // Normal vector along collision axis
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // 1. Separate particles to prevent overlap sticking
                    const overlap = 0.5 * (minDist - dist);
                    p1.x -= nx * overlap;
                    p1.y -= ny * overlap;
                    p2.x += nx * overlap;
                    p2.y += ny * overlap;

                    // 2. Relative velocity along normal vector
                    const kx = p1.vx - p2.vx;
                    const ky = p1.vy - p2.vy;
                    const p = kx * nx + ky * ny;

                    // Only bounce if particles are moving toward each other
                    if (p > 0) {
                        p1.vx -= p * nx;
                        p1.vy -= p * ny;
                        p2.vx += p * nx;
                        p2.vy += p * ny;
                    }
                }
            }
        }
    }

}