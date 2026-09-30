.PHONY: test build dev demo

test:
	cd backend && uv run pytest

build:
	cd frontend && npm run build

dev:
	docker compose up --build

demo:
	docker compose exec backend python -m app.cli generate-demo-data --transactions 500
