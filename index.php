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
    <SCRIPT SRC="js/sha256.js"></SCRIPT>
	<SCRIPT SRC="js/gol.js"></SCRIPT>
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
            <button class="load-btn" onclick="randomizeSource('alpha')">RANDOMIZE SEED</button>
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
                <span class="stat-value" id="beta-name">CALABI-YAU</span>
            </div>
            <div class="stat-line">
                <span>INTRINSIC HUE:</span>
                <span class="stat-value" id="beta-color" style="color: #00ffff">#00FFFF</span>
            </div>
            <div class="stat-line">
                <span>GENERATION:</span>
                <span class="stat-value" id="beta-gen">0 / 500</span>
            </div>
            <div class="stat-line">
                <span>PARTICLES ACTIVE:</span>
                <span class="stat-value" id="beta-particles">0</span>
            </div>
            <button class="load-btn" onclick="randomizeSource('beta')">RANDOMIZE SEED</button>
        </div>
    </div>

    <div class="controls-bar">
        <button class="start-btn pulse-green" id="sim-btn" onclick="toggleSimulation()">ENGAGE ENGINE</button>
        <button class="help-btn" onclick="clearArena()">CLEAR ARENA</button>
    </div>
</div>

<script>

    // Pass PHP MySQL database glyph records into JavaScript
    const databaseGlyphs = <?php echo json_encode($myGlyphs ?: []); ?>;

    // Initialize Alpha and Beta engines
    const alphaEngine = new LifeEngine('glyph-alpha-canvas', 16);
    const betaEngine  = new LifeEngine('glyph-beta-canvas', 16);

    // Load initial seeds (database records or randomized fallback)
    function loadInitialGlyphs() {
        if (databaseGlyphs.length > 0) {
            const alphaData = databaseGlyphs[0];
            alphaEngine.loadFromBinary(alphaData.BIN);
            document.getElementById('alpha-name').innerText = alphaData.BATTLE_NAME;
        } else {
            alphaEngine.loadFromBinary(getRandomBinary(256));
        }

        if (databaseGlyphs.length > 1) {
            const betaData = databaseGlyphs[1];
            betaEngine.loadFromBinary(betaData.BIN);
            document.getElementById('beta-name').innerText = betaData.BATTLE_NAME;
        } else {
            betaEngine.loadFromBinary(getRandomBinary(256));
        }

        // Sync DOM metadata display with engine colors
        document.getElementById('alpha-color').style.color = alphaEngine.intrinsicColor;
        document.getElementById('alpha-color').innerText   = alphaEngine.intrinsicColor.toUpperCase();

        document.getElementById('beta-color').style.color  = betaEngine.intrinsicColor;
        document.getElementById('beta-color').innerText    = betaEngine.intrinsicColor.toUpperCase();
    }

    loadInitialGlyphs();

    function getRandomBinary(length) {
        return Array.from({ length }, () => (Math.random() > 0.7 ? '1' : '0')).join('');
    }

    const canvas = document.getElementById('physics-canvas');
    const ctx = canvas.getContext('2d');
    let isRunning = false;

    // Observe layout changes and adjust source preview resolution
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Keep preview canvas sizing sharp and fitted
        alphaEngine.resize();
        betaEngine.resize();
    }
    
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas.parentElement);

    function loop() {
        if (isRunning) {
            ctx.fillStyle = 'rgba(5, 5, 5, 0.25)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tech grid rendering
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function randomizeSource(source) {
        console.log(`Randomizing ${source} seed...`);
    }
</script>

</body>
</html>