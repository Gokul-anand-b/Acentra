import argparse
import getpass
import json

from sqlalchemy import select

from app.auth import hasher
from app.database import SessionLocal
from app.demo import generate
from app.models import RuleConfig, User
from app.services.engine import rule_catalog


def main():
    parser = argparse.ArgumentParser(description="FraudGuard administration")
    commands = parser.add_subparsers(dest="command", required=True)
    user = commands.add_parser("create-user")
    user.add_argument("--email", required=True)
    user.add_argument("--name", default="Analyst")
    user.add_argument("--role", choices=["reviewer", "admin"], default="reviewer")
    commands.add_parser("init-rules")
    demo = commands.add_parser("generate-demo-data")
    demo.add_argument("--transactions", type=int, default=500)
    demo.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.command == "create-user":
            if db.scalar(select(User).where(User.email == args.email.lower())):
                parser.error("User already exists")
            password = getpass.getpass("Password (12+ characters): ")
            if len(password) < 12:
                parser.error("Use at least 12 characters")
            db.add(
                User(
                    email=args.email.lower(),
                    name=args.name,
                    role=args.role,
                    password_hash=hasher.hash(password),
                )
            )
            db.commit()
            print("User created")
        elif args.command == "init-rules":
            for cls, config in rule_catalog(db):
                if config is None:
                    db.add(RuleConfig(name=cls.name, parameters=cls.defaults))
            db.commit()
            print("Rules initialized")
        else:
            if not 1 <= args.transactions <= 10000:
                parser.error("Use 1–10,000 transactions per demo batch")
            print(json.dumps(generate(db, args.transactions, args.seed)))


if __name__ == "__main__":
    main()
