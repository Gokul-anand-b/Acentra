# This workspace's local demonstration

Created during implementation on 2026-09-30. The app was run against a separate PostgreSQL 15 instance, using only loopback interfaces.

- Console: http://127.0.0.1:5173
- API/docs: http://127.0.0.1:8000/docs
- PostgreSQL: `127.0.0.1:55432`, database `fraudguard`
- Database storage: `fraudguard/.runtime/postgres`
- Generated demo login: `fraudguard/.runtime/local-login.json` (ignored; owner-readable)
- Seed: 500 deterministic demo transactions, plus labeled browser-test records
- Notification mode: `console`; worker statuses are `LOCAL_LOGGED`

Read the local login file to sign in as Demo Analyst. Passwords are hashed in the database and are not stored in source control. A separate browser-test user is used for automated checks.

If the processes have stopped, from the `fraudguard` directory:

```bash
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D .runtime/postgres -l .runtime/postgres.log -o '-p 55432 -h 127.0.0.1' start
```

Then run the API, worker, and Vite commands in the README. The backend `.env` in this workspace already points to the local PostgreSQL instance. Do not run the start command if that instance is already running.

To stop just this demonstration database after stopping the API and worker:

```bash
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D .runtime/postgres stop
```

Docker uses its own database volume and configuration. The native instance and Compose database are independent. No cloud resources were created.
