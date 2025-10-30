import sys
from app import create_app, db
from app.models import Student, Admin

app = create_app()


@app.cli.command("db")
def init_db():
    """初始化数据库表"""
    with app.app_context():
        db.create_all()
        print("Tables created.")
        
        # 为现有记录更新行政班级
        students = Student.query.filter(Student.admin_class.is_(None)).all()
        for student in students:
            student.update_admin_class()
        if students:
            db.session.commit()
            print(f"Updated admin_class for {len(students)} existing students.")


@app.cli.command("create-admin")
def create_admin():
    """创建默认管理员（如已存在则跳过）"""
    with app.app_context():
        if not Admin.query.filter_by(username="admin").first():
            a = Admin(username="admin")
            a.set_password("admin123")
            db.session.add(a)
            db.session.commit()
            print("Admin created: admin / admin123 (请尽快修改密码)")
        else:
            print("Admin exists, skip.")


if __name__ == "__main__":
    # 支持：python run.py db | python run.py create-admin | python run.py
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "db":
            with app.app_context():
                db.create_all()
                print("Tables created.")
        elif cmd == "create-admin":
            with app.app_context():
                if not Admin.query.filter_by(username="admin").first():
                    a = Admin(username="admin")
                    a.set_password("admin123")
                    db.session.add(a)
                    db.session.commit()
                    print("Admin created: admin / admin123 (请尽快修改密码)")
                else:
                    print("Admin exists, skip.")
        else:
            app.run(host="127.0.0.1", port=5000, debug=True)
    else:
        app.run(host="127.0.0.1", port=5000, debug=True)


