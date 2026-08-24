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
 * 3. Source / Spawn Module (Uses GOL purely as a trigger generator)
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

            const activeCount = this.engine.getPopulationCount();
            
            if (activeCount > 0) {
                const c = this.center;
                const speed = 50 + (activeCount * 2); 
                const color = this.engine.intrinsicColor; 

                const angle = (this.engine.iteration * 0.3) % (Math.PI * 2);
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                const p = new Particle(c.x, c.y, vx, vy, 1.0, color);
                p.sourceId = this.id; 
                p.originHash = this.engine.originHash;
                p.currentHash = this.engine.currentHash;

                arena.addParticle(p);
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
        const dt = Math.min(0.05, (now - this.lastTime) / 1000); // Frame delta cap
        this.lastTime = now;

        // Clear canvas background
        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Update Modules
        this.modules.forEach(mod => mod.update(dt, this));

        // 2. Physics pass on Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Apply interaction forces from all Non-GOL Physics Modules
            this.modules.forEach(mod => {
                if (mod.affectParticle) {
                    mod.affectParticle(p, dt);
                }
            });

            p.update(dt);

            // Bounds check / cull out-of-bounds particles
            if (p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) {
                p.dead = true;
            }

            if (p.dead) {
                this.particles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }

        // 3. Render Module Boundaries & Nodes
        this.modules.forEach(mod => mod.draw(this.ctx));
    }
}