"""
加密服务模块
用于加密存储敏感数据（如API Key）
"""
import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class EncryptionService:
    """API Key等敏感数据的加密服务"""

    def __init__(self, key: Optional[str] = None):
        """
        初始化加密服务

        Args:
            key: 加密密钥，如果不提供则使用配置中的密钥
        """
        encryption_key = key or settings.encryption_key
        # 从密钥派生32字节的Fernet密钥
        derived_key = hashlib.sha256(encryption_key.encode()).digest()
        self.cipher = Fernet(base64.urlsafe_b64encode(derived_key))

    def encrypt(self, plain_text: str) -> str:
        """
        加密文本

        Args:
            plain_text: 明文

        Returns:
            加密后的密文（base64编码）
        """
        if not plain_text:
            raise ValueError("Cannot encrypt empty string")
        return self.cipher.encrypt(plain_text.encode()).decode()

    def decrypt(self, encrypted_text: str) -> str:
        """
        解密文本

        Args:
            encrypted_text: 密文

        Returns:
            解密后的明文

        Raises:
            ValueError: 解密失败时抛出
        """
        if not encrypted_text:
            raise ValueError("Cannot decrypt empty string")
        try:
            return self.cipher.decrypt(encrypted_text.encode()).decode()
        except InvalidToken:
            raise ValueError("Decryption failed: invalid token or corrupted data")

    @staticmethod
    def mask_api_key(api_key: str, visible_chars: int = 4) -> str:
        """
        对API Key进行掩码处理，只显示首尾几个字符

        Args:
            api_key: 原始API Key
            visible_chars: 首尾各显示的字符数

        Returns:
            掩码后的字符串，如 "sk-xx...xxxx"
        """
        if not api_key:
            return "***"
        if len(api_key) <= visible_chars * 2:
            return "***"
        return f"{api_key[:visible_chars]}...{api_key[-visible_chars:]}"


# 全局单例
encryption_service = EncryptionService()


def encrypt_api_key(api_key: str) -> str:
    """
    加密 API Key（对外的便捷函数，保持与旧代码兼容）
    """
    return encryption_service.encrypt(api_key)


def decrypt_api_key(encrypted_api_key: str) -> str:
    """
    解密 API Key（对外的便捷函数，保持与旧代码兼容）
    """
    return encryption_service.decrypt(encrypted_api_key)
