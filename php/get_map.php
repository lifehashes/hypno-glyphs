<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../../../priv/db_conf_laniakea.php';

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

$mapId = $_GET['id'] ?? null;

if (!$mapId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing map ID']);
    exit;
}

try {
    $stmt = $pdo->prepare('
        SELECT id, map_name, user_name, grid_size, payload, created_at, updated_at 
        FROM hypnomaps 
        WHERE id = :id
    ');
    $stmt->execute([':id' => $mapId]);
    $map = $stmt->fetch();

    if (!$map) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Map not found']);
        exit;
    }

    // Decode internal payload array so client receives native JSON
    $map['payload'] = json_decode($map['payload']);

    echo json_encode(['success' => true, 'data' => $map]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed']);
    exit;
}