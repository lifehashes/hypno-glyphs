<?php

    session_start();
    include_once __DIR__ . '/../../priv/db_conf_laniakea.php';    

    // USER INFORMATION (IF LOGGED IN)
    $current_operator = htmlspecialchars($_SESSION['username']);
    $operator_id      = htmlspecialchars($_SESSION['user_id']);

    // TRACK SITE VISITS
    $site_token = 'HYPNO-GLYPHS';    
    $session_key = 'has_logged_' . $site_token; // Tracking key per site so visiting Sub-site A doesn't block logging Sub-site B

    if (!isset($_SESSION[$session_key])) {
        try {
            $stmt = $pdo->prepare("INSERT INTO page_visits (site_token, operator_id, username) VALUES (?, ?, ?)");
            $stmt->execute([$site_token, $operator_id, $current_operator]);
            
            $_SESSION[$session_key] = true;
        } catch (Exception $e) {
            // Fail silently
        }
    }

    // FETCH USER GLYPHS
    $stmt = $pdo->prepare("
        SELECT 
            g.BATTLE_NAME, 
            g.ITERATIONS AS GENERATIONS, 
            g.PEAK, 
            g.MAX, 
            g.OWNER, 
            g.BIN, 
            g.HASH,
            g.GRID_SIZE
        FROM GLYPHREG g
        WHERE g.OWNER = :owner_id AND g.GRID_SIZE='16'
        GROUP BY g.BATTLE_NAME, g.ITERATIONS, g.PEAK, g.MAX, g.OWNER, g.BIN, g.HASH, g.GRID_SIZE
        ORDER BY g.BATTLE_NAME ASC
    ");
            
    $stmt->execute(['owner_id' => $current_operator]);
    $myGlyphs = $stmt->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HYPNOGLYPHS // GENERATIVE PHYSICS ENGINE</title>
    <SCRIPT SRC="js/gol.js"></SCRIPT>
    <SCRIPT SRC="js/hypnophysics.js"></SCRIPT>
    <SCRIPT SRC="js/sha256.js"></SCRIPT>	
    <link rel="stylesheet" href="styles.css">
    <style></style>
</head>
<body>

<div class="outer-frame">
    <div class="terminal-header">
        <div class="terminal-title">HYPNOGLYPHS // B3/S23-PHYSICS ENGINE v0.1</div>
        <div class="stat-line" style="border:none; gap:15px;">
            <span>STATUS: <span style="color:var(--accent-green)">ONLINE</span></span>
            <span>FPS: <span id="fps-counter" class="stat-value">60</span></span>
        </div>
    </div>

    <div class="duel-stage">
        <!-- SOURCE MODULE ALPHA -->
        <div class="player-box">
            <div class="pane-title">SOURCE :: ALPHA</div>
            <div class="glyph-preview">
                <canvas id="glyph-alpha-canvas" width="128" height="128"></canvas>
            </div>
            <div class="stat-line">
                <span>DESIGNATION:</span>
                <span class="stat-value" id="alpha-name">P_56_10</span>
            </div>
            <div class="stat-line">
                <span>INTRINSIC HUE:</span>
                <span class="stat-value" id="alpha-color" style="color: #42f485">#42F485</span>
            </div>
            <div class="stat-line">
                <span>GENERATION:</span>
                <span class="stat-value" id="alpha-gen">0 / 500</span>
            </div>
            <div class="stat-line">
                <span>PARTICLES ACTIVE:</span>
                <span class="stat-value" id="alpha-particles">0</span>
            </div>
            <div class="stat-line">
                <span>SCORE:</span>
                <span class="stat-value" id="alpha-score" style="color:#00ffff; font-weight:bold;">0</span>
            </div>
            <!-- NEW HASH READOUTS -->
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">ORIGIN HASH:</span>
                <span class="stat-value" id="alpha-origin-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">CURRENT HASH:</span>
                <span class="stat-value" id="alpha-current-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="load-btn" style="flex:1;" onclick="loadRandomSeed('alpha')">RANDOM SEED</button>
                <button class="load-btn" style="flex:1; background:rgba(0, 255, 255, 0.15); border-color:#00ffff;" onclick="loadDatabaseGlyph('alpha')">DB DRAW</button>
            </div>
        </div>

        <!-- MAIN ARENA CANVAS -->
        <div class="arena-container">
            <canvas id="physics-canvas"></canvas>
        </div>

        <!-- SOURCE MODULE BETA -->
        <div class="player-box">
            <div class="pane-title">SOURCE :: BETA</div>
            <div class="glyph-preview">
                <canvas id="glyph-beta-canvas" width="128" height="128"></canvas>
            </div>
            <div class="stat-line">
                <span>DESIGNATION:</span>
                <span class="stat-value" id="beta-name">P_56_10</span>
            </div>
            <div class="stat-line">
                <span>INTRINSIC HUE:</span>
                <span class="stat-value" id="beta-color" style="color: #42f485">#42F485</span>
            </div>
            <div class="stat-line">
                <span>GENERATION:</span>
                <span class="stat-value" id="beta-gen">0 / 500</span>
            </div>
            <div class="stat-line">
                <span>PARTICLES ACTIVE:</span>
                <span class="stat-value" id="beta-particles">0</span>
            </div>
            <div class="stat-line">
                <span>SCORE:</span>
                <span class="stat-value" id="beta-score" style="color:#00ffff; font-weight:bold;">0</span>
            </div>
            <!-- NEW HASH READOUTS -->
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">ORIGIN HASH:</span>
                <span class="stat-value" id="beta-origin-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">CURRENT HASH:</span>
                <span class="stat-value" id="beta-current-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="load-btn" style="flex:1;" onclick="loadRandomSeed('beta')">RANDOM SEED</button>
                <button class="load-btn" style="flex:1; background:rgba(0, 255, 255, 0.15); border-color:#00ffff;" onclick="loadDatabaseGlyph('beta')">DB DRAW</button>
            </div>
        </div>
    </div>

    <div class="controls-bar">
        <button class="start-btn pulse-green" id="sim-btn" onclick="toggleSimulation()">ENGAGE ENGINE</button>
        
        <!-- Gravity Slider -->
        <div style="display:flex; align-items:center; gap:10px; color:#fff; font-family:monospace; font-size:11px;">
            <label for="gravity-slider">GRAVITY WELL:</label>
            <input type="range" id="gravity-slider" min="-20000" max="40000" step="1000" value="8000" oninput="updateGravity(this.value)">
            <span id="gravity-val">8000</span>
        </div>

        <!-- Boundary Mode Selector Button -->
        <button class="help-btn" id="boundary-btn" onclick="cycleBoundaryMode()" style="min-width: 170px;">BOUNDARIES: NONE</button>

        <button class="help-btn" onclick="clearArena()">CLEAR ARENA</button>
    </div>
</div>

<script>
    // 1. Core State & Variable Declarations (Declared FIRST)
    const databaseGlyphs = <?php echo json_encode($myGlyphs ?: []); ?>;
    const canvas = document.getElementById('physics-canvas');
    let isRunning = false;

    // 2. Engines & Arena Manager
    const alphaEngine = new LifeEngine('glyph-alpha-canvas', 16);
    const betaEngine  = new LifeEngine('glyph-beta-canvas', 16);
    const arena       = new ArenaManager('physics-canvas');
    const scores = { alphaScore: 0, betaScore: 0 };

    // Helper to select a random glyph from the database array
    function getRandomDatabaseGlyph() {
        if (!databaseGlyphs || databaseGlyphs.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * databaseGlyphs.length);
        return databaseGlyphs[randomIndex];
    }

    // 3. Module & Seed Setup Function
    function loadInitialGlyphs() {
        if (databaseGlyphs.length > 0) {
            const alphaData = databaseGlyphs[0];
            alphaEngine.loadFromBinary(alphaData.BIN, parseInt(alphaData.GENERATIONS) || 500);
            document.getElementById('alpha-name').innerText = alphaData.BATTLE_NAME;
        } else {
            alphaEngine.loadFromBinary(getRandomBinary(256), 500);
        }

        if (databaseGlyphs.length > 1) {
            const betaData = databaseGlyphs[1];
            betaEngine.loadFromBinary(betaData.BIN, parseInt(betaData.GENERATIONS) || 500);
            document.getElementById('beta-name').innerText = betaData.BATTLE_NAME;
        } else {
            betaEngine.loadFromBinary(getRandomBinary(256), 500);
        }

        document.getElementById('alpha-color').style.color = alphaEngine.intrinsicColor;
        document.getElementById('alpha-color').innerText   = alphaEngine.intrinsicColor.toUpperCase();

        document.getElementById('beta-color').style.color  = betaEngine.intrinsicColor;
        document.getElementById('beta-color').innerText    = betaEngine.intrinsicColor.toUpperCase();

        // Canvas Layout Dimensions
        const modWidth = 70;
        const modHeight = 70;
        const padding = 20;

        const stageWidth = canvas.width || 800;
        const stageHeight = canvas.height || 600;

        const centerY = (stageHeight / 2) - (modHeight / 2);
        const centerX = (stageWidth / 2) - (modWidth / 2);

        const alphaX = padding;
        const betaX  = stageWidth - modWidth - padding;

        // 1. Register Source Modules
        arena.addModule(new SourceSpawnModule('alpha_src', alphaX, centerY, modWidth, modHeight, alphaEngine, 'ALPHA'));
        arena.addModule(new SourceSpawnModule('beta_src', betaX, centerY, modWidth, modHeight, betaEngine, 'BETA'));
        
        // 2. Center Score Sink Module
        arena.addModule(new SinkModule('center_sink', centerX, centerY, modWidth, modHeight, scores));

        // 3. Two Gravity Modules on Vertical Axis (Above and Below Center Sink)
        const verticalOffset = 150;
        const currentGravity = parseFloat(document.getElementById('gravity-slider').value) || 8000;

        arena.addModule(new AttractorModule('gravity_top', centerX, centerY - verticalOffset, modWidth, modHeight, currentGravity));
        arena.addModule(new AttractorModule('gravity_bottom', centerX, centerY + verticalOffset, modWidth, modHeight, currentGravity));
    }

    function getRandomBinary(length) {
        return Array.from({ length }, () => (Math.random() > 0.7 ? '1' : '0')).join('');
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        alphaEngine.resize();
        betaEngine.resize();
    }
    
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas.parentElement);

    // Initial positioning setup
    resizeCanvas();
    loadInitialGlyphs();

    function updateHUD() {
        const alphaMaxStr = alphaEngine.maxGenerations === Infinity ? '?' : alphaEngine.maxGenerations;
        const betaMaxStr  = betaEngine.maxGenerations  === Infinity ? '?' : betaEngine.maxGenerations;

        document.getElementById('alpha-gen').innerText = `${alphaEngine.iteration} / ${alphaMaxStr}`;
        document.getElementById('beta-gen').innerText  = `${betaEngine.iteration} / ${betaMaxStr}`;

        const alphaCount = arena.particles.filter(p => p.sourceId === 'alpha_src').length;
        const betaCount  = arena.particles.filter(p => p.sourceId === 'beta_src').length;
        document.getElementById('alpha-particles').innerText = alphaCount;
        document.getElementById('beta-particles').innerText  = betaCount;

        // Score Readouts
        document.getElementById('alpha-score').innerText = scores.alphaScore;
        document.getElementById('beta-score').innerText  = scores.betaScore;

        document.getElementById('alpha-origin-hash').innerText  = alphaEngine.originHash  || '-';
        document.getElementById('alpha-current-hash').innerText = alphaEngine.currentHash || '-';
        document.getElementById('beta-origin-hash').innerText   = betaEngine.originHash   || '-';
        document.getElementById('beta-current-hash').innerText  = betaEngine.currentHash  || '-';
    }

    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    function loop() {
        if (isRunning) {
            arena.updateAndRender();
            
            alphaEngine.render();
            betaEngine.render();

            updateHUD();

            // Real-time FPS Calculation
            frameCount++;
            const now = performance.now();
            if (now - lastFpsUpdate >= 500) { // Update readout twice a second
                const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
                document.getElementById('fps-counter').innerText = fps;
                frameCount = 0;
                lastFpsUpdate = now;
            }
        }
        requestAnimationFrame(loop);
    }
    loop();

    function toggleSimulation() {
        isRunning = !isRunning;
        const btn = document.getElementById('sim-btn');
        btn.innerText = isRunning ? "HALT ENGINE" : "ENGAGE ENGINE";
        btn.classList.toggle('pulse-green', !isRunning);
    }

    function clearArena() {
        arena.particles = [];
        scores.alphaScore = 0;
        scores.betaScore = 0;
        updateHUD();
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // 1. Spawns pure, high-entropy random binary noise (Infinite maxGen until halt)
    function loadRandomSeed(source) {
        const targetEngine = source === 'alpha' ? alphaEngine : betaEngine;
        const prefix = source === 'alpha' ? 'alpha' : 'beta';

        const randomBin = getRandomBinary(256);
        targetEngine.loadFromBinary(randomBin, Infinity);

        document.getElementById(`${prefix}-name`).innerText = `RAND_${Math.floor(Math.random() * 8999 + 1000)}`;
        document.getElementById(`${prefix}-color`).style.color = targetEngine.intrinsicColor;
        document.getElementById(`${prefix}-color`).innerText   = targetEngine.intrinsicColor.toUpperCase();

        targetEngine.render();
        updateHUD();
    }

    // 2. Draws a curated, long-lived/registered Glyph from the user database
    function loadDatabaseGlyph(source) {
        if (!databaseGlyphs || databaseGlyphs.length === 0) {
            alert("No registered database Glyphs available! Spawn random seeds or log in to mine custom Glyphs.");
            return;
        }

        const targetEngine = source === 'alpha' ? alphaEngine : betaEngine;
        const prefix = source === 'alpha' ? 'alpha' : 'beta';

        const randomDbGlyph = getRandomDatabaseGlyph();
        targetEngine.loadFromBinary(randomDbGlyph.BIN, parseInt(randomDbGlyph.GENERATIONS) || 500);

        document.getElementById(`${prefix}-name`).innerText = randomDbGlyph.BATTLE_NAME;
        document.getElementById(`${prefix}-color`).style.color = targetEngine.intrinsicColor;
        document.getElementById(`${prefix}-color`).innerText   = targetEngine.intrinsicColor.toUpperCase();

        targetEngine.render();
        updateHUD();
    }

    function updateGravity(value) {
        const val = parseFloat(value);
        document.getElementById('gravity-val').innerText = val;

        // Synchronize strength across both vertical attractors
        const topWell = arena.modules.get('gravity_top');
        const bottomWell = arena.modules.get('gravity_bottom');
        if (topWell) topWell.strength = val;
        if (bottomWell) bottomWell.strength = val;
    }

    function cycleBoundaryMode() {
        const modes = ['none', 'toroidal', 'box'];
        const labels = {
            'none': 'BOUNDARIES: NONE',
            'toroidal': 'BOUNDARIES: TOROIDAL',
            'box': 'BOUNDARIES: SOLID BOX'
        };

        const currentIndex = modes.indexOf(arena.boundaryMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];

        arena.boundaryMode = nextMode;
        document.getElementById('boundary-btn').innerText = labels[nextMode];
    }

</script>

</body>
</html>