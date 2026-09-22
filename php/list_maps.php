<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../../../priv/db_conf_laniakea.php';

// Fix: Proper PHP logical OR (||) operator
if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

try {
    // Fetch summary info for map browser UI
    $stmt = $pdo->query('
        SELECT id, map_name, user_name, grid_size, created_at, updated_at 
        FROM hypnomaps 
        ORDER BY updated_at DESC 
        LIMIT 50
    ');
    
    // Fix: Explicitly fetch as an associative array
    $maps = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $maps]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed']);
    exit;
}