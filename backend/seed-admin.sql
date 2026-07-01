DELETE FROM users WHERE email = 'admin@engage.com';

INSERT INTO users (email, password_hash, first_name, last_name, role, status, is_approved)
VALUES ('admin@relanto.ai', '$2b$10$bcmi6ddd0vcDKF3GFTnCyerCqurNnYtM1iB5eo3OUG2zLEk8F7wjK', 'Admin', 'User', 'ADMIN', 'ACTIVE', true);
