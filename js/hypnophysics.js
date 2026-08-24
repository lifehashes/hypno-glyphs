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
        this.color = color;
        this.life = 1.0;
        this.dead = false;
        this.isAnti = false; // QCD Inversion state flag
    }

    update(dt) {
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.ax = 0;
        this.ay = 0;
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
            ctx.stroke(); // Render hollow ring for anti-particle
        } else {
            ctx.fill();   // Render solid sphere for normal particle
        }

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
        this.boundaryMode = 'none'; // 'none' | 'toroidal' | 'box'
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

        // 2. Physics pass on Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            this.modules.forEach(mod => {
                if (mod.affectParticle) {
                    mod.affectParticle(p, dt);
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

        // 3. Resolve Particle-to-Particle Collisions
        this.handleParticleCollisions();

        // 4. Render Boundary Visuals & Module Footprints
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

                // RULE 1: Anti-particles do NOT interact with opposite source types (A doesn't see B)
                if ((p1.isAnti || p2.isAnti) && p1.sourceId !== p2.sourceId) {
                    continue; 
                }

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistSq && distSq > 0) {
                    // RULE 2: Matter / Anti-Matter Annihilation within same source family
                    if (p1.sourceId === p2.sourceId && p1.isAnti !== p2.isAnti) {
                        p1.dead = true;
                        p2.dead = true;

                        // Shockwave parameters
                        const killRadius = 25;       // Inner radius: direct disintegration
                        const blastRadius = 90;      // Outer radius: physics force blowback
                        const killRadiusSq = killRadius * killRadius;
                        const blastRadiusSq = blastRadius * blastRadius;
                        const blastImpulse = 450;    // Magnitude of velocity imparted

                        const epicX = (p1.x + p2.x) / 2;
                        const epicY = (p1.y + p2.y) / 2;

                        for (let k = 0; k < len; k++) {
                            const pTarget = this.particles[k];
                            if (pTarget.dead) continue;

                            const bdx = pTarget.x - epicX;
                            const bdy = pTarget.y - epicY;
                            const bDistSq = bdx * bdx + bdy * bdy;

                            if (bDistSq <= killRadiusSq) {
                                // Vaporize particles in the core
                                pTarget.dead = true;
                            } else if (bDistSq <= blastRadiusSq && bDistSq > 0) {
                                // Impart radial blast force to surviving surrounding particles
                                const bDist = Math.sqrt(bDistSq);
                                const normX = bdx / bDist;
                                const normY = bdy / bDist;

                                // Falloff factor: particles closer to origin get launched faster
                                const falloff = 1 - (bDist / blastRadius);
                                const force = blastImpulse * falloff;

                                pTarget.vx += normX * force;
                                pTarget.vy += normY * force;
                            }
                        }
                        break; // Stop checking p1 as it has been annihilated
                    }

                    // Standard elastic physical bounce for normal interactions
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
}

/**
 * Sink / Drain Module (Destroys particles & increments score for emitter)
 */
class SinkModule extends ArenaModule {
    constructor(id, x, y, width = 70, height = 70, scoreTracker) {
        super(id, x, y, width, height, 'SINK');
        this.scoreTracker = scoreTracker; // Reference to track score state
        this.radius = Math.min(width, height) / 2;
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        // Drain particle if inside sink boundary
        if (distSq <= (this.radius * 0.8) ** 2) {
            particle.dead = true;

            // Increment score for emitting source
            if (particle.sourceId === 'alpha_src') {
                this.scoreTracker.alphaScore++;
            } else if (particle.sourceId === 'beta_src') {
                this.scoreTracker.betaScore++;
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
        ctx.fillText('DRAIN SINK', this.x + 8, this.y + 12);
        ctx.restore();
    }
}

/**
 * QCD Inverter Module
 * Converts passing particles into anti-particles of their own type/source.
 */
class QCDInverterModule extends ArenaModule {
    constructor(id, x, y, width = 70, height = 70) {
        super(id, x, y, width, height, 'QCD_INVERTER');
        this.radius = Math.min(width, height) / 2;
        this.pulseAngle = 0;
    }

    update(dt) {
        this.pulseAngle += dt * 3;
    }

    affectParticle(particle, dt) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        // Invert quantum charge state when passing through inversion field
        if (distSq <= (this.radius * 0.7) ** 2) {
            particle.isAnti = true;
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
        ctx.fillText('QCD INVERTER', this.x + 2, this.y + 12);
        ctx.restore();
    }
}