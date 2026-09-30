import logging
import time

from app.database import SessionLocal
from app.services.notifications import process_one

logging.basicConfig(level=logging.INFO)


def main():
    while True:
        try:
            with SessionLocal() as db:
                processed = process_one(db)
            if not processed:
                time.sleep(2)
        except Exception:
            logging.exception("Notification worker iteration failed")
            time.sleep(5)


if __name__ == "__main__":
    main()
