"""Create ignored local and Docker configuration without printing secrets."""
from pathlib import Path
import secrets
root = Path(__file__).resolve().parents[1]
for target in (root / '.env', root / 'backend' / '.env'):
    if target.exists():
        print(f'Preserved existing {target.relative_to(root)}')
        continue
    template = target.with_name('.env.example').read_text()
    template = template.replace('JWT_SECRET=\n', f'JWT_SECRET={secrets.token_urlsafe(48)}\n')
    template = template.replace('POSTGRES_PASSWORD=\n', f'POSTGRES_PASSWORD={secrets.token_hex(24)}\n')
    target.write_text(template)
    target.chmod(0o600)
    print(f'Created {target.relative_to(root)}')
