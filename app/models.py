from datetime import datetime
from .extensions import db
from werkzeug.security import generate_password_hash, check_password_hash


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    gender = db.Column(db.String(10), nullable=False)
    student_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    id_card = db.Column(db.String(18), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    major = db.Column(db.String(100), nullable=False)
    clazz = db.Column(db.String(100), nullable=False)
    hometown = db.Column(db.String(100), nullable=False)
    admin_class = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def last4_of_id(self) -> str:
        return (self.id_card or "")[-4:]

    @staticmethod
    def generate_admin_class(major: str, clazz: str) -> str:
        """根据专业和班级生成行政班级"""
        if major == "物理学":
            return f"物理{clazz}"
        elif major == "光电信息科学与工程":
            return f"光电{clazz}"
        elif major == "量子信息科学":
            return f"量信{clazz}"
        else:
            return f"{major}{clazz}"

    def update_admin_class(self):
        """更新行政班级"""
        self.admin_class = self.generate_admin_class(self.major, self.clazz)


class Admin(db.Model):
    __tablename__ = "admins"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


