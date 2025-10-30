import io
import os
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, send_file
from sqlalchemy import or_
from ..extensions import db
from ..models import Student, Admin
from openpyxl import Workbook
from ..forms import BulkImportForm, AdminLoginForm, StudentEditForm
from werkzeug.utils import secure_filename
import csv


bp = Blueprint("admin", __name__)


def _is_logged_in() -> bool:
    return bool(session.get("admin_logged_in"))


@bp.route("/login", methods=["GET", "POST"])
def login():
    form = AdminLoginForm()
    if form.validate_on_submit():
        admin = Admin.query.filter_by(username=form.username.data.strip()).first()
        if admin and admin.check_password(form.password.data):
            session["admin_logged_in"] = True
            session["admin_username"] = admin.username
            return redirect(url_for("admin.list_students"))
        flash("用户名或密码错误", "danger")
    return render_template("admin_login.html", form=form)


@bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("admin.login"))


@bp.route("/students")
def list_students():
    if not _is_logged_in():
        return redirect(url_for("admin.login"))

    q = request.args.get("q", "").strip()
    genders = [g.strip() for g in request.args.getlist("gender") if g.strip()]
    majors = [m.strip() for m in request.args.getlist("major") if m.strip()]
    clazz_param = request.args.get("clazz", "").strip()
    clazz_list = [c for c in [x.strip() for x in clazz_param.split(",")] if c]
    page = max(int(request.args.get("page", 1) or 1), 1)
    per_page = 40

    query = Student.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Student.name.like(like),
                Student.student_id.like(like),
                Student.id_card.like(like),
                Student.phone.like(like),
                Student.major.like(like),
                Student.clazz.like(like),
            )
        )
    if genders:
        query = query.filter(Student.gender.in_(genders))
    if majors:
        query = query.filter(Student.major.in_(majors))
    if clazz_list:
        query = query.filter(Student.clazz.in_(clazz_list))

    pagination = query.order_by(Student.updated_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    import_form = BulkImportForm()
    current_gender = genders[0] if genders else ""
    current_major = majors[0] if majors else ""
    return render_template(
        "admin_list.html",
        students=pagination.items,
        q=q,
        gender=current_gender,
        major=current_major,
        clazz=clazz_param,
        import_form=import_form,
        pagination=pagination,
    )


@bp.route("/export")
def export_excel():
    import io
    if not _is_logged_in():
        return redirect(url_for("admin.login"))

    q = request.args.get("q", "").strip()
    gender = request.args.get("gender", "").strip()
    major = request.args.get("major", "").strip()
    clazz = request.args.get("clazz", "").strip()
    fmt = (request.args.get("format", "xlsx") or "xlsx").lower()

    all_fields = [
        "student_id", "name", "gender", "hometown", "id_card", "phone", "major", "clazz", "admin_class", "created_at", "updated_at"
    ]
    req_fields = request.args.getlist("fields")
    if not req_fields:
        fields = all_fields
    else:
        # 只用 intersection 部分, 且用页面顺序排序
        fields = [f for f in all_fields if f in req_fields]

    student_ids = request.args.getlist("student_ids")
    field_map = {
        "student_id": "学号",
        "name": "姓名",
        "gender": "性别",
        "hometown": "籍贯",
        "id_card": "身份证号码",
        "phone": "电话号码",
        "major": "专业",
        "clazz": "班级",
        "admin_class": "行政班级",
        "created_at": "创建时间",
        "updated_at": "更新时间"
    }
    headers = [field_map.get(field, field) for field in fields]
    if student_ids:
        query = Student.query.filter(Student.id.in_(student_ids))
        students = query.order_by(Student.updated_at.desc()).all()
    else:
        students = []
    if fmt == "csv":
        import csv
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(headers)
        for s in students:
            row = []
            for field in fields:
                if field == "created_at":
                    row.append(s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else "")
                elif field == "updated_at":
                    row.append(s.updated_at.strftime("%Y-%m-%d %H:%M:%S") if s.updated_at else "")
                else:
                    row.append(getattr(s, field, ""))
            w.writerow(row)
        data = io.BytesIO(buf.getvalue().encode("utf-8-sig"))
        filename = f"students_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return send_file(data, as_attachment=True, download_name=filename, mimetype="text/csv")
    else:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "学生信息"
        ws.append(headers)
        for s in students:
            row = []
            for field in fields:
                if field == "created_at":
                    row.append(s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else "")
                elif field == "updated_at":
                    row.append(s.updated_at.strftime("%Y-%m-%d %H:%M:%S") if s.updated_at else "")
                else:
                    row.append(getattr(s, field, ""))
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        filename = f"students_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return send_file(buf, as_attachment=True, download_name=filename, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@bp.route("/import", methods=["POST"])
def import_bulk():
    if not _is_logged_in():
        return redirect(url_for("admin.login"))
    form = BulkImportForm()
    if not form.validate_on_submit():
        flash("请选择文件", "danger")
        return redirect(url_for("admin.list_students"))

    file = request.files.get("file")
    if not file or file.filename == "":
        flash("未选择文件", "danger")
        return redirect(url_for("admin.list_students"))

    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()

    rows = []
    try:
        if ext in [".xlsx", ".xlsm", ".xltx", ".xltm"]:
            from openpyxl import load_workbook
            wb = load_workbook(file)
            ws = wb.active
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    continue
                rows.append(row)
        elif ext in [".csv", ".txt"]:
            file.stream.seek(0)
            text = file.stream.read().decode("utf-8-sig")
            for i, row in enumerate(csv.reader(text.splitlines())):
                if i == 0:
                    continue
                rows.append(row)
        else:
            flash("不支持的文件格式", "danger")
            return redirect(url_for("admin.list_students"))
    except Exception as e:
        flash(f"文件读取失败: {e}", "danger")
        return redirect(url_for("admin.list_students"))

    # 期望列顺序：姓名、性别、学号、身份证号码、电话号码、专业、班级
    inserted, updated, failed = 0, 0, 0
    for row in rows:
        try:
            name, gender, student_id, id_card, phone, major, clazz = [str(x).strip() if x is not None else "" for x in row[:7]]
            if not all([name, gender, student_id, id_card, phone, major, clazz]):
                failed += 1
                continue
            stu = Student.query.filter_by(student_id=student_id).first()
            if stu:
                stu.name = name
                stu.gender = gender
                stu.id_card = id_card
                stu.phone = phone
                stu.major = major
                stu.clazz = clazz
                updated += 1
            else:
                db.session.add(Student(
                    name=name,
                    gender=gender,
                    student_id=student_id,
                    id_card=id_card,
                    phone=phone,
                    major=major,
                    clazz=clazz,
                ))
                inserted += 1
        except Exception:
            failed += 1
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        flash(f"导入提交失败: {e}", "danger")
        return redirect(url_for("admin.list_students"))

    flash(f"导入完成：新增 {inserted} 条，更新 {updated} 条，失败 {failed} 条", "success")
    return redirect(url_for("admin.list_students"))


@bp.route("/students/delete", methods=["POST"])
def delete_students():
    if not _is_logged_in():
        return redirect(url_for("admin.login"))
    
    student_ids = request.form.getlist("student_ids")
    if not student_ids:
        flash("请选择要删除的学生", "warning")
        return redirect(url_for("admin.list_students"))
    
    try:
        deleted_count = Student.query.filter(Student.id.in_(student_ids)).delete(synchronize_session=False)
        db.session.commit()
        flash(f"已删除 {deleted_count} 条记录", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"删除失败: {e}", "danger")
    
    return redirect(url_for("admin.list_students"))


@bp.route("/students/<int:student_pk>/edit", methods=["GET", "POST"])
def edit_student(student_pk: int):
    if not _is_logged_in():
        return redirect(url_for("admin.login"))
    stu = Student.query.get_or_404(student_pk)
    form = StudentEditForm(obj=stu)
    messages = []
    if form.validate_on_submit():
        stu.name = form.name.data.strip()
        stu.gender = form.gender.data.strip()
        stu.id_card = form.id_card.data.strip()
        stu.phone = form.phone.data.strip()
        stu.major = form.major.data.strip()
        stu.clazz = form.clazz.data.strip()
        stu.hometown = form.hometown.data.strip()
        stu.update_admin_class()
        try:
            db.session.commit()
            messages.append(("success", "已保存"))
        except Exception as e:
            db.session.rollback()
            messages.append(("danger", "保存失败: %s" % e))
    return render_template("admin_edit.html", form=form, stu=stu, messages=messages)


