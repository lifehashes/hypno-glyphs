/**
 * 1. Particle Definition
 * Simple physical entities that move through the arena.
 */
class Particle {
    constructor(x, y, vx, vy, charge = 1, color = '#ffffff', radius = 2.5, mass = 1.0, isPredator = false) {
        // Core spatial & physical properties
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.ax = 0;
        this.ay = 0;
        
        this.chargeVal = charge;
        this.color = color;
        this.radius = radius;
        this.mass = mass;
        
        // Render & State flags
        this.life = 1.0;          // Fixed: Added opacity life value
        this.dead = false;        // Fixed: Added lifecycle status flag
        this.isAnti = false;
        this.isMagnetic = false;
        this.ringRotation = 0;
        
        // Age tracking
        this.ageSeconds = 0;
        this.ageShakes = 0;

        // Tracked state & radar pulse properties
        this.isTracked = false;
        this.pulseTimer = 0;

        // Track Predator status
        this.isPredator = isPredator;
        this.life = 1.0;
        this.dead = false;        

    }

    update(dt) {
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.ageSeconds += dt;
        this.ageShakes = Math.floor(this.ageSeconds / 10);

        // Lifespan & Expiration Logic (Only applies to Predators)
        if (this.isPredator) {
            const lifeDecayRate = 0.05; // 0.15/sec = ~6.6 seconds default lifespan
            this.chargeVal = 0;
            this.life = Math.max(0, this.life - lifeDecayRate * dt);

            if (this.life <= 0) {
                this.dead = true;
            }
        }

        // Update pulse timer (cycles every 1.2 seconds)
        if (this.isTracked) {
            this.pulseTimer = (this.pulseTimer + dt) % 1.2;
        }

        this.ax = 0;
        this.ay = 0;

        if (this.chargeVal !== 0) {
            const dir = Math.sign(this.chargeVal);
            this.ringRotation += dir * dt * 4;
        }
    }

    draw(ctx) {
        // RADAR PULSE (Drawn under particle body)
        if (this.isTracked) {
            ctx.save();
            const maxPulseRadius = this.radius + 35;
            const progress = this.pulseTimer / 1.2;
            const currentPulseRadius = this.radius + (maxPulseRadius - this.radius) * progress;
            const alpha = 1.0 - progress;

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffcc';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.x, this.y, currentPulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#00ffcc';
            ctx.stroke();

            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.life)); // Opacity bound to life

        // ==========================================
        // PREDATOR SPECIFIC RENDERING ROUTINE
        // ==========================================
        if (this.isPredator) {
            const headingAngle = Math.atan2(this.vy, this.vx);
            const predatorColor = this.color || '#ff0055';

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(headingAngle);

            // Glowing Outer Danger Aura
            ctx.shadowBlur = 12;
            ctx.shadowColor = predatorColor;
            ctx.fillStyle = predatorColor;
            ctx.strokeStyle = '#ffffff';

            // Jagged Spike/Teeth Body Contour
            ctx.beginPath();
            const teethCount = 6;
            for (let i = 0; i < teethCount; i++) {
                const a1 = (i / teethCount) * Math.PI * 2;
                const a2 = ((i + 0.5) / teethCount) * Math.PI * 2;
                const rOuter = this.radius * 2.5;
                const rInner = this.radius * 1.5;

                ctx.lineTo(Math.cos(a1) * rOuter, Math.sin(a1) * rOuter);
                ctx.lineTo(Math.cos(a2) * rInner, Math.sin(a2) * rInner);
            }
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.stroke();

            // Directional Glowing Eye Spots
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.radius * 0.4, -this.radius * 0.4, 1.5, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.4, this.radius * 0.4, 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } 
        // ==========================================
        // STANDARD PARTICLE DRAWING ROUTINE
        // ==========================================
        else {
            ctx.strokeStyle = this.color;
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = this.color;

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

            if (this.isAnti) {
                ctx.lineWidth = 1.2;
                ctx.stroke();
            } else {
                ctx.fill();
            }

            // Concentric charge rings
            const numRings = Math.abs(this.chargeVal);
            if (numRings > 0) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.ringRotation);
                ctx.shadowBlur = 0;
                ctx.lineWidth = 0.8;
                ctx.strokeStyle = this.chargeVal > 0 ? '#00e1ff' : '#ff3366';

                for (let r = 1; r <= numRings; r++) {
                    const ringRadius = this.radius + 1.0 + r * 2.2;
                    ctx.beginPath();
                    ctx.arc(0, 0, ringRadius, 0, Math.PI * 1.5);
                    ctx.stroke();
                }
                ctx.restore();
            }
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
    }

    affectParticle(particle, dt) {
        // Skip particles that already belong to this module
        if (particle.sourceId === this.id) return;

        // Check AABB containment inside this spawner's boundaries
        const insideX = particle.x >= this.x && particle.x <= this.x + this.width;
        const insideY = particle.y >= this.y && particle.y <= this.y + this.height;

        if (insideX && insideY) {
            // Re-assign ownership properties
            particle.sourceId = this.id;
            
            if (this.engine) {
                particle.color = this.engine.intrinsicColor;
                particle.originHash = this.engine.originHash;
                particle.currentHash = this.engine.currentHash;
            }
        }
    }

    update(dt, arena) {
        // Stop updating if inactive OR halted
        if (!this.engine || !this.engine.isActive || this.engine.halted) return;

        // Dynamic GOL Tick Interval
        const currentInterval = (typeof window !== 'undefined' && window.golTickInterval !== undefined) 
            ? window.golTickInterval 
            : 0.2;

        this.stepTimer += dt;
        if (this.stepTimer >= currentInterval) {
            this.stepTimer = 0;

            const n = this.engine.n;
            const c = this.center;
            const color = this.engine.intrinsicColor;

            const baseSpeed = (typeof window !== 'undefined' && window.initialSpawnVelocity !== undefined) 
                ? window.initialSpawnVelocity 
                : 80;

            const originHash = this.engine.originHash || '';
            const lastChar = originHash.length > 0 ? originHash.charAt(originHash.length - 1) : '0';
            const secondLastChar = originHash.length > 1 ? originHash.charAt(originHash.length - 2) : '0';

            const sizeValue = parseInt(lastChar, 16) % 16 + 1;
            const massValue = parseInt(secondLastChar, 16) % 16 + 1;

            const particleRadius = (typeof window !== 'undefined' && window.variableSizeEnabled) ? sizeValue : 2.5;
            const particleMass = (typeof window !== 'undefined' && window.variableMassEnabled) ? massValue : 1.0;

            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const isEdge = (x === 0 || x === n - 1 || y === 0 || y === n - 1);
                    
                    if (isEdge && this.engine.grid[y][x] === 1) {
                        // Match draw padding (inset by 8px so spawn matches preview positions)
                        const offsetX = (x / (n - 1) - 0.5) * (this.width - 8);
                        const offsetY = (y / (n - 1) - 0.5) * (this.height - 8);

                        const spawnX = c.x + offsetX;
                        const spawnY = c.y + offsetY;

                        let dx = spawnX - c.x;
                        let dy = spawnY - c.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist === 0) {
                            dx = 1;
                            dy = 0;
                            dist = 1;
                        }

                        const vx = (dx / dist) * baseSpeed;
                        const vy = (dy / dist) * baseSpeed;

                        const p = new Particle(spawnX, spawnY, vx, vy, 0, color, particleRadius, particleMass);
                        p.sourceId = this.id;
                        p.originHash = this.engine.originHash;
                        p.currentHash = this.engine.currentHash;

                        arena.addParticle(p);
                    }
                }
            }

            this.engine.computeNextGeneration();
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        const color = this.engine ? this.engine.intrinsicColor : '#42f485';

        ctx.save();

        const isHalted = this.engine && this.engine.halted;

        // Central Core Rendering
        if (!isHalted) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(100, 100, 100, 0.3)"; 
            ctx.beginPath();
            ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // GOL Cell Previews
        if (this.engine && this.engine.grid) {
            const n = this.engine.n;
            ctx.shadowBlur = isHalted ? 0 : 4; // Kill preview glow when halted
            ctx.fillStyle = isHalted ? "rgba(100, 100, 100, 0.2)" : color;
            ctx.strokeStyle = isHalted ? "rgba(100, 100, 100, 0.2)" : color;
            ctx.lineWidth = 1;

            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    if (this.engine.grid[y][x] === 1) {
                        const offsetX = (x / (n - 1) - 0.5) * (this.width - 8);
                        const offsetY = (y / (n - 1) - 0.5) * (this.height - 8);

                        const cellX = c.x + offsetX;
                        const cellY = c.y + offsetY;
                        const isEdge = (x === 0 || x === n - 1 || y === 0 || y === n - 1);

                        if (isEdge) {
                            ctx.fillRect(cellX - 1.5, cellY - 1.5, 3, 3);
                        } else {
                            ctx.strokeRect(cellX - 1.5, cellY - 1.5, 3, 3);
                        }
                    }
                }
            }
        }

        // Module Label
        ctx.font = '9px monospace';
        ctx.fillStyle = isHalted ? "rgba(100, 100, 100, 0.5)" : color;
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

        this.setupParticleTrackingInteraction();

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

    setupParticleTrackingInteraction() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const maxSelectDistance = 15; // Click tolerance in pixels
            let closestParticle = null;
            let minDistanceSq = maxSelectDistance * maxSelectDistance;

            for (const p of this.particles) {
                if (p.dead) continue;
                const dx = p.x - clickX;
                const dy = p.y - clickY;
                const distSq = dx * dx + dy * dy;

                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    closestParticle = p;
                }
            }

            if (closestParticle) {
                // Toggle tracking state on click
                closestParticle.isTracked = !closestParticle.isTracked;
            }
        });
    }

    handleParticleBoundaries(p) {
        const r = p.radius || 2.5;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.boundaryMode === 'none') {
            if (p.x < -r || p.x > w + r || p.y < -r || p.y > h + r) {
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

            // used to calculate drag (if enabled) as created by an infinitely fine medium
            applyGlobalForces(p, dt);

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
                const minDist = p1.radius + p2.radius;
                const minDistSq = minDist * minDist;

                if (distSq < minDistSq && distSq > 0) {
                    
                    // ==========================================
                    // PREDATOR INTERACTION & FEEDING LOGIC
                    // ==========================================
                    if (p1.isPredator || p2.isPredator) {
                        // Skip collision response if both are predators of the same species
                        if (p1.isPredator && p2.isPredator && p1.sourceId === p2.sourceId) {
                            continue;
                        }

                        // Determine predator and prey roles for cross-species interactions
                        let predator = null;
                        let prey = null;

                        if (p1.isPredator && p2.sourceId !== p1.sourceId) {
                            predator = p1;
                            prey = p2;
                        } else if (p2.isPredator && p1.sourceId !== p2.sourceId) {
                            predator = p2;
                            prey = p1;
                        }

                        // Execute feeding logic: consume prey and restore life
                        if (predator && prey) {
                            prey.dead = true;
                            predator.life = Math.min(1.0, predator.life + 0.35); // Replenish life up to 100%

                            if (prey.cluster) prey.cluster.shatter(this);

                            const feedX = (p1.x + p2.x) / 2;
                            const feedY = (p1.y + p2.y) / 2;
                            this.effects.push(new ExplosionFlash(feedX, feedY, 15, predator.color));
                            continue;
                        }
                    }

                    // MAGNETIC CLUSTER STICKING / SHATTERING
                    if (p1.isMagnetic && p2.isMagnetic) {
                        if (!p1.cluster && !p2.cluster) {
                            const cluster = new MagneticCluster(p1, p2);
                            this.clusters.push(cluster);
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

                    // Elastic rebound factoring in varying mass (m1, m2)
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const overlap = 0.5 * (minDist - dist);
                    p1.x -= nx * overlap;
                    p1.y -= ny * overlap;
                    p2.x += nx * overlap;
                    p2.y += ny * overlap;

                    const m1 = p1.mass || 1.0;
                    const m2 = p2.mass || 1.0;

                    const kx = p1.vx - p2.vx;
                    const ky = p1.vy - p2.vy;
                    const p = 2 * (nx * kx + ny * ky) / (m1 + m2);

                    p1.vx -= p * m2 * nx;
                    p1.vy -= p * m2 * ny;
                    p2.vx += p * m1 * nx;
                    p2.vy += p * m1 * ny;
                }
            }
        }
    }

    handleElectrostaticInteractions() {
        const interactionRadius = 45;
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
                    
                    const forceMagnitude = (coulombConstant * p1.chargeVal * p2.chargeVal) / distSq;

                    const fx = (dx / dist) * forceMagnitude;
                    const fy = (dy / dist) * forceMagnitude;

                    // Apply acceleration inversely proportional to particle mass (a = F / m)
                    const m1 = p1.mass || 1.0;
                    const m2 = p2.mass || 1.0;

                    p1.ax -= fx / m1;
                    p1.ay -= fy / m1;
                    p2.ax += fx / m2;
                    p2.ay += fy / m2;
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
        if (this.processedParticles.has(particle)) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= (this.radius * 0.7) ** 2) {
            this.processedParticles.add(particle);

            const angle = (Math.random() - 0.5) * (Math.PI / 6);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const cloneVx = particle.vx * cos - particle.vy * sin;
            const cloneVy = particle.vx * sin + particle.vy * cos;

            const clone = new Particle(
                particle.x,
                particle.y,
                cloneVx,
                cloneVy,
                particle.chargeVal, // Fixed: use particle.chargeVal instead of particle.charge
                particle.color,
                particle.radius,
                particle.mass
            );

            clone.sourceId = particle.sourceId;
            clone.originHash = particle.originHash;
            clone.currentHash = particle.currentHash;
            clone.isAnti = particle.isAnti;

            this.processedParticles.add(clone);
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
 * Enforces an arena-dependent speed limit when boosting to prevent frame-skipping/tunneling.
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

    affectParticle(particle, dt, arena) {
        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            // Scale velocity once when entering the zone boundary
            if (!this.activeParticles.has(particle)) {
                
                // If boosting (multiplier > 1), verify speed limit before applying
                if (this.multiplier > 1.0) {
                    const currentSpeed = Math.hypot(particle.vx, particle.vy);
                    const targetSpeed = currentSpeed * this.multiplier;

                    // Calculate maximum speed so dist per tick (v * dt) < min arena length
                    const canvas = arena ? arena.canvas : null;
                    const minArenaDimension = canvas ? Math.min(canvas.width, canvas.height) : 800;
                    const effectiveDt = dt > 0 ? dt : 0.016; // Fallback to ~60fps step
                    const maxSpeedLimit = minArenaDimension / effectiveDt;

                    // Abort boost if target speed exceeds maximum tick threshold
                    if (targetSpeed > maxSpeedLimit) {
                        this.activeParticles.add(particle);
                        return;
                    }
                }

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
 * Fully solid triangular barrier.
 * Particles bounce cleanly off all 3 faces (hypotenuse & both straight sides).
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
        let distHypotenuse = 0;
        let hypNx = 0, hypNy = 0;

        const invSqrt2 = 0.7071;

        // 2. Check interior solid status & calculate distance to hypotenuse
        switch (this.orientation) {
            case 'BL': // Solid when ry >= rx
                if (ry >= rx) {
                    insideSolid = true;
                    distHypotenuse = (ry - rx) * invSqrt2;
                    hypNx = invSqrt2;
                    hypNy = -invSqrt2;
                }
                break;
            case 'TL': // Solid when ry <= (1 - rx)
                if (ry <= (1 - rx)) {
                    insideSolid = true;
                    distHypotenuse = ((1 - rx) - ry) * invSqrt2;
                    hypNx = invSqrt2;
                    hypNy = invSqrt2;
                }
                break;
            case 'TR': // Solid when ry <= rx
                if (ry <= rx) {
                    insideSolid = true;
                    distHypotenuse = (rx - ry) * invSqrt2;
                    hypNx = -invSqrt2;
                    hypNy = invSqrt2;
                }
                break;
            case 'BR': // Solid when ry >= (1 - rx)
                if (ry >= (1 - rx)) {
                    insideSolid = true;
                    distHypotenuse = (ry - (1 - rx)) * invSqrt2;
                    hypNx = -invSqrt2;
                    hypNy = -invSqrt2;
                }
                break;
        }

        if (!insideSolid) return;

        // 3. Determine distance to the two flat outer bounds (in normalized 0..1 units)
        let distSideA = 0, nxSideA = 0, nySideA = 0;
        let distSideB = 0, nxSideB = 0, nySideB = 0;

        switch (this.orientation) {
            case 'BL': // Flat sides: Left (x=0) and Bottom (y=1)
                distSideA = rx;        nxSideA = -1; nySideA = 0;  // Left face
                distSideB = 1 - ry;    nxSideB = 0;  nySideB = 1;  // Bottom face
                break;
            case 'TL': // Flat sides: Left (x=0) and Top (y=0)
                distSideA = rx;        nxSideA = -1; nySideA = 0;  // Left face
                distSideB = ry;        nxSideB = 0;  nySideB = -1; // Top face
                break;
            case 'TR': // Flat sides: Right (x=1) and Top (y=0)
                distSideA = 1 - rx;    nxSideA = 1;  nySideA = 0;  // Right face
                distSideB = ry;        nxSideB = 0;  nySideB = -1; // Top face
                break;
            case 'BR': // Flat sides: Right (x=1) and Bottom (y=1)
                distSideA = 1 - rx;    nxSideA = 1;  nySideA = 0;  // Right face
                distSideB = 1 - ry;    nxSideB = 0;  nySideB = 1;  // Bottom face
                break;
        }

        // 4. Find closest edge (smallest distance) and assign its normal
        let minDist = distHypotenuse;
        let nx = hypNx;
        let ny = hypNy;

        if (distSideA < minDist) {
            minDist = distSideA;
            nx = nxSideA;
            ny = nySideA;
        }
        if (distSideB < minDist) {
            minDist = distSideB;
            nx = nxSideB;
            ny = nySideB;
        }

        // 5. Eject particle & reflect velocity
        const nudge = 1.5;
        particle.x += nx * nudge;
        particle.y += ny * nudge;

        const dot = particle.vx * nx + particle.vy * ny;
        if (dot < 0) {
            particle.vx -= 2 * dot * nx;
            particle.vy -= 2 * dot * ny;
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

/**
 * Block (Half / Wedge Size: 40x40)
 */
class BlockSmallModule extends ArenaModule {
    constructor(id, x, y, width = 40, height = 40) {
        super(id, x, y, width, height, 'BLOCK_SMALL');
    }

    affectParticle(particle, dt) {
        if (particle.x < this.x || particle.x > this.x + this.width ||
            particle.y < this.y || particle.y > this.y + this.height) {
            return;
        }

        const distLeft = Math.abs(particle.x - this.x);
        const distRight = Math.abs(particle.x - (this.x + this.width));
        const distTop = Math.abs(particle.y - this.y);
        const distBottom = Math.abs(particle.y - (this.y + this.height));

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const nudge = 1.5;

        if (minDist === distLeft) {
            particle.x = this.x - nudge;
            particle.vx *= -1;
        } else if (minDist === distRight) {
            particle.x = this.x + this.width + nudge;
            particle.vx *= -1;
        } else if (minDist === distTop) {
            particle.y = this.y - nudge;
            particle.vy *= -1;
        } else {
            particle.y = this.y + this.height + nudge;
            particle.vy *= -1;
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * Block (Standard Size: 80x80)
 */
class BlockModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80) {
        super(id, x, y, width, height, 'BLOCK');
    }

    affectParticle(particle, dt) {
        if (particle.x < this.x || particle.x > this.x + this.width ||
            particle.y < this.y || particle.y > this.y + this.height) {
            return;
        }

        const distLeft = Math.abs(particle.x - this.x);
        const distRight = Math.abs(particle.x - (this.x + this.width));
        const distTop = Math.abs(particle.y - this.y);
        const distBottom = Math.abs(particle.y - (this.y + this.height));

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const nudge = 1.5;

        if (minDist === distLeft) {
            particle.x = this.x - nudge;
            particle.vx *= -1;
        } else if (minDist === distRight) {
            particle.x = this.x + this.width + nudge;
            particle.vx *= -1;
        } else if (minDist === distTop) {
            particle.y = this.y - nudge;
            particle.vy *= -1;
        } else {
            particle.y = this.y + this.height + nudge;
            particle.vy *= -1;
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * Bar Horizontal (40x80)
 */
class BarHModule extends ArenaModule {
    constructor(id, x, y, width = 40, height = 20) {
        super(id, x, y, width, height, 'BAR_H');
    }

    affectParticle(particle, dt) {
        if (particle.x < this.x || particle.x > this.x + this.width ||
            particle.y < this.y || particle.y > this.y + this.height) {
            return;
        }

        const distLeft = Math.abs(particle.x - this.x);
        const distRight = Math.abs(particle.x - (this.x + this.width));
        const distTop = Math.abs(particle.y - this.y);
        const distBottom = Math.abs(particle.y - (this.y + this.height));

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const nudge = 1.5;

        if (minDist === distLeft) {
            particle.x = this.x - nudge;
            particle.vx *= -1;
        } else if (minDist === distRight) {
            particle.x = this.x + this.width + nudge;
            particle.vx *= -1;
        } else if (minDist === distTop) {
            particle.y = this.y - nudge;
            particle.vy *= -1;
        } else {
            particle.y = this.y + this.height + nudge;
            particle.vy *= -1;
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * Bar Vertical (80x40)
 */
class BarVModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 20) {
        super(id, x, y, width, height, 'BAR_V');
    }

    affectParticle(particle, dt) {
        if (particle.x < this.x || particle.x > this.x + this.width ||
            particle.y < this.y || particle.y > this.y + this.height) {
            return;
        }

        const distLeft = Math.abs(particle.x - this.x);
        const distRight = Math.abs(particle.x - (this.x + this.width));
        const distTop = Math.abs(particle.y - this.y);
        const distBottom = Math.abs(particle.y - (this.y + this.height));

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        const nudge = 1.5;

        if (minDist === distLeft) {
            particle.x = this.x - nudge;
            particle.vx *= -1;
        } else if (minDist === distRight) {
            particle.x = this.x + this.width + nudge;
            particle.vx *= -1;
        } else if (minDist === distTop) {
            particle.y = this.y - nudge;
            particle.vy *= -1;
        } else {
            particle.y = this.y + this.height + nudge;
            particle.vy *= -1;
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

/**
 * Osmosis Module
 * Semi-transparent permeable barrier. Solid wall for opposing particles; 
 * permeable pass-through for aligned particles of the matching side.
 * Dynamically renders using the target lifeEngine's intrinsic color.
 */
class OsmosisModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80, lifeEngine = null, side = 'ALPHA') {
        super(id, x, y, width, height, 'OSMOSIS');
        this.engine = lifeEngine; // Reference to GOL pattern engine
        this.side = side.toLowerCase();
        
        // Fallback color if lifeEngine isn't assigned or available
        this.fallbackColor = side.toLowerCase().includes('alpha') ? '#42f485' : '#ff3366';
    }

    // Dynamic color getter matching SourceSpawnModule behavior
    get color() {
        return (this.engine && this.engine.intrinsicColor) 
            ? this.engine.intrinsicColor 
            : this.fallbackColor;
    }

    affectParticle(particle, dt) {
        // Allow pass-through if the particle matches this module's origin side
        if (particle.sourceId && particle.sourceId.toLowerCase().includes(this.side)) {
            return;
        }

        const radius = 2.5; // Particle radius

        // Resolve rectangular solid box collisions for opposing particles
        if (particle.x + radius > this.x && particle.x - radius < this.x + this.width &&
            particle.y + radius > this.y && particle.y - radius < this.y + this.height) {

            // Calculate overlap distances from each border edge
            const overlapLeft   = (particle.x + radius) - this.x;
            const overlapRight  = (this.x + this.width) - (particle.x - radius);
            const overlapTop    = (particle.y + radius) - this.y;
            const overlapBottom = (this.y + this.height) - (particle.y - radius);

            // Find the minimum overlap depth to determine collision axis
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            if (minOverlap === overlapLeft) {
                particle.x = this.x - radius;
                particle.vx *= -1;
            } else if (minOverlap === overlapRight) {
                particle.x = this.x + this.width + radius;
                particle.vx *= -1;
            } else if (minOverlap === overlapTop) {
                particle.y = this.y - radius;
                particle.vy *= -1;
            } else if (minOverlap === overlapBottom) {
                particle.y = this.y + this.height + radius;
                particle.vy *= -1;
            }
        }
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.save();

        const activeColor = this.color;

        // 1. Fill semi-transparent interior with dynamic intrinsic hue
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 2. Render dashed/solid border in dynamic intrinsic color
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = activeColor;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // 3. Label text
        ctx.setLineDash([]);
        ctx.font = '9px monospace';
        ctx.fillStyle = activeColor;
        ctx.textAlign = 'center';
        ctx.fillText(`OSMOSIS [${this.side.toUpperCase()}]`, this.center.x, this.y + 12);

        ctx.restore();
    }
}

// Global or module-level state configuration
let globalDragActive = false;
let dragCoefficient = 0.5; // Adjustable range: 0.0 (none) to 2.0+ (heavy medium)

function applyGlobalForces(particle, deltaTime) {

    // Uniform Medium Drag Force: F = -b * v
    if (globalDragActive) {
        // Damping factor accounts for frame timing and particle mass
        const dampingFactor = Math.exp(-(dragCoefficient / particle.mass) * deltaTime);
        
        particle.vx *= dampingFactor;
        particle.vy *= dampingFactor;
    }
}

// Global setters called by UI controls
function toggleGlobalDrag() {
    globalDragActive = !globalDragActive;
    return globalDragActive;
}

function setDragCoefficient(val) {
    dragCoefficient = parseFloat(val);
}

/**
 * Predator Module
 * Transforms standard particles entering its boundary into predators.
 */
class PredatorModule extends ArenaModule {
    constructor(id, x, y, width = 80, height = 80) {
        super(id, x, y, width, height, 'PREDATOR');
        this.radius = Math.min(width, height) / 2;
        this.activeParticles = new Set();
    }

    affectParticle(particle, dt) {
        // Skip particles that are already predators
        if (particle.isPredator) return;

        const c = this.center;
        const dx = particle.x - c.x;
        const dy = particle.y - c.y;
        const distSq = dx * dx + dy * dy;
        const inZone = distSq <= (this.radius * 0.7) ** 2;

        if (inZone) {
            // Convert to predator on entry into the module zone
            if (!this.activeParticles.has(particle)) {
                particle.isPredator = true;
                particle.life = 1.0; // Initialize with full lifespan/health
                this.activeParticles.add(particle);
            }
        } else {
            // Clean up tracking when the particle leaves the module area
            this.activeParticles.delete(particle);
        }
    }

    draw(ctx) {
        super.draw(ctx);
        const c = this.center;
        const predatorColor = '#ff0055';

        ctx.save();
        ctx.strokeStyle = predatorColor;
        ctx.fillStyle = predatorColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = predatorColor;
        ctx.lineWidth = 1.5;

        // Circular active zone indicator
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        // Jagged teeth icon in center
        ctx.beginPath();
        const teethCount = 5;
        const outerR = 10;
        const innerR = 5;
        for (let i = 0; i < teethCount; i++) {
            const a1 = (i / teethCount) * Math.PI * 2;
            const a2 = ((i + 0.5) / teethCount) * Math.PI * 2;
            ctx.lineTo(c.x + Math.cos(a1) * outerR, c.y + Math.sin(a1) * outerR);
            ctx.lineTo(c.x + Math.cos(a2) * innerR, c.y + Math.sin(a2) * innerR);
        }
        ctx.closePath();
        ctx.fill();

        // Module Label
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PREDATOR', c.x, this.y + 12);

        ctx.restore();
    }
}