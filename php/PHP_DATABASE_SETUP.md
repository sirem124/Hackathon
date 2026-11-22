# CYBERTRACE PHP User Database

This separate SQLite database stores only:

- Full name
- Email address
- Account creation timestamp

It deliberately does not store passwords.

## Files

- `database.php` creates `cybertrace_php_users.db`.
- `signup.php` accepts `POST` fields named `name` and `email`.
- `users.php` displays the saved records.

## Run on Windows

1. Install PHP and enable the `pdo_sqlite` extension.
2. Open a terminal in this project.
3. Run:

```powershell
php -S localhost:8080
```

4. Open:

- Viewer: `http://localhost:8080/php/users.php`
- Signup endpoint: `POST http://localhost:8080/php/signup.php`
