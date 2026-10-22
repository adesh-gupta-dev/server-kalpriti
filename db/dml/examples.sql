-- Development examples for every application table. No data is retained.
-- Run against the local testing database after DDL installation.
-- This is NOT a production seed or a Stripe payment verification workflow.
BEGIN;

-- INSERT: deliberately unusable password; this fixture cannot log in.
INSERT INTO users (id, name, email, password, verified)
VALUES ('eeeeeeeeeeeeeeeeeeeeee01', 'SQL example user',
        'sql-example@example.test', '!example-no-login!', true);

INSERT INTO projects (id, name, initial_prompt, current_code, user_id)
VALUES ('eeeeeeeeeeeeeeeeeeeeee02', 'Example website', 'Create a landing page',
        '<h1>Example</h1>', 'eeeeeeeeeeeeeeeeeeeeee01');

INSERT INTO project_versions (id, project_id, code, description, position)
VALUES ('eeeeeeeeeeeeeeeeeeeeee03', 'eeeeeeeeeeeeeeeeeeeeee02',
        '<h1>Example</h1>', 'Initial example version', 0);

INSERT INTO conversations (id, project_id, role, content, position)
VALUES
  ('eeeeeeeeeeeeeeeeeeeeee04', 'eeeeeeeeeeeeeeeeeeeeee02', 'user', 'Create a landing page', 0),
  ('eeeeeeeeeeeeeeeeeeeeee05', 'eeeeeeeeeeeeeeeeeeeeee02', 'assistant', '<h1>Example</h1>', 1);

UPDATE projects
SET current_version_id = 'eeeeeeeeeeeeeeeeeeeeee03', is_published = true, updated_at = now()
WHERE id = 'eeeeeeeeeeeeeeeeeeeeee02';

INSERT INTO payment_transactions
  (id, user_id, plan_id, amount, credits, payment_provider, payment_intent_id)
VALUES ('eeeeeeeeeeeeeeeeeeeeee06', 'eeeeeeeeeeeeeeeeeeeeee01',
        'plan_basic_10', 50.00, 20, 'Stripe', 'pi_sql_example_only');

-- UPDATE: conditional credit debit; zero rows means missing user/insufficient balance.
UPDATE users SET credits = credits - 5, total_creation = total_creation + 1, updated_at = now()
WHERE id = 'eeeeeeeeeeeeeeeeeeeeee01' AND credits >= 5
RETURNING id, credits, total_creation;

-- Atomic, once-only payment credit example. Production first verifies Stripe.
WITH settled AS (
  UPDATE payment_transactions
  SET is_paid = true, credits_applied = true, payment_status = 'Paid', updated_at = now()
  WHERE id = 'eeeeeeeeeeeeeeeeeeeeee06' AND credits_applied = false
  RETURNING user_id, credits
)
UPDATE users AS u SET credits = u.credits + s.credits, updated_at = now()
FROM settled AS s WHERE u.id = s.user_id
RETURNING u.id, u.credits;

-- SELECT: project ownership and deterministic history order.
SELECT p.id, p.name, u.name AS owner_name, p.current_code, p.current_version_id
FROM projects AS p JOIN users AS u ON u.id = p.user_id
WHERE p.user_id = 'eeeeeeeeeeeeeeeeeeeeee01';
SELECT id, code, description, timestamp, position FROM project_versions
WHERE project_id = 'eeeeeeeeeeeeeeeeeeeeee02' ORDER BY position;
SELECT id, role, content, timestamp, position FROM conversations
WHERE project_id = 'eeeeeeeeeeeeeeeeeeeeee02' ORDER BY position;
SELECT id, plan_id, amount, credits, payment_status FROM payment_transactions
WHERE user_id = 'eeeeeeeeeeeeeeeeeeeeee01' ORDER BY created_at DESC, id;

-- DELETE: deleting the current version clears the project pointer, retaining code.
DELETE FROM project_versions WHERE id = 'eeeeeeeeeeeeeeeeeeeeee03';
-- Project deletion cascades its messages and remaining versions.
DELETE FROM projects WHERE id = 'eeeeeeeeeeeeeeeeeeeeee02';
-- Paid history normally remains; removing a user with payments is restricted.
-- These deletes are only for the temporary SQL fixtures.
DELETE FROM payment_transactions WHERE id = 'eeeeeeeeeeeeeeeeeeeeee06';
DELETE FROM users WHERE id = 'eeeeeeeeeeeeeeeeeeeeee01';

-- Roll back ALL examples, even when adding your own exploratory queries above.
ROLLBACK;
