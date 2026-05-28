from __future__ import annotations

import base64
import os
from cryptography.fernet import Fernet

_ENCRYPTION_KEY_ENV = "ENCRYPTION_KEY"


def _get_key() -> bytes:
    key_str = os.getenv(_ENCRYPTION_KEY_ENV)
    if not key_str:
        raise RuntimeError(
            f"{_ENCRYPTION_KEY_ENV} is not set — MT5 passwords cannot be encrypted. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return base64.urlsafe_b64decode(key_str)


def encrypt_password(plaintext: str) -> str:
    f = Fernet(_get_key())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    f = Fernet(_get_key())
    return f.decrypt(encrypted.encode()).decode()
