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
        this.charge = charge;
        this.chargeVal = 0; // Electrical charge: -4 to +4
        this.color = color;
        this.life = 1.0;
        this.dead = false;
        this.isAnti = false;
        this.ringRotation = 0; // Rotation angle for animated shell spinning

        // NEW: Age tracking in seconds and shakes
        this.ageSeconds = 0;
        this.ageShakes = 0; // 1 shake = 10 seconds

    }

    update(dt) {
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Accumulate runtime age
        this.ageSeconds += dt;
        this.ageShakes = Math.floor(this.ageSeconds / 10); //

        this.ax = 0;
        this.ay = 0;

        // Rotate concentric rings: Clockwise for positive, Counter-clockwise for negative
        if (this.chargeVal !== 0) {
            const dir = Math.sign(this.chargeVal);
            this.ringRotation += dir * dt * 4;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);

        if (this.isAnti) {
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else {
            ctx.fill();
        }

        // Render thin concentric shells based on absolute charge value
        const numRings = Math.abs(this.chargeVal);
        if (numRings > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.ringRotation);
            ctx.shadowBlur = 0;
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = this.chargeVal > 0 ? '#00e1ff' : '#ff3366'; // Blue (+) / Red (-)

            for (let r = 1; r <= numRings; r++) {
                const ringRadius = 3.5 + r * 2.2;
                ctx.beginPath();
                // Draw thin arc shells with gaps to make rotation visible
                ctx.arc(0, 0, ringRadius, 0, Math.PI * 1.5);
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.restore();
    }
}

/**
 * 2. Abstract Base Module
 * Base container footprint (e.g. 70x70) for grid-packing 20-50 modules.
 */
class ArenaModule {
    constructor(id, x, y, width = 80, height = 80, type = 'GENERIC') {
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
        ctx.save();
        // Safely check window.selectedModule without throwing a ReferenceError
        if (typeof window !== 'undefined' && window.selectedModule === this) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
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

    affectParticle(particle, dt) {
        // Cross-conversion rule: Particles entering an opposing source's box adopt its properties
        if (particle.sourceId !== this.id) {
            const inX = particle.x >= this.x && particle.x <= this.x + this.width;
            const inY = particle.y >= this.y && particle.y <= this.y + this.height;

            if (inX && inY) {
                particle.sourceId = this.id;
                particle.color = this.engine.intrinsicColor;
                particle.originHash = this.engine.originHash;
                particle.currentHash = this.engine.currentHash;
            }
        }
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
        ctx.strokeStyle = this.engine.intrinsicColor;
        ctx.fillStyle = this.engine.intrinsicColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.engine.intrinsicColor;

        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);

        // Filled dot while active, hollow ring shell when halted/inactive
        if (this.engine.isActive) {
            ctx.fill();
        } else {
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, c.x, this.y + 12);
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
        this.effects = []; // Visual effect queue
        this.lastTime = performance.now();
        this.boundaryMode = 'none'; // 'none' | 'toroidal' | 'box'
        this.clusters = [];

        this.globalGravityEnabled = false;
        this.globalGravityForce = 300; // Adjust force intensity as desired
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

    handleParticleBoundaries(p) {
        const r = 2.5;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.boundaryMode === 'none') {
            if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
                p.dead = true;
            }
        } else if (this.boundaryMode === 'toroidal') {
            if (p.x < 0) p.x += w;
            if (p.x > w) p.x -= w;
            if (p.y < 0) p.y += h;
            if (p.y > h) p.y -= h;
        } else if (this.boundaryMode === 'box') {
            if (p.x - r < 0) {
                p.x = r;
                p.vx *= -1;
            } else if (p.x + r > w) {
                p.x = w - r;
                p.vx *= -1;
            }

            if (p.y - r < 0) {
                p.y = r;
                p.vy *= -1;
            } else if (p.y + r > h) {
                p.y = h - r;
                p.vy *= -1;
            }
        }
    }

    drawBoundaryVisuals() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        if (this.boundaryMode === 'toroidal') {
            ctx.save();
            ctx.strokeStyle = '#42f485';
            ctx.shadowColor = '#42f485';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.restore();
        } else if (this.boundaryMode === 'box') {
            ctx.save();
            const bw = 8; // Border thickness

            // Create offscreen striped pattern canvas
            const patCanvas = document.createElement('canvas');
            patCanvas.width = 16;
            patCanvas.height = 16;
            const pctx = patCanvas.getContext('2d');

            pctx.fillStyle = '#111111';
            pctx.fillRect(0, 0, 16, 16);
            pctx.fillStyle = '#e5c100';

            pctx.beginPath();
            pctx.moveTo(0, 8);  pctx.lineTo(8, 0);   pctx.lineTo(16, 0); pctx.lineTo(0, 16); pctx.fill();
            pctx.beginPath();
            pctx.moveTo(16, 8); pctx.lineTo(8, 16);  pctx.lineTo(16, 16); pctx.fill();

            const pattern = ctx.createPattern(patCanvas, 'repeat');
            ctx.fillStyle = pattern;

            // Render hazard frames around canvas edges
            ctx.fillRect(0, 0, w, bw);             // Top
            ctx.fillRect(0, h - bw, w, bw);         // Bottom
            ctx.fillRect(0, 0, bw, h);             // Left
            ctx.fillRect(w - bw, 0, bw, h);         // Right

            ctx.restore();
        }
    }

    updateAndRender() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Update Modules
        this.modules.forEach(mod => mod.update(dt, this));
        this.handleElectrostaticInteractions();

        // 2. Physics pass on Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // NEW: Apply constant vertical acceleration downward if enabled
            if (this.globalGravityEnabled) {
                p.ay += this.globalGravityForce;
            }

            this.modules.forEach(mod => {
                if (mod.affectParticle) {
                    mod.affectParticle(p, dt, this);
                }
            });

            p.update(dt);
            this.handleParticleBoundaries(p);

            if (p.dead) {
                this.particles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }

        // clustering of magnetized particles
        for (let i = this.clusters.length - 1; i >= 0; i--) {
            const cluster = this.clusters[i];
            cluster.update(dt);
            if (cluster.dead) {
                this.clusters.splice(i, 1);
            }
        }

        // 3. Resolve Particle Collisions & Visuals...
        this.handleParticleCollisions();

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.update(dt);
            fx.draw(this.ctx);
            if (fx.dead) {
                this.effects.splice(i, 1);
            }
        }

        this.drawBoundaryVisuals();
        this.modules.forEach(mod => mod.draw(this.ctx));
    }

    handleParticleCollisions() {
        const particleRadius = 2.5;
        const minDist = particleRadius * 2;
        const minDistSq = minDist * minDist;
        const len = this.particles.length;

        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];
            if (p1.dead) continue;

            for (let j = i + 1; j < len; j++) {
                const p2 = this.particles[j];
                if (p2.dead) continue;

                if ((p1.isAnti || p2.isAnti) && p1.sourceId !== p2.sourceId) continue; 

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq && distSq > 0) {
                    
                    // MAGNETIC CLUSTER STICKING / SHATTERING
                    if (p1.isMagnetic && p2.isMagnetic) {
                        if (!p1.cluster && !p2.cluster) {
                            const cluster = new MagneticCluster(p1, p2);
                            this.clusters.push(cluster); // <-- ADD THIS LINE
                        } else if (p1.cluster && !p2.cluster) {
                            p1.cluster.addParticleNode(p2);
                        } else if (!p1.cluster && p2.cluster) {
                            p2.cluster.addParticleNode(p1);
                        } else if (p1.cluster !== p2.cluster) {
                            p1.cluster.mergeCluster(p2.cluster);
                        }
                        continue;
                    }

                    // HIGH VELOCITY IMPACT SHATTERS EXISTING CLUSTERS
                    const relativeSpeed = Math.hypot(p1.vx - p2.vx, p1.vy - p2.vy);
                    if (relativeSpeed > 300) {
                        if (p1.cluster) p1.cluster.shatter(this, p2.vx, p2.vy);
                        if (p2.cluster) p2.cluster.shatter(this, p1.vx, p1.vy);
                    }

                    // Matter / Anti-Matter Annihilation
                    if (p1.sourceId === p2.sourceId && p1.isAnti !== p2.isAnti) {
                        p1.dead = true;
                        p2.dead = true;
                        
                        if (p1.cluster) p1.cluster.shatter(this);
                        if (p2.cluster) p2.cluster.shatter(this);

                        const epicX = (p1.x + p2.x) / 2;
                        const epicY = (p1.y + p2.y) / 2;
                        this.effects.push(new ExplosionFlash(epicX, epicY, 40, p1.color));
                        break;
                    }

                    // Elastic rebound (if not stuck magnetically)
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const overlap = 0.5 * (minDist - dist);
                    p1.x -= nx * overlap;
                    p1.y -= ny * overlap;
                    p2.x += nx * overlap;
                    p2.y += ny * overlap;

                    const kx = p1.vx - p2.vx;
                    const ky = p1.vy - p2.vy;
                    const p = kx * nx + ky * ny;

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

    handleElectrostaticInteractions() {
        const interactionRadius = 45; // Short-range cutoff distance
        const cutoffSq = interactionRadius * interactionRadius;
        const coulombConstant = 18000;
        const len = this.particles.length;

        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];
            if (p1.dead || p1.chargeVal === 0) continue;

            for (let j = i + 1; j < len; j++) {
                const p2 = this.particles[j];
                if (p2.dead || p2.chargeVal === 0) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < cutoffSq && distSq > 16) {
                    const dist = Math.sqrt(distSq);
                    
                    // Coulomb's Law (F = k * q1 * q2 / r^2)
                    // Positive force = Repulsion (like charges), Negative force = Attraction (opposite charges)
                    const forceMagnitude = (coulombConstant * p1.chargeVal * p2.chargeVal) / distSq;

                    const fx = (dx / dist) * forceMagnitude;
                    const fy = (dy / dist) * forceMagnitude;

                    // Impart equal and opposite acceleration forces
                    p1.ax -= fx;
                    p1.ay -= fy;
                    p2.ax += fx;
                    p2.ay += fy;
                }
            }
        }
    }

    /**
     * Calculates responsive integer-based primary and secondary grid step sizes.
     * Ensures strict mathematical alignment regardless of canvas width/height.
     */
    getGridDimensions(baseCellSize = 80, subDivisions = 4) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Determine total integer columns/rows that cleanly fit or divide the space
        const cols = Math.max(1, Math.round(w / baseCellSize));
        const rows = Math.max(1, Math.round(h / baseCellSize));

        // Integer primary grid step
        const primaryStepX = w / cols;
        const primaryStepY = h / rows;

        // Subdivided fine grid step
        const secondaryStepX = primaryStepX / subDivisions;
        const secondaryStepY = primaryStepY / subDivisions;

        return {
            cols,
            rows,
            primaryStepX,
            primaryStepY,
            secondaryStepX,
            secondaryStepY,
            subDivisions
        };
    }

    /**
     * Renders two-tier helper grid overlay in Edit Mode.
     */
    drawEditGrid(baseCellSize = 80, subDivisions = 4) {
        const grid = this.getGridDimensions(baseCellSize, subDivisions);
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();

        // 1. Draw Secondary Grid (Finer, thin lines)
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();

        for (let x = 0; x <= w; x += grid.secondaryStepX) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = 0; y <= h; y += grid.secondaryStepY) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();

        // 2. Draw Primary Grid (Thicker, prominent lines)
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let x = 0; x <= w; x += grid.primaryStepX) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, h);
        }
        for (let y = 0; y <= h; y += grid.primaryStepY) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(w, Math.round(y) + 0.5);
        }
        ctx.stroke();

        // =========================================================
        // 3. NEW: Extra Thick & Brighter Central Axis Crosshairs
        // =========================================================
        const midX = Math.round(w / 2) + 0.5;
        const midY = Math.round(h / 2) + 0.5;

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.45)'; // Brighter cyan opacity
        ctx.lineWidth = 3.5;                         // Extra thick line width
        ctx.shadowBlur = 8;                          // Glowing neon effect
        ctx.shadowColor = 'rgba(0, 255, 255, 0.6)';

        ctx.beginPath();
        // Vertical center line
        ctx.moveTo(midX, 0);
        ctx.lineTo(midX, h);

        // Horizontal center line
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();

        ctx.restore();
    }

    renderOnly() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(5, 5, 5, 1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Helper Grid if Edit Mode is enabled
        if (typeof window !== 'undefined' && window.isEditMode) {
            this.drawEditGrid(80, 4); // 80px Primary Grid, 4 Subdivisions (20px fine grid)
        }

        // Render existing particles (if paused mid-simulation)
        this.particles.forEach(p => p.draw(this.ctx));

        // Render boundary lines and dropped modules
        this.drawBoundaryVisuals();
        this.modules.forEach(mod => mod.draw(this.ctx));
    }

    removeModule(idOrModule) {
        const id = typeof idOrModule === 'string' ? idOrModule : idOrModule.id;
        this.modules.delete(id);
    }

}

/**
 * Sink / Drain Module (Destroys particles & increments/decrements score based on charge magnitude and particle age)
 */
class SinkModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, scoreTracker) {
        super(id, x, y, width, height, 'SINK');
        this.scoreTracker = scoreTracker; // Reference to track score state
        this.radius = Math.min(width, height) / 2;
    }

    affectParticle(particle, dt) {
        // Block compound clusters from entering/draining
        if (particle.cluster) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        // Drain particle if inside sink boundary
        if (distSq <= (this.radius * 0.8) ** 2) {
            particle.dead = true;

            // 1. Calculate Charge Multiplier
            const chargeMagnitude = Math.abs(particle.chargeVal);
            const chargeMultiplier = chargeMagnitude > 0 ? chargeMagnitude : 1;

            // 2. Calculate Age Multiplier (1 Shake = 10s, minimum multiplier of 1)
            const ageMultiplier = Math.max(1, particle.ageShakes);

            // 3. Compute Net Point Value
            // Matter gives + (Charge * Age), Anti-Matter gives - (Charge * Age)
            const pointValue = (particle.isAnti ? -1 : 1) * chargeMultiplier * ageMultiplier;

            // 4. Credit / Debit the appropriate source score
            if (particle.sourceId && particle.sourceId.includes('alpha')) {
                this.scoreTracker.alphaScore += pointValue;
            } else if (particle.sourceId && particle.sourceId.includes('beta')) {
                this.scoreTracker.betaScore += pointValue;
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();
        
        // Vortex core visual
        ctx.strokeStyle = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('DRAIN SINK', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * QCD Inverter Module
 * Flips the quantum polarity of entering particles:
 * Matter -> Anti-Matter, and Anti-Matter -> Matter.
 */
class QCDInverterModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80) {
        super(id, x, y, width, height, 'QCD_INVERTER');
        this.radius = Math.min(width, height) / 2;
        this.pulseAngle = 0;
        // Tracks particles currently residing inside the inversion zone
        this.activeParticles = new Set();
    }

    update(dt) {
        this.pulseAngle += dt * 3;
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            // Toggle state only on the initial frame the particle enters the zone
            if (!this.activeParticles.has(particle)) {
                particle.isAnti = !particle.isAnti;
                this.activeParticles.add(particle);
            }
        } else {
            // Remove particle from set once it exits the zone so it can be inverted again later
            this.activeParticles.delete(particle);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();

        // Inversion field visuals
        ctx.strokeStyle = '#ff00ff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff00ff';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.75, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'center';
        ctx.fillText('QCD INVERTER', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * ExplosionFlash Effect
 * Manages expanding ring shockwaves and glowing flash centers.
 */
class ExplosionFlash {
    constructor(x, y, maxRadius = 35, color = '#ffffff') {
        this.x = x;
        this.y = y;
        this.radius = 2;
        this.maxRadius = maxRadius;
        this.color = color;
        this.life = 1.0;
        this.dead = false;
    }

    update(dt) {
        // Expand rapidly and fade out
        this.radius += (this.maxRadius - this.radius) * 12 * dt;
        this.life -= 3.5 * dt;

        if (this.life <= 0) {
            this.dead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);

        // Radial core flash
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Expanding outer ring shockwave
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * Doubler Module
 * Spawns a clone particle upon entry and applies a slight trajectory divergence.
 */
class DoublerModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80) {
        super(id, x, y, width, height, 'DOUBLER');
        this.radius = Math.min(width, height) / 2;
        // Tracks particles that have already passed through to prevent infinite duplication loop
        this.processedParticles = new WeakSet();
    }

    affectParticle(particle, dt, arena) {
        // Skip if particle has already been cloned by this module
        if (this.processedParticles.has(particle)) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= (this.radius * 0.7) ** 2) {
            // Mark original particle as processed
            this.processedParticles.add(particle);

            // Calculate slightly deflected velocity for the clone (+/- 15 degrees)
            const angle = (Math.random() - 0.5) * (Math.PI / 6);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const cloneVx = particle.vx * cos - particle.vy * sin;
            const cloneVy = particle.vx * sin + particle.vy * cos;

            // Instantiate duplicate particle
            const clone = new Particle(
                particle.x,
                particle.y,
                cloneVx,
                cloneVy,
                particle.charge,
                particle.color
            );

            // Retain source metadata and anti-matter state
            clone.sourceId = particle.sourceId;
            clone.originHash = particle.originHash;
            clone.currentHash = particle.currentHash;
            clone.isAnti = particle.isAnti;

            // Mark clone as processed so it doesn't trigger immediate duplicate loop inside same module
            this.processedParticles.add(clone);

            // Add clone to active particle pool
            arena.addParticle(clone);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();

        // Dual concentric ring visual
        ctx.strokeStyle = '#ffbb00';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffbb00';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#ffbb00';
        ctx.textAlign = 'center';
        ctx.fillText('DOUBLER', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Charger Module
 * Imbues positive or negative electrical charge to passing particles (capped at +/-4).
 */
class ChargerModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, polarity = 1) {
        super(id, x, y, width, height, 'CHARGER');
        this.polarity = Math.sign(polarity) || 1; // +1 or -1
        this.radius = Math.min(width, height) / 2;
        this.activeParticles = new Set();
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            if (!this.activeParticles.has(particle)) {
                // Adjust charge state and clamp to max limit [-4, 4]
                particle.chargeVal = Math.min(4, Math.max(-4, particle.chargeVal + this.polarity));
                this.activeParticles.add(particle);
            }
        } else {
            this.activeParticles.delete(particle);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        const isPos = this.polarity > 0;
        const color = isPos ? '#00e1ff' : '#ff3366';

        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.lineWidth = 1.5;

        // Visual field boundary
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        // Polarity Symbol
        ctx.fillStyle = color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isPos ? '+' : '−', c.x, c.y);

        ctx.font = '9px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(isPos ? '+CHARGER' : '-CHARGER', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Capacitor Module
 * Carries a strong fixed electrical charge and attracts/repels charged particles.
 */
class CapacitorModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, chargeVal = 2, strength = 18000) {
        super(id, x, y, width, height, 'CAPACITOR');
        this.chargeVal = chargeVal; // Fixed charge (+ / -)
        this.strength = strength;   // Force scaling multiplier
        this.radius = Math.min(width, height) / 2;
    }

    affectParticle(particle, dt) {
        // Skip neutral particles
        if (particle.chargeVal === 0) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = Math.max(100, dx * dx + dy * dy); // Clamp minimum distance
        const dist = Math.sqrt(distSq);

        // Electrostatic force calculation: F = (k * q1 * q2) / r^2
        // Repels like charges, attracts opposite charges
        const forceMagnitude = (this.strength * this.chargeVal * particle.chargeVal) / distSq;

        particle.ax += (dx / dist) * forceMagnitude;
        particle.ay += (dy / dist) * forceMagnitude;
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        const isPos = this.chargeVal > 0;
        const color = isPos ? '#00e1ff' : '#ff3366';

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        // Double parallel plate visual
        const hw = this.width * 0.25;
        const hh = this.height * 0.25;
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Left plate
        ctx.moveTo(c.x - hw, c.y - hh);
        ctx.lineTo(c.x - hw, c.y + hh);
        // Right plate
        ctx.moveTo(c.x + hw, c.y - hh);
        ctx.lineTo(c.x + hw, c.y + hh);
        ctx.stroke();

        // Polarity Label
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isPos ? '+' : '−', c.x, c.y);

        ctx.font = '9px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText('CAPACITOR', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Kinetic Converter Module
 * Halves or doubles the velocity of particles passing through its zone.
 * mode: 'double' | 'half' (or multiplier value like 2.0 / 0.5)
 */
class KineticConverterModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, mode = 'double') {
        super(id, x, y, width, height, 'KINETIC_CONVERTER');
        this.mode = mode; // 'double' or 'half'
        this.multiplier = mode === 'half' ? 0.5 : 2.0;
        this.radius = Math.min(width, height) / 2;
        this.activeParticles = new Set();
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            // Scale velocity once when entering the zone boundary
            if (!this.activeParticles.has(particle)) {
                particle.vx *= this.multiplier;
                particle.vy *= this.multiplier;
                this.activeParticles.add(particle);
            }
        } else {
            // Reset state once particle leaves field
            this.activeParticles.delete(particle);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        const isDouble = this.multiplier > 1.0;
        const color = isDouble ? '#ff9900' : '#00bfff';

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.lineWidth = 1.5;

        // Circular accelerator zone outline
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Directional Chevron Arrows (Up for Fast, Down for Slow)
        const offset = isDouble ? 3 : -3;
        ctx.beginPath();
        ctx.moveTo(c.x - 6, c.y + offset);
        ctx.lineTo(c.x, c.y - offset);
        ctx.lineTo(c.x + 6, c.y + offset);
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isDouble ? 'BOOST 2X' : 'SLOW 0.5X', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Destructible Bricks Shield Module
 * Contains a 5x5 grid of solid dark grey cubes that fill the module area.
 * Individual cubes break and disappear when hit by a particle.
 */
class BricksModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, threshold = 0) {
        super(id, x, y, width, height, 'BRICKS');
        this.gridSize = 5; // 5x5 grid of cubes
        this.threshold = threshold; // Minimum momentum needed to break a cube
        
        // Initialize 5x5 grid of intact cube objects
        this.cubes = [];
        const cellW = this.width / this.gridSize;
        const cellH = this.height / this.gridSize;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                this.cubes.push({
                    row: r,
                    col: c,
                    x: this.x + c * cellW,
                    y: this.y + r * cellH,
                    w: cellW,
                    h: cellH,
                    intact: true
                });
            }
        }
    }

    // Keep individual cube positions updated if module is moved around during Edit Mode
    update(dt) {
        const cellW = this.width / this.gridSize;
        const cellH = this.height / this.gridSize;
        this.cubes.forEach(cube => {
            cube.w = cellW;
            cube.h = cellH;
            cube.x = this.x + cube.col * cellW;
            cube.y = this.y + cube.row * cellH;
        });
    }

    affectParticle(particle, dt, arena) {
        if (particle.dead) return;

        for (let cube of this.cubes) {
            if (!cube.intact) continue;

            // Check AABB collision between particle point and cube bounding box
            if (particle.x >= cube.x && particle.x <= cube.x + cube.w &&
                particle.y >= cube.y && particle.y <= cube.y + cube.h) {

                // Calculate momentum (assuming particle mass = 1)
                const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                const momentum = speed;

                if (momentum >= this.threshold) {
                    // Shatter cube
                    cube.intact = false;

                    // Spawn small debris shatter flash effect
                    if (arena && arena.effects) {
                        const centerX = cube.x + cube.w / 2;
                        const centerY = cube.y + cube.h / 2;
                        arena.effects.push(new ExplosionFlash(centerX, centerY, 15, '#555555'));
                    }
                }

                // Bounce particle back off the cube hit surface
                const distToLeft = Math.abs(particle.x - cube.x);
                const distToRight = Math.abs(particle.x - (cube.x + cube.w));
                const distToTop = Math.abs(particle.y - cube.y);
                const distToBottom = Math.abs(particle.y - (cube.y + cube.h));

                const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                if (minDist === distToLeft || minDist === distToRight) {
                    particle.vx *= -1;
                } else {
                    particle.vy *= -1;
                }

                break;
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();

        const cellW = this.width / this.gridSize;
        const cellH = this.height / this.gridSize;

        // Render intact dark grey cubes
        this.cubes.forEach(cube => {
            if (!cube.intact) return;

            // Recalculate coordinates on render to guarantee edit-mode alignment
            cube.w = cellW;
            cube.h = cellH;
            cube.x = this.x + cube.col * cellW;
            cube.y = this.y + cube.row * cellH;

            ctx.fillStyle = '#2a2d32';
            ctx.strokeStyle = '#141619';
            ctx.lineWidth = 1;

            ctx.fillRect(cube.x + 1, cube.y + 1, cube.w - 2, cube.h - 2);
            ctx.strokeRect(cube.x + 1, cube.y + 1, cube.w - 2, cube.h - 2);

            // Subtle bevel highlight on top edge
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(cube.x + 1, cube.y + 1, cube.w - 2, 2);
        });

        // Overlay Label
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.fillText('BRICKS', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Magnetizer Module
 * Imbues passing particles with magnetic stickiness.
 */
class MagnetizerModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80) {
        super(id, x, y, width, height, 'MAGNETIZER');
        this.radius = Math.min(width, height) / 2;
        this.activeParticles = new Set();
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            if (!this.activeParticles.has(particle)) {
                particle.isMagnetic = true;
                this.activeParticles.add(particle);
            }
        } else {
            this.activeParticles.delete(particle);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();
        ctx.strokeStyle = '#e040fb';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#e040fb';
        ctx.lineWidth = 1.5;

        // Horseshoe magnet ring symbol
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#e040fb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MAG', c.x, c.y);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#e040fb';
        ctx.textAlign = 'center';
        ctx.fillText('MAGNETIZER', c.x, this.y + 12);
        ctx.restore();
    }
}

/**
 * Rigid Compound Magnetic Cluster
 * Holds attached particle nodes with rigid local offsets.
 */
class MagneticCluster {
    constructor(p1, p2) {
        this.dead = false;
        this.x = (p1.x + p2.x) / 2;
        this.y = (p1.y + p2.y) / 2;
        this.vx = (p1.vx + p2.vx) / 2;
        this.vy = (p1.vy + p2.vy) / 2;

        this.nodes = [];
        this.addParticleNode(p1);
        this.addParticleNode(p2);
    }

    addParticleNode(particle) {
        particle.cluster = this;
        this.nodes.push({
            relX: particle.x - this.x,
            relY: particle.y - this.y,
            particle: particle
        });
    }

    mergeCluster(otherCluster) {
        otherCluster.nodes.forEach(node => {
            node.particle.cluster = this;
            node.relX = node.particle.x - this.x;
            node.relY = node.particle.y - this.y;
            this.nodes.push(node);
        });

        // Recalculate combined center of momentum
        const totalNodes = this.nodes.length;
        this.vx = (this.vx * (totalNodes - otherCluster.nodes.length) + otherCluster.vx * otherCluster.nodes.length) / totalNodes;
        this.vy = (this.vy * (totalNodes - otherCluster.nodes.length) + otherCluster.vy * otherCluster.nodes.length) / totalNodes;

        otherCluster.dead = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Sync individual particle positions to the cluster center offset
        this.nodes.forEach(node => {
            const p = node.particle;
            p.x = this.x + node.relX;
            p.y = this.y + node.relY;
            p.vx = this.vx;
            p.vy = this.vy;
        });
    }

    shatter(arena, impactVx = 0, impactVy = 0) {
        this.dead = true;

        this.nodes.forEach(node => {
            const p = node.particle;
            p.cluster = null;
            p.isMagnetic = false; // Magnetism dissipates on impact shatter

            const burstAngle = Math.atan2(node.relY, node.relX);
            const explodeSpeed = 80 + Math.random() * 40;

            p.vx = this.vx + impactVx * 0.2 + Math.cos(burstAngle) * explodeSpeed;
            p.vy = this.vy + impactVy * 0.2 + Math.sin(burstAngle) * explodeSpeed;
        });

        if (arena && arena.effects) {
            arena.effects.push(new ExplosionFlash(this.x, this.y, 30, '#e040fb'));
        }
    }
}

/**
 * Paddle Wheel Module (Mechanical Category)
 * Rotates 10 spokes to transfer rotational momentum onto colliding particles.
 */
class PaddleWheelModule extends ArenaModule {
    // 5 distinct rotational speed settings (rad/s)
    static SPEED_PRESETS = [0.5, 1.5, 3.0, 5.0, 8.0];

    constructor(id, x, y, width = 80, height = 80, speedIndex = 2, direction = 1) {
        super(id, x, y, width, height, 'PADDLE_WHEEL');
        this.numSpokes = 10;
        this.radius = Math.min(width, height) / 2 - 4;
        this.direction = Math.sign(direction) || 1; // 1: CW, -1: CCW
        
        // Speed configuration
        this.speedIndex = Math.max(0, Math.min(speedIndex, PaddleWheelModule.SPEED_PRESETS.length - 1));
        this.angularVelocity = PaddleWheelModule.SPEED_PRESETS[this.speedIndex] * this.direction;
        this.rotationAngle = 0;
    }

    update(dt) {
        this.rotationAngle += this.angularVelocity * dt;
        // Keep angle normalized within [0, 2PI]
        this.rotationAngle %= (Math.PI * 2);
    }

    affectParticle(particle, dt) {
        if (particle.dead) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        // Radial check against outer radius bounds
        if (distSq > this.radius * this.radius) return;

        const particleAngle = Math.atan2(dy, dx);
        const spokeStep = (Math.PI * 2) / this.numSpokes;
        const collisionThreshold = 0.08; // Angular collision distance threshold

        for (let i = 0; i < this.numSpokes; i++) {
            const currentSpokeAngle = (this.rotationAngle + i * spokeStep) % (Math.PI * 2);
            
            // Normalize angular delta to [-PI, PI]
            let angleDiff = particleAngle - currentSpokeAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (Math.abs(angleDiff) < collisionThreshold) {
                // Tangential linear velocity imparted by blade at radius r: v_tangent = omega * r
                const dist = Math.sqrt(distSq);
                const tangentialSpeed = this.angularVelocity * dist;

                // Perpendicular tangent unit vector (-sin(theta), cos(theta))
                const tx = -Math.sin(currentSpokeAngle);
                const ty = Math.cos(currentSpokeAngle);

                // Imbue rotational momentum onto particle
                particle.vx += tx * tangentialSpeed * 1.5;
                particle.vy += ty * tangentialSpeed * 1.5;

                // Slight outward push to prevent sticking to blade line
                particle.x += (dx / Math.max(1, dist)) * 2;
                particle.y += (dy / Math.max(1, dist)) * 2;
                break;
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        ctx.save();
        ctx.translate(c.x, c.y);

        // Center hub
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Outer circular boundary ring
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Render 10 Spokes / Blades
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffaa00';

        const spokeStep = (Math.PI * 2) / this.numSpokes;
        for (let i = 0; i < this.numSpokes; i++) {
            const angle = this.rotationAngle + i * spokeStep;
            const sx = Math.cos(angle) * this.radius;
            const sy = Math.sin(angle) * this.radius;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        }

        ctx.restore();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#ffaa00';
        ctx.textAlign = 'center';
        ctx.fillText('PADDLE WHEEL', c.x, this.y + 12);
    }
}

/**
 * Destructible/Solid Wedge Module
 * Quarter-sized mechanical barrier filling half of a square diagonally.
 * Orientations:
 *  - 'TL': Top-Left filled (hypotenuse from Top-Right to Bottom-Left)
 *  - 'TR': Top-Right filled (hypotenuse from Top-Left to Bottom-Right)
 *  - 'BR': Bottom-Right filled (hypotenuse from Top-Right to Bottom-Left)
 *  - 'BL': Bottom-Left filled (hypotenuse from Top-Left to Bottom-Right)
 */
class WedgeModule extends ArenaModule {
    constructor(id, x, y, width = 40, height = 40, orientation = 'BL') {
        super(id, x, y, width, height, 'WEDGE');
        this.orientation = orientation; // 'BL', 'TL', 'TR', 'BR'
    }

    affectParticle(particle, dt) {
        // 1. Quick AABB Box Check
        if (particle.x < this.x || particle.x > this.x + this.width ||
            particle.y < this.y || particle.y > this.y + this.height) {
            return;
        }

        // Relative coordinates inside the module box (0 to 1)
        const rx = (particle.x - this.x) / this.width;
        const ry = (particle.y - this.y) / this.height;

        let insideSolid = false;
        let nx = 0, ny = 0; // Normal vector pointing OUT of the ramp surface

        // 2. Determine Half-Space Solid Area & Diagonal Normal Vector
        const invSqrt2 = 0.7071; // Normalized diagonal normal component

        switch (this.orientation) {
            case 'BL': // Solid: Top-Left to Bottom-Right diagonal, filled towards Bottom-Left
                if (ry >= rx) {
                    insideSolid = true;
                    nx = invSqrt2;
                    ny = -invSqrt2;
                }
                break;
            case 'TL': // Solid: Bottom-Left to Top-Right diagonal, filled towards Top-Left
                if (ry <= (1 - rx)) {
                    insideSolid = true;
                    nx = invSqrt2;
                    ny = invSqrt2;
                }
                break;
            case 'TR': // Solid: Top-Left to Bottom-Right diagonal, filled towards Top-Right
                if (ry <= rx) {
                    insideSolid = true;
                    nx = -invSqrt2;
                    ny = invSqrt2;
                }
                break;
            case 'BR': // Solid: Bottom-Left to Top-Right diagonal, filled towards Bottom-Right
                if (ry >= (1 - rx)) {
                    insideSolid = true;
                    nx = -invSqrt2;
                    ny = -invSqrt2;
                }
                break;
        }

        // 3. Resolve Penetration & Reflect Velocity Vector
        if (insideSolid) {
            // Eject particle slightly past the hypotenuse boundary
            const nudge = 1.5;
            particle.x += nx * nudge;
            particle.y += ny * nudge;

            // Reflect velocity: V_new = V - 2*(V · N)*N
            const dot = particle.vx * nx + particle.vy * ny;
            if (dot < 0) { // Only reflect if moving towards the surface
                particle.vx -= 2 * dot * nx;
                particle.vy -= 2 * dot * ny;
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;

        const x0 = this.x, y0 = this.y;
        const x1 = this.x + this.width, y1 = this.y + this.height;

        ctx.beginPath();
        switch (this.orientation) {
            case 'BL':
                ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x0, y0);
                break;
            case 'TL':
                ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x0, y1);
                break;
            case 'TR':
                ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y0);
                break;
            case 'BR':
                ctx.moveTo(x1, y1); ctx.lineTo(x0, y1); ctx.lineTo(x1, y0);
                break;
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}