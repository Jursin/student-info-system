from flask_wtf import FlaskForm
from wtforms import StringField, SelectField, PasswordField, FileField
from wtforms.validators import DataRequired, Length, Regexp, ValidationError, Optional
from .validators import is_valid_china_id18


class StudentCreateForm(FlaskForm):
    name = StringField("姓名", validators=[DataRequired(), Regexp(r"^[\u4e00-\u9fa5]{2,4}$", message="请输入2-4个中文姓名")])
    gender = SelectField("性别", choices=[("男", "男"), ("女", "女")])
    student_id = StringField("学号", validators=[DataRequired(), Regexp(r"^\d{10}$", message="学号为10位数字")])
    id_card = StringField("身份证号码")
    phone = StringField("电话号码", validators=[Optional(), Regexp(r"^1\d{10}$", message="手机号为1开头11位数字")])
    major = SelectField("专业", choices=[("物理学", "物理学"), ("光电信息科学与工程", "光电信息科学与工程"), ("量子信息科学", "量子信息科学")])
    clazz = StringField("班级", validators=[Optional(), Regexp(r"^\d{5}$", message="班级为5位数字")])
    ethnicity = StringField("民族", validators=[Optional(), Length(max=50)])
    hometown = StringField("籍贯", validators=[Optional(), Length(max=100)])
    political_status = StringField("政治面貌", validators=[Optional(), Length(max=50)])

    def validate_id_card(self, field):
        if not field.data:
            return
        if not is_valid_china_id18(field.data or ""):
            raise ValidationError("身份证号码不合法")


class StudentEditForm(FlaskForm):
    name = StringField("姓名", validators=[DataRequired(), Regexp(r"^[\u4e00-\u9fa5]{2,4}$")])
    gender = SelectField("性别", choices=[("男", "男"), ("女", "女")])
    id_card = StringField("身份证号码")
    phone = StringField("电话号码", validators=[Optional(), Regexp(r"^1\d{10}$")])
    major = SelectField("专业", choices=[("物理学", "物理学"), ("光电信息科学与工程", "光电信息科学与工程"), ("量子信息科学", "量子信息科学")])
    clazz = StringField("班级", validators=[Optional(), Regexp(r"^\d{5}$")])
    ethnicity = StringField("民族", validators=[Optional(), Length(max=50)])
    hometown = StringField("籍贯", validators=[Optional(), Length(max=100)])
    political_status = StringField("政治面貌", validators=[Optional(), Length(max=50)])

    def validate_id_card(self, field):
        if not field.data:
            return
        if not is_valid_china_id18(field.data or ""):
            raise ValidationError("身份证号码不合法")


class AdminLoginForm(FlaskForm):
    username = StringField("用户名", validators=[DataRequired(), Length(max=50)])
    password = PasswordField("密码", validators=[DataRequired(), Length(min=6, max=64)])


class BulkImportForm(FlaskForm):
    file = FileField("文件", validators=[DataRequired()])


class StudentLoginForm(FlaskForm):
    student_id = StringField("学号", validators=[DataRequired(), Regexp(r"^\d{10}$", message="学号为10位数字")])
    verify_last4 = StringField("校验码", validators=[DataRequired(), Regexp(r"^[0-9Xx]{4}$", message="身份证后四位")])


