from importlib import import_module

from app.rules.base import FraudRule

_registry: dict[str, type[FraudRule]] = {}


def register(cls):
    if cls.name in _registry and _registry[cls.name] is not cls:
        raise ValueError(f"Duplicate rule: {cls.name}")
    _registry[cls.name] = cls
    return cls


def discover(modules):
    for module in modules:
        import_module(module)
    return dict(_registry)
