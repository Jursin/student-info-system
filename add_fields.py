import sys
from app import create_app, db
from sqlalchemy import text

app = create_app()

def add_missing_fields():
    """手动为students表添加缺失的字段"""
    with app.app_context():
        try:
            # 添加ethnicity字段
            db.session.execute(text(
                "ALTER TABLE students ADD COLUMN ethnicity VARCHAR(50)"
            ))
            print("添加ethnicity字段成功")
            
            # 添加political_status字段
            db.session.execute(text(
                "ALTER TABLE students ADD COLUMN political_status VARCHAR(50)"
            ))
            print("添加political_status字段成功")
            
            db.session.commit()
            print("字段添加完成")
        except Exception as e:
            db.session.rollback()
            print(f"添加字段时出错: {e}")
            sys.exit(1)

if __name__ == "__main__":
    add_missing_fields()