<?php
// Protected: set CYBERTRACE_PHP_ADMIN_PASSWORD, then sign in with any username and that password.
$expected = getenv('CYBERTRACE_PHP_ADMIN_PASSWORD');
$given = $_SERVER['PHP_AUTH_PW'] ?? '';
if (!$expected || !hash_equals($expected, $given)) {
    header('WWW-Authenticate: Basic realm="CYBERTRACE records"');
    http_response_code($expected ? 401 : 403);
    echo $expected ? 'Authentication required.' : 'Set CYBERTRACE_PHP_ADMIN_PASSWORD to enable this page.';
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CYBERTRACE — PHP User Records</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; background: #080d14; color: #f2f6f8; }
    main { max-width: 900px; margin: 60px auto; padding: 0 20px; }
    h1 { margin-bottom: 8px; } p { color: #93a1af; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    th, td { text-align: left; padding: 14px; border-bottom: 1px solid #263548; }
    th { color: #a3f36b; font-size: 12px; letter-spacing: 1px; }
  </style>
</head>
<body>
<main>
  <h1>PHP User Records</h1>
  <p>Names and email addresses only — no passwords are stored here.</p>
  <?php
  require __DIR__ . '/database.php';
  $users = $database->query('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC')->fetchAll();
  ?>
  <table>
    <thead><tr><th>ID</th><th>NAME</th><th>EMAIL</th><th>CREATED</th></tr></thead>
    <tbody>
      <?php foreach ($users as $user): ?>
        <tr>
          <td><?= htmlspecialchars((string)$user['id']) ?></td>
          <td><?= htmlspecialchars($user['name']) ?></td>
          <td><?= htmlspecialchars($user['email']) ?></td>
          <td><?= htmlspecialchars($user['created_at']) ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</main>
</body>
</html>
