from flask import Blueprint, render_template, request, redirect, url_for, flash
from sqlalchemy.exc import IntegrityError
from ..extensions import db
from ..forms import StudentCreateForm, StudentEditForm, StudentLoginForm
from ..models import Student


bp = Blueprint("student", __name__)


@bp.route("/", methods=["GET", "POST"])
def index():
    form = StudentLoginForm()
    login_tip = ""
    if form.validate_on_submit():
        student_id = form.student_id.data.strip()
        verify_last4 = form.verify_last4.data.strip().upper()
        stu = Student.query.filter_by(student_id=student_id).first()
        if stu:
            if verify_last4 != stu.last4_of_id().upper():
                flash("校验码不匹配", "danger")
                return redirect(url_for("student.index"))
            # 登录成功，进入更新页
            from flask import session as flask_session
            flask_session["student_id"] = student_id
            flash("已成功登录，可进行信息更新。", "success")
            return redirect(url_for("student.edit"))
        else:
            login_tip = "未找到信息，请先点击‘信息填写’完成录入，或登录后自动跳转。"
    return render_template("student_login.html", form=form, login_tip=login_tip)


def _require_student_session() -> str:
    from flask import session as flask_session
    sid = flask_session.get("student_id")
    if not sid:
        return ""
    return sid


@bp.route("/logout")
def logout():
    from flask import session as flask_session
    flask_session.clear()
    flash("已退出", "info")
    return redirect(url_for("student.index"))


@bp.route("/create", methods=["GET", "POST"])
def create():
    form = StudentCreateForm()
    
    # 若首页预填过学号则带入
    from flask import session as flask_session
    preset = flask_session.get("pending_student_id")
    if preset and not form.student_id.data:
        form.student_id.data = preset
    
    if form.validate_on_submit():
        student = Student.query.filter_by(student_id=form.student_id.data.strip()).first()
        if student:
            # 已存在则直接进入更新页
            flask_session["student_id"] = student.student_id
            flash("该学号已存在，已为你打开信息更新页面", "info")
            return redirect(url_for("student.edit"))

        student = Student(
            name=form.name.data.strip(),
            gender=form.gender.data.strip(),
            student_id=form.student_id.data.strip(),
            id_card=form.id_card.data.strip(),
            phone=form.phone.data.strip(),
            major=form.major.data.strip(),
            clazz=form.clazz.data.strip(),
            hometown=form.hometown.data.strip(),
        )
        student.update_admin_class()
        db.session.add(student)
        try:
            db.session.commit()
            flask_session["student_id"] = student.student_id
            flash("🎉 信息提交成功！系统已自动生成您的行政班级。", "success")
            return redirect(url_for("student.edit"))
        except IntegrityError:
            db.session.rollback()
            flash("学号已存在", "danger")
    return render_template("student_create.html", form=form)


@bp.route("/edit", methods=["GET", "POST"])
def edit():
    sid = _require_student_session()
    if not sid:
        return redirect(url_for("student.index"))
    stu = Student.query.filter_by(student_id=sid).first()
    if not stu:
        flash("未找到信息，请先填写", "warning")
        return redirect(url_for("student.create"))
    
    form = StudentEditForm(obj=stu)
    
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
            flash("✅ 信息更新成功！您可继续更新或退出。", "success")
            return redirect(url_for("student.edit"))
        except IntegrityError:
            db.session.rollback()
            flash("更新失败", "danger")
    return render_template("student_edit.html", form=form, stu=stu)


