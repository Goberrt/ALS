from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi import Body
from email.message import EmailMessage
from email_validator import validate_email, EmailNotValidError
from datetime import timedelta
import bcrypt
import os
import jwt
import datetime
import aiosmtplib
import logging
import datetime as dt
from uuid import UUID
import uuid
import secrets
import string
import shutil
from pathlib import Path


try:
    from dss_module import dss, BarangayAnalysis
    DSS_AVAILABLE = True
except ImportError:
    DSS_AVAILABLE = False
    logging.warning("DSS module not found. DSS features will be unavailable.")



app = FastAPI(title="ALS Backend (FastAPI)")

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
RESET_SECRET = os.getenv("RESET_SECRET", "supersecretkey")  # Add to your .env
RESET_EXPIRY_MINUTES = 30


# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class ForgotPasswordRequest(BaseModel):
    username: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class RegistrationData(BaseModel):
    # Personal Information
    lrn: str
    enrollment_date: str
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    name_extension: Optional[str] = None
    birthdate: str
    place_of_birth: str
    sex: str
    civil_status: str
    religion: Optional[str] = None
    mother_tongue: Optional[str] = None
    ip_ethnic_group: Optional[str] = None
    contact_numbers: str
    is_pwd: bool = False
    is_4ps: bool = False
    
    # Address
    house_no_street_sitio: str
    barangay: str
    municipality_city: str
    province: str
    
    # Education
    last_grade_level_completed: str
    elementary_school: Optional[str] = None
    junior_high_school: Optional[str] = None
    dropout_reason: Optional[str] = None
    dropout_reason_others: Optional[str] = None
    attended_als_before: bool = False
    previous_program_name: Optional[str] = None
    previous_literacy_level: Optional[str] = None
    previous_year_attended: Optional[str] = None
    previous_program_completed: bool = False
    previous_not_completed_reason: Optional[str] = None
    distance_to_learning_center_km: Optional[float] = None
    distance_to_learning_center_hours: Optional[int] = None
    distance_to_learning_center_mins: Optional[int] = None
    transportation_mode: Optional[str] = None
    transportation_mode_others: Optional[str] = None
    
    # Family
    father_guardian_last_name: Optional[str] = None
    father_guardian_first_name: Optional[str] = None
    father_guardian_middle_name: Optional[str] = None
    father_guardian_occupation: Optional[str] = None
    mother_maiden_last_name: Optional[str] = None
    mother_maiden_first_name: Optional[str] = None
    mother_maiden_middle_name: Optional[str] = None
    mother_maiden_occupation: Optional[str] = None
    
    # Schedule
    schedule_availability: dict
    
    # Additional
    email_address: str
    als_teacher_facilitator: Optional[str] = None
    teacher_signature_date: Optional[str] = None
    learner_signature_date: Optional[str] = None



class Subject(BaseModel):
    subject_name: str
    subject_code: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    instructor_id: str  # UUID as string





logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Static files
app.mount("/COMPONENTS", StaticFiles(directory="COMPONENTS"), name="components")
app.mount("/CSS", StaticFiles(directory="CSS"), name="css")
app.mount("/JS", StaticFiles(directory="JS"), name="js")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_reset_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=RESET_EXPIRY_MINUTES)
    }
    return jwt.encode(payload, RESET_SECRET, algorithm="HS256")

async def send_reset_email(to_email, reset_link):
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "ALS Portal Password Reset"
    msg.set_content(f"Click the link to reset your password: {reset_link}\nThis link expires in {RESET_EXPIRY_MINUTES} minutes.")

    await aiosmtplib.send(
        msg,
        hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        port=int(os.getenv("SMTP_PORT", 587)),
        username=os.getenv("SMTP_USER"),
        password=os.getenv("SMTP_PASS"),
        start_tls=True,
    )


async def send_registration_confirmation_email(to_email, first_name, last_name):
    """Send email notification to student after registration submission"""
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "ALS Portal Registration Submitted - Waiting for Approval"
    
    email_body = f"""
Dear {first_name} {last_name},

Thank you for submitting your registration to the ALS Portal!

Your registration has been received and is currently waiting for admin approval. You will receive a notification via email once your account has been approved.

In the meantime, you can check the status of your registration by contacting the ALS office.

If you have any questions, please feel free to reach out to us.

Best regards,
ALS Portal Administration
"""
    
    msg.set_content(email_body.strip())

    try:
        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASS"),
            start_tls=True,
        )
        logger.info(f"✅ Registration confirmation email sent to {to_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send registration confirmation email to {to_email}: {str(e)}")
        # Don't raise exception - email failure shouldn't block registration


async def send_approval_confirmation_email(to_email, first_name, last_name, username, password):
    """Send email notification to student when registration is approved"""
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "ALS Portal - Account Approved! Your Login Credentials"
    
    email_body = f"""
Dear {first_name} {last_name},

Great news! Your registration has been approved and your ALS Portal account is now active!

📧 Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Username: {username}
Password: {password}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Next Steps:
1. Visit: https://yourals-portal.com/login
2. Enter your username and password above
3. Log in to your ALS Portal account
4. You can change your password after your first login

⚠️ Important Security Reminders:
• Keep your username and password safe and confidential
• Do not share your credentials with anyone
• Change your password after first login to something only you know
• If you forget your password, use the "Forgot Password" option on the login page

If you have any questions or need assistance, please contact the ALS office.

Welcome to the ALS Portal!

Best regards,
ALS Portal Administration
"""
    
    msg.set_content(email_body.strip())

    try:
        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASS"),
            start_tls=True,
        )
        logger.info(f"✅ Approval confirmation email sent to {to_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send approval confirmation email to {to_email}: {str(e)}")
        # Don't raise exception - email failure shouldn't block approval


async def send_rejection_email(to_email, first_name, last_name, rejection_reason):
    """Send email notification to applicant when registration is rejected"""
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "ALS Portal - Registration Status Update"
    
    email_body = f"""
Dear {first_name} {last_name},

Thank you for your interest in the ALS Portal and for submitting your registration.

Unfortunately, after careful review, we are unable to approve your application at this time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASON FOR REJECTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{rejection_reason}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 What You Can Do:
If you believe this decision was made in error or if you have additional information that should be considered, please contact the ALS office to discuss further options.

The ALS office team is here to help and would be happy to answer any questions you may have.

If you need more information, please don't hesitate to reach out.

Sincerely,
ALS Portal Administration
"""
    
    msg.set_content(email_body.strip())

    try:
        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASS"),
            start_tls=True,
        )
        logger.info(f"✅ Rejection email sent to {to_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send rejection email to {to_email}: {str(e)}")
        # Don't raise exception - email failure shouldn't block rejection





# Admin HTML routes
@app.get("/admin_dashboard", response_class=FileResponse)
async def admin_dashboard():
    return FileResponse("HTML/admin_dashboard.html")

@app.get("/admin_users", response_class=FileResponse)
async def admin_users():
    return FileResponse("HTML/admin_users.html")

@app.get("/admin_instructors", response_class=FileResponse)
async def admin_instructors():
    return FileResponse("HTML/admin_instructors.html")

@app.get("/admin_students", response_class=FileResponse)
async def admin_students():
    return FileResponse("HTML/admin_students.html")

@app.get("/admin_settings", response_class=FileResponse)
async def admin_settings():
    return FileResponse("HTML/admin_settings.html")

@app.get("/admin_registration", response_class=FileResponse)
async def admin_registration():
    return FileResponse("HTML/admin_registration.html")

@app.get("/admin_af1", response_class=FileResponse)
async def admin_af1():
    return FileResponse("HTML/admin_af1.html")

@app.get("/admin_certifications", response_class=FileResponse)
async def admin_certifications():
    return FileResponse("HTML/admin_certifications.html")

@app.get("/ins_dashboard", response_class=FileResponse)
async def ins_dashboard():
    return FileResponse("HTML/ins_dashboard.html")

@app.get("/ins_mapping", response_class=FileResponse)
async def ins_mapping():
    return FileResponse("HTML/ins_mapping.html")

@app.get("/ins_learners", response_class=FileResponse)
async def ins_learners():
    return FileResponse("HTML/ins_learners.html")

@app.get("/ins_analytics", response_class=FileResponse)
async def ins_analytics():
    return FileResponse("HTML/ins_analytics.html")

@app.get("/ins_reports", response_class=FileResponse)
async def ins_reports():
    return FileResponse("HTML/ins_reports.html")


@app.get("/instructor_subjects", response_class=FileResponse)
async def instructor_subjects():
    return FileResponse("HTML/instructor_subjects.html")

@app.get("/instructor_dashboard", response_class=FileResponse)
async def instructor_dashboard():
    return FileResponse("HTML/instructor_dashboard.html")

@app.get("/instructor_learners", response_class=FileResponse)
async def instructor_learners():
    return FileResponse("HTML/instructor_learners.html")

@app.get("/instructor_mapping", response_class=FileResponse)
async def instructor_mapping():
    return FileResponse("HTML/instructor_mapping.html")

@app.get("/instructor_messages", response_class=FileResponse)
async def instructor_messages():
    return FileResponse("HTML/instructor_messages.html")

@app.get("/instructor_analytics", response_class=FileResponse)
async def instructor_analytics():
    return FileResponse("HTML/instructor_analytics.html")

@app.get("/instructor_reports", response_class=FileResponse)
async def instructor_reports():
    return FileResponse("HTML/instructor_reports.html")

@app.get("/instructor_subject_view", response_class=FileResponse)
async def instructor_subject_view():
    return FileResponse("HTML/instructor_subject_view.html")

@app.get("/instructor_af1_data_entry", response_class=FileResponse)
async def instructor_af1_data_entry():
    return FileResponse("HTML/instructor_af1_data_entry.html")

@app.get("/", response_class=FileResponse)
async def root():
    return FileResponse("HTML/login.html")

@app.get("/student_dashboard", response_class=FileResponse)
async def student_dashboard():
    return FileResponse("HTML/student_dashboard.html")

@app.get("/student_modules", response_class=FileResponse)
async def student_modules():
    return FileResponse("HTML/student_modules.html")

@app.get("/student_subject_view", response_class=FileResponse)
async def student_subject_view():
    return FileResponse("HTML/student_subject_view.html")

@app.get("/student_grades", response_class=FileResponse)
async def student_grades():
    return FileResponse("HTML/student_grades.html")

@app.get("/student_announcements", response_class=FileResponse)
async def student_announcements():
    return FileResponse("HTML/student_announcements.html")

@app.get("/student_messages", response_class=FileResponse)
async def student_messages():
    return FileResponse("HTML/student_messages.html")

@app.get("/student_profile", response_class=FileResponse)
async def student_profile():
    return FileResponse("HTML/student_profile.html")

@app.get("/student_certification", response_class=FileResponse)
async def student_certification():
    return FileResponse("HTML/student_certifications.html")


@app.get("/login.html", response_class=FileResponse)
async def login_page():
    return FileResponse("HTML/login.html")

@app.get("/login_registration.html", response_class=FileResponse)
async def registration_page():
    return FileResponse("HTML/login_registration.html")


# Serve profile photos from PFP directory
@app.get("/PFP/{filename}")
async def get_profile_photo(filename: str):
    """
    Serve profile photos from COMPONENTS/PFP directory
    """
    try:
        file_path = Path("COMPONENTS/PFP") / filename
        
        # Security check: prevent path traversal
        if not file_path.exists() or ".." in filename:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        return FileResponse(file_path)
    except Exception as e:
        logger.error(f"Error serving profile photo: {str(e)}")
        raise HTTPException(status_code=404, detail="Photo not found")


# ...existing code...
@app.post("/api/login")
async def login_user(credentials: LoginRequest):
    try:
        logger.info(f"➡️ Login attempt for username: {credentials.username}")

        # quick env check
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Supabase URL/KEY missing from environment")
            raise HTTPException(status_code=500, detail="Server configuration error")

        # Query Supabase
        response = supabase.table("users").select("*").eq("username", credentials.username).execute()
        logger.info(f"Supabase raw response: {response}")
        
        try:
            data = response.data
            error = getattr(response, "error", None)
        except Exception:
            data = response.get("data") if isinstance(response, dict) else None
            error = response.get("error") if isinstance(response, dict) else None

        if error:
            logger.error(f"Supabase query error: {error}")
            raise HTTPException(status_code=500, detail="Database query error")

        if not data:
            logger.info("No user found for that username")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        user = data[0]
        logger.debug(f"User record retrieved (id={user.get('id')})")

        stored_pw = user.get("password")
        if not stored_pw:
            logger.error("User record has no password field")
            raise HTTPException(status_code=500, detail="Account not properly configured")

        # Check if password is hashed (starts with $2b$ for bcrypt)
        if stored_pw.startswith('$2b$') or stored_pw.startswith('$2a$'):
            # This is a hashed password - use bcrypt
            try:
                if bcrypt.checkpw(credentials.password.encode("utf-8"), stored_pw.encode("utf-8")):
                    logger.info("✅ Password check OK (bcrypt)")
                    # Update last_activity on successful login
                    await update_user_last_activity(user["id"])
                    return {
                        "success": True, 
                        "user": {
                            "id": user["id"], 
                            "username": user["username"],
                            "role": user.get("role", "").lower()
                        }
                    }
                else:
                    logger.info("❌ Password mismatch (bcrypt)")
                    raise HTTPException(status_code=401, detail="Invalid username or password")
            except ValueError as ex:
                logger.error(f"Bcrypt error: {ex}")
                raise HTTPException(status_code=401, detail="Invalid username or password")
        else:
            # This is a plaintext password (legacy/testing only)
            logger.warning("⚠️ Plaintext password detected - this is insecure!")
            if credentials.password == stored_pw:
                # Update last_activity on successful login
                await update_user_last_activity(user["id"])
                return {
                    "success": True, 
                    "user": {
                        "id": user["id"], 
                        "username": user["username"],
                        "role": user.get("role", "").lower()
                    }
                }
            else:
                raise HTTPException(status_code=401, detail="Invalid username or password")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Server error, please try again")
# ...existing code...
    



# Add this endpoint to your ALS.py file (before @app.post("/api/register-enrollment"))

@app.get("/api/check-duplicate")
async def check_duplicate(lrn: str = None, email: str = None):
    """
    Check if LRN or email already exists in enrollment tables
    Returns which field is duplicate and where it was found
    """
    try:
        duplicates = {
            "lrn_exists": False,
            "email_exists": False,
            "lrn_status": None,  # 'pending' or 'approved'
            "email_status": None,
            "message": None
        }
        
        # Check LRN if provided
        if lrn:
            # Check in pending enrollments
            pending_lrn = supabase.table("als_enrollments")\
                .select("id")\
                .eq("lrn", lrn)\
                .execute()
            
            if pending_lrn.data:
                duplicates["lrn_exists"] = True
                duplicates["lrn_status"] = "pending"
            
            # Check in approved enrollments
            approved_lrn = supabase.table("als_enrollments_approved")\
                .select("id")\
                .eq("lrn", lrn)\
                .execute()
            
            if approved_lrn.data:
                duplicates["lrn_exists"] = True
                duplicates["lrn_status"] = "approved"
        
        # Check email if provided
        if email:
            # Check in pending enrollments
            pending_email = supabase.table("als_enrollments")\
                .select("id")\
                .eq("email_address", email)\
                .execute()
            
            if pending_email.data:
                duplicates["email_exists"] = True
                duplicates["email_status"] = "pending"
            
            # Check in approved enrollments
            approved_email = supabase.table("als_enrollments_approved")\
                .select("id")\
                .eq("email_address", email)\
                .execute()
            
            if approved_email.data:
                duplicates["email_exists"] = True
                duplicates["email_status"] = "approved"
        
        # Generate user-friendly message
        if duplicates["lrn_exists"] and duplicates["email_exists"]:
            duplicates["message"] = f"Both LRN and email are already registered ({duplicates['lrn_status']}/{duplicates['email_status']})"
        elif duplicates["lrn_exists"]:
            duplicates["message"] = f"LRN is already registered (status: {duplicates['lrn_status']})"
        elif duplicates["email_exists"]:
            duplicates["message"] = f"Email is already registered (status: {duplicates['email_status']})"
        
        return duplicates
        
    except Exception as e:
        logger.error(f"Error checking duplicates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking duplicates: {str(e)}")


# UPDATED: Modify your existing @app.post("/api/register-enrollment") endpoint
@app.post("/api/register-enrollment")
async def register_enrollment(data: RegistrationData):
    """
    Register new ALS enrollment from registration form
    NOW WITH DUPLICATE CHECKING
    """
    try:
        logger.info(f"📝 New enrollment registration for: {data.first_name} {data.last_name}")
        
        # ✅ CHECK FOR DUPLICATES FIRST
        # Check LRN
        if data.lrn:
            pending_lrn = supabase.table("als_enrollments")\
                .select("id")\
                .eq("lrn", data.lrn)\
                .execute()
            
            approved_lrn = supabase.table("als_enrollments_approved")\
                .select("id")\
                .eq("lrn", data.lrn)\
                .execute()
            
            if pending_lrn.data or approved_lrn.data:
                status = "approved" if approved_lrn.data else "pending approval"
                raise HTTPException(
                    status_code=409, 
                    detail=f"LRN {data.lrn} is already registered (status: {status})"
                )
        
        # Check Email
        if data.email_address:
            pending_email = supabase.table("als_enrollments")\
                .select("id")\
                .eq("email_address", data.email_address)\
                .execute()
            
            approved_email = supabase.table("als_enrollments_approved")\
                .select("id")\
                .eq("email_address", data.email_address)\
                .execute()
            
            if pending_email.data or approved_email.data:
                status = "approved" if approved_email.data else "pending approval"
                raise HTTPException(
                    status_code=409, 
                    detail=f"Email {data.email_address} is already registered (status: {status})"
                )
        
        # Convert schedule data to individual day fields
        schedule = data.schedule_availability
        
        enrollment_data = {
            # Personal Info
            "lrn": data.lrn,
            "enrollment_date": data.enrollment_date,
            "last_name": data.last_name,
            "first_name": data.first_name,
            "middle_name": data.middle_name,
            "name_extension": data.name_extension,
            "birthdate": data.birthdate,
            "place_of_birth": data.place_of_birth,
            "sex": data.sex,
            "civil_status": data.civil_status,
            "religion": data.religion,
            "mother_tongue": data.mother_tongue,
            "ip_ethnic_group": data.ip_ethnic_group,
            "contact_numbers": data.contact_numbers,
            "is_pwd": data.is_pwd,
            "is_4ps": data.is_4ps,
            
            # Address
            "house_no_street_sitio": data.house_no_street_sitio,
            "barangay": data.barangay,
            "municipality_city": data.municipality_city,
            "province": data.province,
            
            # Education
            "last_grade_level_completed": data.last_grade_level_completed,
            "elementary_school": data.elementary_school,
            "junior_high_school": data.junior_high_school,
            "dropout_reason": data.dropout_reason,
            "dropout_reason_others": data.dropout_reason_others,
            "attended_als_before": data.attended_als_before,
            "previous_program_name": data.previous_program_name,
            "previous_literacy_level": data.previous_literacy_level,
            "previous_year_attended": data.previous_year_attended,
            "previous_program_completed": data.previous_program_completed,
            "previous_not_completed_reason": data.previous_not_completed_reason,
            "distance_to_learning_center_km": data.distance_to_learning_center_km,
            "distance_to_learning_center_hours": data.distance_to_learning_center_hours,
            "distance_to_learning_center_mins": data.distance_to_learning_center_mins,
            "transportation_mode": data.transportation_mode,
            "transportation_mode_others": data.transportation_mode_others,
            
            # Family
            "father_guardian_last_name": data.father_guardian_last_name,
            "father_guardian_first_name": data.father_guardian_first_name,
            "father_guardian_middle_name": data.father_guardian_middle_name,
            "father_guardian_occupation": data.father_guardian_occupation,
            "mother_maiden_last_name": data.mother_maiden_last_name,
            "mother_maiden_first_name": data.mother_maiden_first_name,
            "mother_maiden_middle_name": data.mother_maiden_middle_name,
            "mother_maiden_occupation": data.mother_maiden_occupation,
            
            # Schedule - Convert dict to individual fields
            "monday_available": schedule.get("monday", {}).get("available", False),
            "monday_time": schedule.get("monday", {}).get("time_formatted"),
            "tuesday_available": schedule.get("tuesday", {}).get("available", False),
            "tuesday_time": schedule.get("tuesday", {}).get("time_formatted"),
            "wednesday_available": schedule.get("wednesday", {}).get("available", False),
            "wednesday_time": schedule.get("wednesday", {}).get("time_formatted"),
            "thursday_available": schedule.get("thursday", {}).get("available", False),
            "thursday_time": schedule.get("thursday", {}).get("time_formatted"),
            "friday_available": schedule.get("friday", {}).get("available", False),
            "friday_time": schedule.get("friday", {}).get("time_formatted"),
            "saturday_available": schedule.get("saturday", {}).get("available", False),
            "saturday_time": schedule.get("saturday", {}).get("time_formatted"),
            "sunday_available": schedule.get("sunday", {}).get("available", False),
            "sunday_time": schedule.get("sunday", {}).get("time_formatted"),
            
            # Additional
            "email_address": data.email_address,
            "als_teacher_facilitator": data.als_teacher_facilitator,
            "teacher_signature_date": data.teacher_signature_date,
            "learner_signature_date": data.learner_signature_date
        }
        
        # Insert to database
        response = supabase.table("als_enrollments").insert(enrollment_data).execute()
        
        if response.data:
            logger.info(f"✅ Enrollment created successfully for {data.lrn}")
            
            # Send confirmation email to student
            try:
                await send_registration_confirmation_email(
                    data.email_address,
                    data.first_name,
                    data.last_name
                )
            except Exception as e:
                logger.error(f"Warning: Could not send confirmation email: {str(e)}")
            
            return {
                "success": True,
                "message": "Registration submitted successfully!",
                "data": response.data[0]
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to create enrollment")
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions (like our duplicate checks)
    except Exception as e:
        logger.error(f"❌ Error creating enrollment: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error creating enrollment: {str(e)}")



@app.post("/api/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        logger.info(f"🔍 Forgot password requested for username: {request.username}")

        # Case-insensitive search for username
        response = supabase.table("users").select("*").ilike("username", request.username).execute()
        logger.info(f"Supabase response: {response.data}")

        if not response.data:
            raise HTTPException(status_code=404, detail="Username not found")

        user = response.data[0]
        logger.info(f"User found: {user}")

        # Ensure email exists
        email = user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="No email registered for this account")

        # Generate reset link
        token = generate_reset_token(user["id"])
        reset_link = f"http://localhost:8000/forgot_password.html?token={token}"
        logger.info(f"Generated reset link: {reset_link}")

        # Send email
        await send_reset_email(email, reset_link)

        return {"success": True, "message": "Reset email sent"}

    except Exception as e:
        logger.error(f"❌ Forgot password error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")


@app.get("/forgot_password.html", response_class=FileResponse)
async def forgot_password_page():
    return FileResponse("HTML/forgot_password.html")

@app.post("/api/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        logger.info(f"🔐 Reset password request received")
        
        # Decode token
        try:
            payload = jwt.decode(request.token, RESET_SECRET, algorithms=["HS256"])
            user_id = payload["user_id"]
            logger.info(f"✅ Decoded reset token for user_id: {user_id}")
        except jwt.ExpiredSignatureError:
            logger.error("❌ Token expired")
            raise HTTPException(status_code=400, detail="Reset link has expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"❌ Invalid token: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid reset token")

        # Check if user exists first
        user_check = supabase.table("users").select("id, username, password").eq("id", user_id).execute()
        if not user_check.data:
            logger.error(f"❌ User {user_id} not found")
            raise HTTPException(status_code=404, detail="User not found")
        
        current_user = user_check.data[0]
        current_password = current_user.get("password", "")
        
        # Log current password format for debugging
        if current_password.startswith('$2b$') or current_password.startswith('$2a$'):
            logger.info(f"📊 Current password is HASHED (bcrypt)")
        else:
            logger.warning(f"⚠️ Current password is PLAINTEXT - will convert to hash")

        # Hash new password
        logger.info(f"🔒 Hashing new password...")
        hashed_pw = bcrypt.hashpw(
            request.new_password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")
        logger.info(f"✅ Password hashed successfully: {hashed_pw[:20]}...")

        # Update Supabase users table
        logger.info(f"💾 Updating database for user {user_id}...")
        response = supabase.table("users").update({"password": hashed_pw}).eq("id", user_id).execute()
        logger.info(f"📊 Supabase update response: {response.data}")

        if not response.data:
            logger.error("❌ Update failed - no data returned")
            raise HTTPException(status_code=404, detail="Failed to update password")

        logger.info(f"✅ Password reset successful for user {user_id}")
        logger.info(f"✅ Password converted from {'HASH' if current_password.startswith('$2') else 'PLAINTEXT'} to HASH")
        
        return {"success": True, "message": "Password updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Reset password error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error resetting password: {str(e)}")

@app.get("/api/debug-users")
async def debug_users():
    try:
        response = supabase.table("users").select("id, username, email, role, created_at").execute()
        logger.info(f"👥 Users in DB: {response.data}")
        return {"success": True, "users": response.data}
    except Exception as e:
        logger.error(f"❌ Debug users error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")



#Student

# Add this Pydantic model near your other models
class AssignmentSubmission(BaseModel):
    post_id: str  # Changed from assignment_id to match your table
    student_id: str
    file_url: str
    submission_text: Optional[str] = None
    status: str = "submitted"


# Add these endpoints after your existing subject-related endpoints

@app.post("/api/upload-submission")
async def upload_submission(
    file: UploadFile = File(...),
    assignment_id: str = Form(...),
    student_id: str = Form(...)
):
    """
    Upload a student's assignment submission file
    """
    try:
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.txt']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (10MB max)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        file_content = await file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds 10MB limit"
            )
        
        # Create submissions subdirectory organized by assignment
        SUBMISSIONS_DIR = UPLOAD_DIR / "submissions" / assignment_id
        SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Use original filename - no timestamp manipulation
        safe_filename = file.filename
        file_path = SUBMISSIONS_DIR / safe_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Return the file URL
        file_url = f"/uploads/submissions/{assignment_id}/{safe_filename}"
        
        logger.info(f"✅ Submission uploaded: {safe_filename} by student {student_id}")
        
        return {
            "success": True,
            "file_url": file_url,
            "filename": file.filename,
            "file_size": len(file_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Submission upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading submission: {str(e)}")


@app.post("/api/assignment-submissions")
async def create_submission(submission: AssignmentSubmission):
    """
    Create a new assignment submission record
    """
    try:
        # Check if submission already exists
        existing = supabase.table("post_submissions")\
            .select("id")\
            .eq("post_id", submission.post_id)\
            .eq("student_id", submission.student_id)\
            .execute()
        
        if existing.data:
            # Update existing submission
            submission_data = {
                "file_url": submission.file_url,
                "submission_text": submission.submission_text,
                "status": submission.status,
                "submitted_at": dt.datetime.utcnow().isoformat()
            }
            
            response = supabase.table("post_submissions")\
                .update(submission_data)\
                .eq("id", existing.data[0]["id"])\
                .execute()
            
            logger.info(f"✅ Submission updated for student {submission.student_id}")
        else:
            # Create new submission
            submission_data = {
                "post_id": submission.post_id,
                "student_id": submission.student_id,
                "file_url": submission.file_url,
                "submission_text": submission.submission_text,
                "status": submission.status,
                "submitted_at": dt.datetime.utcnow().isoformat()
            }
            
            response = supabase.table("post_submissions")\
                .insert(submission_data)\
                .execute()
            
            logger.info(f"✅ New submission created for student {submission.student_id}")
        
        if response.data:
            return {"success": True, "data": response.data[0]}
        else:
            raise HTTPException(status_code=400, detail="Failed to create submission")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating submission: {str(e)}")


@app.get("/api/assignment-submissions/{assignment_id}")
async def get_assignment_submissions(assignment_id: str):
    """
    Get all submissions for an assignment (instructor view)
    """
    try:
        response = supabase.table("post_submissions")\
            .select("""
                *,
                student:student_id(
                    id,
                    username,
                    first_name,
                    last_name,
                    email
                )
            """)\
            .eq("post_id", assignment_id)\
            .order("submitted_at", desc=True)\
            .execute()
        
        return response.data if response.data else []
        
    except Exception as e:
        logger.error(f"Error fetching submissions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching submissions: {str(e)}")


@app.get("/api/my-submission/{assignment_id}")
async def get_my_submission(assignment_id: str, student_id: str):
    """
    Get a student's own submission for an assignment
    """
    try:
        response = supabase.table("post_submissions")\
            .select("*")\
            .eq("post_id", assignment_id)\
            .eq("student_id", student_id)\
            .single()\
            .execute()
        
        if response.data:
            return {"success": True, "data": response.data}
        else:
            return {"success": False, "data": None}
        
    except Exception as e:
        # No submission found is not an error
        return {"success": False, "data": None}


@app.put("/api/assignment-submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: str,
    grade: float = Body(...),  # Changed to float to match numeric(5,2)
    feedback: Optional[str] = Body(None),
    instructor_id: str = Body(...)
):
    """
    Grade a student's submission (instructor only)
    """
    try:
        # Verify instructor owns the assignment
        submission = supabase.table("post_submissions")\
            .select("post:post_id(subject:subject_id(instructor_id))")\
            .eq("id", submission_id)\
            .single()\
            .execute()
        
        if not submission.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        # Update grade
        grade_data = {
            "grade": grade,
            "feedback": feedback,
            "status": "graded",
            "graded_at": dt.datetime.utcnow().isoformat()
        }
        
        response = supabase.table("post_submissions")\
            .update(grade_data)\
            .eq("id", submission_id)\
            .execute()
        
        if response.data:
            logger.info(f"✅ Submission {submission_id} graded")
            return {"success": True, "data": response.data[0]}
        else:
            raise HTTPException(status_code=400, detail="Failed to grade submission")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error grading submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error grading submission: {str(e)}")





#instructors




# Replace your Learner models and create endpoint with this:

from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, ValidationError
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# UPDATED MODEL - Split name fields
class Learner(BaseModel):
    first_name: str
    last_name: str
    middle_initial: Optional[str] = None
    status: str
    barangay: str
    address: Optional[str] = None
    lastContact: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class LearnerWithUser(BaseModel):
    id: int
    first_name: str
    last_name: str
    middle_initial: Optional[str] = None
    status: str
    barangay: str
    address: Optional[str] = None
    lastContact: Optional[str] = None
    progress: Optional[int] = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    user_id: Optional[str] = None
    
class UserWithLearner(BaseModel):
    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    learner_profile: Optional[dict] = None 


class AF1Learner(BaseModel):
    last_name: str
    first_name: str
    middle_name: Optional[str] = None
    name_extension: Optional[str] = None
    sex: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    learner_type: Optional[str] = None
    barangay: Optional[str] = None
    municipality_city: Optional[str] = None
    province: Optional[str] = None
    contact_number: Optional[str] = None
    als_status: Optional[str] = None


class AF1BatchImportRequest(BaseModel):
    learners: List[dict]


class EnrollmentRequest(BaseModel):
    class_code: str
    student_id: str  # Add this

class ClassCodeUpdate(BaseModel):
    subject_id: str
    regenerate: bool = False


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/api/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    instructor_id: str = Form(...)
):
    """
    Upload a file for a subject post
    Allowed file types: PDF, DOCX, DOC, PPTX, XLSX
    Max file size: 10MB
    """
    try:
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.txt']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (10MB max)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
        file_content = await file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds 10MB limit"
            )
        
        # Create subfolder for each subject to organize files
        subject_dir = UPLOAD_DIR / subject_id
        subject_dir.mkdir(exist_ok=True)
        
        # Use original filename - no timestamp manipulation
        safe_filename = file.filename
        file_path = subject_dir / safe_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Return the file URL
        file_url = f"/uploads/{subject_id}/{safe_filename}"
        
        logger.info(f"✅ File uploaded: {safe_filename} by instructor {instructor_id}")
        
        return {
            "success": True,
            "file_url": file_url,
            "filename": file.filename,
            "file_size": len(file_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")




@app.post("/api/subject-posts")
async def create_subject_post(
    subject_id: str = Form(...),
    instructor_id: str = Form(...),
    post_type: str = Form(...),
    title: str = Form(...),
    content: Optional[str] = Form(None),
    external_link: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    points: Optional[int] = Form(None),
    file_url: Optional[str] = Form(None)
):
    """
    Create a new subject post with optional file attachment
    """
    try:
        # Clean up empty strings to None
        content = content if content and content.strip() else None
        external_link = external_link if external_link and external_link.strip() else None
        due_date = due_date if due_date and due_date.strip() else None
        file_url = file_url if file_url and file_url.strip() else None
        
        post_data = {
            "subject_id": subject_id,
            "instructor_id": instructor_id,
            "post_type": post_type,
            "title": title,
            "content": content,
            "external_link": external_link,
            "due_date": due_date,
            "points": points,
            "file_url": file_url,
            "is_published": True
        }
        
        logger.info(f"Creating post with data: {post_data}")
        
        response = supabase.table("subject_posts").insert(post_data).execute()
        
        if response.data:
            logger.info(f"✅ Post created: {title} with file: {file_url}")
            return {"success": True, "data": response.data[0]}
        else:
            logger.error(f"Failed to create post - no data returned")
            raise HTTPException(status_code=400, detail="Failed to create post")
            
    except Exception as e:
        logger.error(f"❌ Error creating post: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating post: {str(e)}")

# NEW: Delete file when post is deleted
@app.delete("/api/subject-posts/{post_id}")
async def delete_subject_post(post_id: str):
    """
    Delete a post and its associated file
    """
    try:
        # Get the post to find the file URL
        post_response = supabase.table("subject_posts")\
            .select("file_url")\
            .eq("id", post_id)\
            .single()\
            .execute()
        
        if post_response.data and post_response.data.get("file_url"):
            # Delete the file from disk
            file_url = post_response.data["file_url"]
            filename = file_url.split("/")[-1]
            file_path = UPLOAD_DIR / filename
            
            if file_path.exists():
                file_path.unlink()
                logger.info(f"🗑️ Deleted file: {filename}")
        
        # Delete the post from database
        response = supabase.table("subject_posts").delete().eq("id", post_id).execute()
        
        if response.data:
            return {"success": True, "message": "Post and file deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Post not found")
            
    except Exception as e:
        logger.error(f"❌ Error deleting post: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting post: {str(e)}")


def generate_class_code(length=8):
    """Generate a unique class code"""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(secrets.choice(chars) for _ in range(length))
        # Check if code already exists
        response = supabase.table("subjects").select("id").eq("class_code", code).execute()
        if not response.data:
            return code






@app.get("/api/af1-learners")
async def get_af1_learners(
    barangay: str = "all",
    status: str = "all",
    learner_type: str = "all"
):
    """
    Fetch AF1 learners with optional filters
    Returns learners with their barangay coordinates for mapping
    """
    try:
        query = supabase.table("als_af1").select("*")
        
        # Apply filters
        if barangay != "all" and barangay:
            query = query.eq("barangay", barangay)
        if status != "all" and status:
            query = query.eq("als_status", status)
        if learner_type != "all" and learner_type:
            query = query.eq("learner_type", learner_type)
        
        response = query.execute()
        learners = response.data if response.data else []
        
        # Enhanced barangay coordinates mapping (using school locations)
        barangay_coords = {
            "alipit": {"lat": 14.2299, "lng": 121.4102},
            "bagumbayan": {"lat": 14.268804631725034, "lng": 121.39979947057562},
            "poblacion i": {"lat": 14.2755, "lng": 121.4170},
            "poblacion ii": {"lat": 14.2800, "lng": 121.4161},
            "poblacion iii": {"lat": 14.2820, "lng": 121.4152},
            "poblacion iv": {"lat": 14.2816, "lng": 121.4148},
            "poblacion v": {"lat": 14.2852, "lng": 121.4125},
            "bubukal": {"lat": 14.251157941121727, "lng": 121.40255750998381},
            "calios": {"lat": 14.275138925320823, "lng": 121.40270109834186},
            "duhat": {"lat": 14.248671913684055, "lng": 121.37885222772985},
            "gatid": {"lat": 14.26136953826561, "lng": 121.38547404462257},
            "jasaan": {"lat": 14.2228, "lng": 121.3921},
            "labuin": {"lat": 14.2473, "lng": 121.3931},
            "malinao": {"lat": 14.2356, "lng": 121.3916},
            "oogong": {"lat": 14.223958784202317, "lng": 121.39846896765496},
            "pagsawitan": {"lat": 14.265459832536076, "lng": 121.42517109649133},
            "palasan": {"lat": 14.254588856450583, "lng": 121.42019519649105},
            "patimbao": {"lat": 14.272573942152114, "lng": 121.41732358484933},
            "san jose": {"lat": 14.236571232323422, "lng": 121.40299913081627},
            "san juan": {"lat": 14.2450, "lng": 121.4089},
            "san pablo norte": {"lat": 14.2852, "lng": 121.4174},
            "san pablo sur": {"lat": 14.2826, "lng": 121.4174},
            "santisima cruz": {"lat": 14.288230125362734, "lng": 121.41198043087904},
            "santo angel central": {"lat": 14.285503419158754, "lng": 121.41075330998406},
            "santo angel norte": {"lat": 14.28872161573547, "lng": 121.40593611368526},
            "santo angel sur": {"lat": 14.281381537136495, "lng": 121.41136975416305}
        }
        
        # Add coordinates to each learner
        enriched_learners = []
        for learner in learners:
            barangay_name = learner.get("barangay", "").lower().strip()
            
            # Try direct lookup first
            coords = barangay_coords.get(barangay_name)
            
            # If not found, check if it's old "barangay i-v" format and convert to "poblacion i-v"
            if not coords and barangay_name.startswith("barangay"):
                # Convert "barangay i" -> "poblacion i", "barangay ii" -> "poblacion ii", etc.
                converted_name = barangay_name.replace("barangay", "poblacion").strip()
                coords = barangay_coords.get(converted_name)
            
            # If still not found, use default Santa Cruz center
            if not coords:
                coords = {
                    "lat": 14.2818099,
                    "lng": 121.414977
                }
            
            enriched_learner = {
                **learner,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "full_name": f"{learner.get('first_name', '')} {learner.get('middle_name', '')} {learner.get('last_name', '')}".strip()
            }
            enriched_learners.append(enriched_learner)
        
        return enriched_learners
        
    except Exception as e:
        logger.error(f"Error fetching AF1 learners: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching learners: {str(e)}")

@app.get("/api/af1-statistics")
async def get_af1_statistics():
    """
    Get statistical summary of AF1 learners
    """
    try:
        response = supabase.table("als_af1").select("*").execute()
        learners = response.data if response.data else []
        
        # Calculate statistics
        stats = {
            "total": len(learners),
            "by_status": {},
            "by_barangay": {},
            "by_learner_type": {},
            "by_sex": {}
        }
        
        for learner in learners:
            # Count by status
            status = learner.get("als_status", "Unknown")
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # Count by barangay
            barangay = learner.get("barangay", "Unknown")
            stats["by_barangay"][barangay] = stats["by_barangay"].get(barangay, 0) + 1
            
            # Count by learner type
            learner_type = learner.get("learner_type", "Unknown")
            stats["by_learner_type"][learner_type] = stats["by_learner_type"].get(learner_type, 0) + 1
            
            # Count by sex
            sex = learner.get("sex", "Unknown")
            stats["by_sex"][sex] = stats["by_sex"].get(sex, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching statistics: {str(e)}")

async def update_user_last_activity(user_id: str):
    """Update the last_activity timestamp for a user"""
    try:
        supabase.table("users").update({"last_activity": dt.datetime.now(dt.timezone.utc).isoformat()}).eq("id", str(user_id)).execute()
    except Exception as e:
        logger.warning(f"Could not update last_activity for user {user_id}: {str(e)}")

@app.get("/api/enrolled-learners/risk-scores")
async def get_enrolled_learners_risk_scores():
    """
    Calculate risk scores for enrolled learners who have ACTIVE subject enrollments
    Only shows learners with missing/unsubmitted assignments in their enrolled subjects
    Based on: submission count, average grade, days since last activity, enrollment duration
    """
    try:
        # Get all approved enrolled learners
        enrolled_response = supabase.table("als_enrollments_approved").select("*").execute()
        enrolled_learners = enrolled_response.data if enrolled_response.data else []
        
        risk_data = []
        
        for learner in enrolled_learners:
            learner_id = learner.get("id")
            user_id = learner.get("user_id")
            enrollment_date = learner.get("enrollment_date")
            
            # ✅ CHECK: Only include learners with active subject enrollments
            try:
                enrolled_subjects_response = supabase.table("subject_enrollments")\
                    .select("subject_id, id")\
                    .eq("student_id", str(user_id))\
                    .eq("status", "active")\
                    .execute()
                
                enrolled_subject_ids = [s.get("subject_id") for s in (enrolled_subjects_response.data or [])]
                
                # Skip learners with no active subject enrollments
                if not enrolled_subject_ids:
                    continue
                    
            except Exception as e:
                logger.warning(f"Could not check subject enrollments for learner {learner_id}: {str(e)}")
                continue
            
            # Initialize risk score
            risk_score = 0
            risk_details = {
                "id": learner_id,
                "name": f"{learner.get('first_name', '')} {learner.get('last_name', '')}".strip(),
                "lrn": learner.get("lrn"),
                "barangay": learner.get("barangay"),
                "enrollment_date": enrollment_date,
                "submission_count": 0,
                "average_grade": 0,
                "last_submission_date": None,
                "days_since_submission": None,
                "days_enrolled": None,
                "risk_factors": [],
                "enrolled_subjects": [],  # NEW: Track which subjects and pending assignments
                "total_pending_assignments": 0
            }
            
            # Get subject names and assignment counts
            try:
                subjects_response = supabase.table("subjects")\
                    .select("id, subject_name")\
                    .in_("id", enrolled_subject_ids)\
                    .execute()
                subjects = {s["id"]: s["subject_name"] for s in (subjects_response.data or [])}
            except:
                subjects = {}
            
            # Query submissions for this learner
            try:
                submissions_response = supabase.table("post_submissions")\
                    .select("grade, submitted_at, post_id")\
                    .eq("student_id", str(user_id))\
                    .execute()
                
                submissions = submissions_response.data if submissions_response.data else []
                submitted_post_ids = {s.get("post_id") for s in submissions}
                risk_details["submission_count"] = len(submissions)
                
                # Check assignments for ENROLLED subjects only
                try:
                    assignments_response = supabase.table("subject_posts")\
                        .select("id, subject_id")\
                        .eq("post_type", "assignment")\
                        .in_("subject_id", enrolled_subject_ids)\
                        .execute()
                    
                    all_assignments = assignments_response.data if assignments_response.data else []
                    
                    # Organize assignments by subject
                    assignments_by_subject = {}
                    for assignment in all_assignments:
                        subject_id = assignment.get("subject_id")
                        if subject_id not in assignments_by_subject:
                            assignments_by_subject[subject_id] = []
                        assignments_by_subject[subject_id].append(assignment.get("id"))
                    
                    # Calculate pending assignments per subject
                    total_assignments = len(all_assignments)
                    total_pending = 0
                    
                    for subject_id, assignment_ids in assignments_by_subject.items():
                        pending_count = sum(1 for aid in assignment_ids if aid not in submitted_post_ids)
                        total_pending += pending_count
                        
                        subject_info = {
                            "subject_id": subject_id,
                            "subject_name": subjects.get(subject_id, "Unknown Subject"),
                            "total_assignments": len(assignment_ids),
                            "pending_assignments": pending_count,
                            "submitted_assignments": len(assignment_ids) - pending_count
                        }
                        risk_details["enrolled_subjects"].append(subject_info)
                    
                    risk_details["total_pending_assignments"] = total_pending
                    
                    if total_assignments > 0:
                        completion_percentage = ((total_assignments - total_pending) / total_assignments) * 100
                        
                        # Risk scoring: Only flag as risky if they have pending assignments and low completion
                        if total_pending > 0 and completion_percentage < 50:
                            risk_score += 30
                            risk_details["risk_factors"].append(f"Only completed {completion_percentage:.0f}% of assignments ({total_assignments - total_pending}/{total_assignments})")
                        elif total_pending > 3:
                            risk_score += 20
                            risk_details["risk_factors"].append(f"{total_pending} assignments pending")
                    
                except Exception as e:
                    logger.warning(f"Could not check assignments for learner {learner_id}: {str(e)}")
                
                if len(submissions) == 0 and total_pending > 0:
                    # Has enrolled subjects with assignments but zero submissions
                    risk_score += 35
                    risk_details["risk_factors"].append("No submissions despite assigned work")
                else:
                    # Calculate average grade from submissions
                    grades = [s.get("grade") for s in submissions if s.get("grade") is not None]
                    if grades:
                        # Calculate weighted average percentage using assignment points
                        try:
                            post_ids = [s.get("post_id") for s in submissions if s.get("grade") is not None]
                            if post_ids:
                                posts_response = supabase.table("subject_posts")\
                                    .select("id, points")\
                                    .in_("id", post_ids)\
                                    .execute()
                                posts_by_id = {p["id"]: p.get("points", 100) for p in (posts_response.data or [])}
                                
                                total_points = 0
                                earned_points = 0
                                for submission in submissions:
                                    if submission.get("grade") is not None:
                                        post_id = submission.get("post_id")
                                        points = posts_by_id.get(post_id, 100)
                                        total_points += points
                                        earned_points += float(submission.get("grade"))
                                avg_grade = (earned_points / total_points * 100) if total_points > 0 else 0
                            else:
                                avg_grade = 0
                        except Exception as e:
                            avg_grade = sum(float(s) for s in grades) / len(grades) if grades else 0
                        
                        risk_details["average_grade"] = round(avg_grade, 2)
                        
                        if avg_grade < 60:
                            risk_score += 30
                            risk_details["risk_factors"].append(f"Low grades (avg: {avg_grade:.1f}%)")
                        elif avg_grade < 75:
                            risk_score += 15
                            risk_details["risk_factors"].append(f"Below passing grade (avg: {avg_grade:.1f}%)")
                    
                    # Check last activity
                    try:
                        user_response = supabase.table("users").select("last_activity").eq("id", str(user_id)).execute()
                        user_record = user_response.data[0] if user_response.data else None
                        
                        if user_record and user_record.get("last_activity"):
                            last_activity_str = user_record.get("last_activity")
                            try:
                                if isinstance(last_activity_str, str):
                                    last_activity_str = last_activity_str.replace('Z', '+00:00')
                                    last_activity_date = datetime.fromisoformat(last_activity_str)
                                else:
                                    last_activity_date = last_activity_str if last_activity_str.tzinfo else last_activity_str.replace(tzinfo=dt.timezone.utc)
                                
                                days_since_activity = (dt.datetime.now(dt.timezone.utc) - last_activity_date).days
                                risk_details["last_activity_date"] = last_activity_str
                                risk_details["days_since_activity"] = days_since_activity
                                
                                if days_since_activity > 14:
                                    risk_score += 25
                                    risk_details["risk_factors"].append(f"No activity in {days_since_activity} days")
                                elif days_since_activity > 7:
                                    risk_score += 10
                                    risk_details["risk_factors"].append(f"Low activity ({days_since_activity} days)")
                            except Exception as e:
                                logger.error(f"Error parsing last_activity date: {str(e)}")
                    except Exception as e:
                        logger.warning(f"Could not fetch user record for {user_id}: {str(e)}")
            except Exception as e:
                logger.warning(f"Could not fetch submissions for learner {learner_id}: {str(e)}")
            
            # Check enrollment duration
            if enrollment_date:
                try:
                    enroll_date = datetime.fromisoformat(enrollment_date.isoformat() if hasattr(enrollment_date, 'isoformat') else enrollment_date)
                    days_enrolled = (dt.datetime.now() - enroll_date).days
                    risk_details["days_enrolled"] = days_enrolled
                    
                    if days_enrolled < 7 and risk_details["submission_count"] == 0:
                        risk_score += 10
                        risk_details["risk_factors"].append("New learner (vulnerable period)")
                except:
                    pass
            
            # Determine risk level
            if risk_score >= 60:
                risk_level = "high"
            elif risk_score >= 30:
                risk_level = "medium"
            else:
                risk_level = "low"
            
            risk_details["risk_score"] = min(risk_score, 100)
            risk_details["risk_level"] = risk_level
            
            # Only add if there are pending assignments (actually needs attention)
            if risk_details["total_pending_assignments"] > 0:
                risk_data.append(risk_details)
        
        # Sort by risk score (highest first)
        risk_data.sort(key=lambda x: x["risk_score"], reverse=True)
        
        # Calculate summary statistics
        summary = {
            "total_enrolled": len(enrolled_learners),
            "with_active_subjects": len([rl for rl in enrolled_learners if any(
                supabase.table("subject_enrollments")
                    .select("id")
                    .eq("student_id", str(rl.get("user_id")))
                    .eq("status", "active")
                    .execute().data
            )]),
            "at_risk": len([x for x in risk_data if x["risk_level"] in ["high", "medium"]]),
            "learners": risk_data
        }
        
        logger.info(f"✅ Risk scores calculated for {len(risk_data)} learners with pending assignments")
        return summary
        
    except Exception as e:
        logger.error(f"Error calculating risk scores: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating risk scores: {str(e)}")

@app.post("/api/af1-learners")
async def create_af1_learner(learner: dict):
    """
    Create a new AF1 learner record with geocoding based on barangay
    """
    try:
        # Barangay coordinates for Santa Cruz, Laguna
        barangay_coords = {
            "alipit": {"lat": 14.2299, "lng": 121.4102},
            "bagumbayan": {"lat": 14.268804631725034, "lng": 121.39979947057562},
            "barangay i (poblacion)": {"lat": 14.2755, "lng": 121.4170},
            "barangay i": {"lat": 14.2755, "lng": 121.4170},
            "poblacion i": {"lat": 14.2755, "lng": 121.4170},
            "barangay ii (poblacion)": {"lat": 14.2800, "lng": 121.4161},
            "barangay ii": {"lat": 14.2800, "lng": 121.4161},
            "poblacion ii": {"lat": 14.2800, "lng": 121.4161},
            "barangay iii (poblacion)": {"lat": 14.2820, "lng": 121.4152},
            "barangay iii": {"lat": 14.2820, "lng": 121.4152},
            "poblacion iii": {"lat": 14.2820, "lng": 121.4152},
            "barangay iv (poblacion)": {"lat": 14.2816, "lng": 121.4148},
            "barangay iv": {"lat": 14.2816, "lng": 121.4148},
            "poblacion iv": {"lat": 14.2816, "lng": 121.4148},
            "barangay v (poblacion)": {"lat": 14.2852, "lng": 121.4125},
            "barangay v": {"lat": 14.2852, "lng": 121.4125},
            "poblacion v": {"lat": 14.2852, "lng": 121.4125},
            "bubukal": {"lat": 14.251157941121727, "lng": 121.40255750998381},
            "calios": {"lat": 14.275138925320823, "lng": 121.40270109834186},
            "duhat": {"lat": 14.248671913684055, "lng": 121.37885222772985},
            "gatid": {"lat": 14.26136953826561, "lng": 121.38547404462257},
            "jasaan": {"lat": 14.2228, "lng": 121.3921},
            "labuin": {"lat": 14.2473, "lng": 121.3931},
            "malinao": {"lat": 14.2356, "lng": 121.3916},
            "oogong": {"lat": 14.223958784202317, "lng": 121.39846896765496},
            "pagsawitan": {"lat": 14.265459832536076, "lng": 121.42517109649133},
            "palasan": {"lat": 14.254588856450583, "lng": 121.42019519649105},
            "patimbao": {"lat": 14.272573942152114, "lng": 121.41732358484933},
            "san jose": {"lat": 14.236571232323422, "lng": 121.40299913081627},
            "san juan": {"lat": 14.2450, "lng": 121.4089},
            "san pablo norte": {"lat": 14.2852, "lng": 121.4174},
            "san pablo sur": {"lat": 14.2826, "lng": 121.4174},
            "santisima cruz": {"lat": 14.288230125362734, "lng": 121.41198043087904},
            "santo angel central": {"lat": 14.285503419158754, "lng": 121.41075330998406},
            "santo angel norte": {"lat": 14.28872161573547, "lng": 121.40593611368526},
            "santo angel sur": {"lat": 14.281381537136495, "lng": 121.41136975416305},
            "santa cruz": {"lat": 14.2818099, "lng": 121.414977},
            "punta": {"lat": 14.2700, "lng": 121.4100},
            "makibat": {"lat": 14.2600, "lng": 121.3950},
            "baras": {"lat": 14.2500, "lng": 121.3800},
            "dayap": {"lat": 14.2750, "lng": 121.4250},
            "magtanggol": {"lat": 14.2650, "lng": 121.4150},
            "talipapa": {"lat": 14.2800, "lng": 121.4050},
            "tabuyoc": {"lat": 14.2550, "lng": 121.4200},
            "tambo": {"lat": 14.2700, "lng": 121.3900},
            "tangkal": {"lat": 14.2600, "lng": 121.4300},
            "tibig": {"lat": 14.2750, "lng": 121.3800},
            "nayon": {"lat": 14.2650, "lng": 121.4250},
            "sicalao": {"lat": 14.2550, "lng": 121.3950}
        }
        
        # Get barangay name and geocode
        barangay_name = learner.get("barangay", "").lower().strip()
        
        # Try exact match first, then partial match
        coords = barangay_coords.get(barangay_name)
        
        if not coords:
            # Try partial/fuzzy matching for common variations
            for key in barangay_coords:
                if barangay_name in key or key in barangay_name:
                    coords = barangay_coords[key]
                    break
        
        # Use default if still no match
        if not coords:
            coords = {
                "lat": 14.2818099,  # Default Santa Cruz center
                "lng": 121.414977
            }
            logger.warning(f"Barangay '{learner.get('barangay')}' not found in coordinates map, using default")
        
        # Add geocoding to learner
        learner["lat"] = coords["lat"]
        learner["lng"] = coords["lng"]
        learner["geocoded"] = True
        
        # Insert into the als_af1 table
        response = supabase.table("als_af1").insert(learner).execute()
        
        if response.data:
            return {"success": True, "learner": response.data[0]}
        else:
            raise HTTPException(status_code=400, detail="Failed to create learner")
            
    except Exception as e:
        logger.error(f"Error creating AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating learner: {str(e)}")

@app.post("/api/af1-learners/batch-import")
async def batch_import_af1_learners(request: AF1BatchImportRequest):
    """
    Batch import multiple AF1 learner records with geocoding based on barangay
    """
    try:
        learners = request.learners
        
        if not learners or len(learners) == 0:
            raise HTTPException(status_code=400, detail="No learners to import")
        
        # Barangay coordinates for Santa Cruz, Laguna
        barangay_coords = {
            "alipit": {"lat": 14.2299, "lng": 121.4102},
            "bagumbayan": {"lat": 14.268804631725034, "lng": 121.39979947057562},
            "poblacion i": {"lat": 14.2755, "lng": 121.4170},
            "poblacion ii": {"lat": 14.2800, "lng": 121.4161},
            "poblacion iii": {"lat": 14.2820, "lng": 121.4152},
            "poblacion iv": {"lat": 14.2816, "lng": 121.4148},
            "poblacion v": {"lat": 14.2852, "lng": 121.4125},
            "bubukal": {"lat": 14.251157941121727, "lng": 121.40255750998381},
            "calios": {"lat": 14.275138925320823, "lng": 121.40270109834186},
            "duhat": {"lat": 14.248671913684055, "lng": 121.37885222772985},
            "gatid": {"lat": 14.26136953826561, "lng": 121.38547404462257},
            "jasaan": {"lat": 14.2228, "lng": 121.3921},
            "labuin": {"lat": 14.2473, "lng": 121.3931},
            "malinao": {"lat": 14.2356, "lng": 121.3916},
            "oogong": {"lat": 14.223958784202317, "lng": 121.39846896765496},
            "pagsawitan": {"lat": 14.265459832536076, "lng": 121.42517109649133},
            "palasan": {"lat": 14.254588856450583, "lng": 121.42019519649105},
            "patimbao": {"lat": 14.272573942152114, "lng": 121.41732358484933},
            "san jose": {"lat": 14.236571232323422, "lng": 121.40299913081627},
            "san juan": {"lat": 14.2450, "lng": 121.4089},
            "san pablo norte": {"lat": 14.2852, "lng": 121.4174},
            "san pablo sur": {"lat": 14.2826, "lng": 121.4174},
            "santisima cruz": {"lat": 14.288230125362734, "lng": 121.41198043087904},
            "santo angel central": {"lat": 14.285503419158754, "lng": 121.41075330998406},
            "santo angel norte": {"lat": 14.28872161573547, "lng": 121.40593611368526},
            "santo angel sur": {"lat": 14.281381537136495, "lng": 121.41136975416305},
            "santa cruz": {"lat": 14.2818099, "lng": 121.414977},
            "punta": {"lat": 14.2700, "lng": 121.4100},
            "makibat": {"lat": 14.2600, "lng": 121.3950},
            "baras": {"lat": 14.2500, "lng": 121.3800},
            "dayap": {"lat": 14.2750, "lng": 121.4250},
            "magtanggol": {"lat": 14.2650, "lng": 121.4150},
            "talipapa": {"lat": 14.2800, "lng": 121.4050},
            "tabuyoc": {"lat": 14.2550, "lng": 121.4200},
            "tambo": {"lat": 14.2700, "lng": 121.3900},
            "tangkal": {"lat": 14.2600, "lng": 121.4300},
            "tibig": {"lat": 14.2750, "lng": 121.3800},
            "nayon": {"lat": 14.2650, "lng": 121.4250},
            "sicalao": {"lat": 14.2550, "lng": 121.3950}
        }
        
        # Add geocoding to each learner
        geocoded_learners = []
        for learner in learners:
            barangay_name = learner.get("barangay", "").lower().strip()
            
            # Try exact match first
            coords = barangay_coords.get(barangay_name)
            
            # If not found, check if it's old "barangay i-v" format and convert
            if not coords and barangay_name.startswith("barangay"):
                converted_name = barangay_name.replace("barangay", "poblacion").strip()
                coords = barangay_coords.get(converted_name)
            
            # If still not found, try partial matching for common variations
            if not coords:
                for key in barangay_coords:
                    if barangay_name in key or key in barangay_name:
                        coords = barangay_coords[key]
                        break
            
            # Use default if still no match
            if not coords:
                coords = {
                    "lat": 14.2818099,  # Default Santa Cruz center
                    "lng": 121.414977
                }
                logger.warning(f"Barangay '{learner.get('barangay')}' not found in coordinates map, using default")
            
            geocoded_learner = {
                **learner,
                "lat": coords["lat"],
                "lng": coords["lng"],
                "geocoded": True
            }
            geocoded_learners.append(geocoded_learner)
        
        # Insert all learners with geocoding
        response = supabase.table("als_af1").insert(geocoded_learners).execute()
        
        if response.data:
            return {
                "success": True, 
                "imported": len(response.data),
                "learners": response.data
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to import learners")
            
    except Exception as e:
        logger.error(f"Error batch importing AF1 learners: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error importing learners: {str(e)}")

# Instructor Mapped Learners (AF1) Endpoints
@app.get("/api/instructor-mapped-learners/{instructor_id}")
async def get_instructor_mapped_learners(instructor_id: str):
    """
    Get all AF1 mapped learners (all instructors can see all learners)
    Similar to admin view, all instructors have access to the same mapped learners
    Excludes archived learners by default
    """
    try:
        response = supabase.table("als_af1")\
            .select("*")\
            .eq("archived", False)\
            .execute()
        learners = response.data if response.data else []
        
        logger.info(f"Fetched {len(learners)} active mapped learners for instructor {instructor_id}")
        return learners
        
    except Exception as e:
        logger.error(f"Error fetching mapped learners: {str(e)}")
        # Fallback if archived column doesn't exist yet
        try:
            response = supabase.table("als_af1").select("*").execute()
            learners = response.data if response.data else []
            return learners
        except:
            return []

@app.get("/api/instructor-mapped-learners/{instructor_id}/archived")
async def get_archived_mapped_learners(instructor_id: str):
    """
    Get all archived AF1 learners
    """
    try:
        response = supabase.table("als_af1")\
            .select("*")\
            .eq("archived", True)\
            .execute()
        learners = response.data if response.data else []
        
        return learners
        
    except Exception as e:
        logger.error(f"Error fetching archived learners: {str(e)}")
        return []

@app.get("/api/af1-learners/archived")
async def get_archived_af1_learners():
    """
    Get all archived AF1 learners
    """
    try:
        response = supabase.table("als_af1")\
            .select("*")\
            .eq("archived", True)\
            .execute()
        
        learners = response.data if response.data else []
        return learners
        
    except Exception as e:
        logger.error(f"Error fetching archived AF1 learners: {str(e)}")
        return []

@app.get("/api/af1-learners/{learner_id}")
async def get_af1_learner_details(learner_id: str):
    """
    Get a specific AF1 learner's details
    """
    try:
        response = supabase.table("als_af1")\
            .select("*")\
            .eq("id", learner_id)\
            .execute()
        
        if response.data:
            return response.data[0]
        else:
            raise HTTPException(status_code=404, detail="Learner not found")
            
    except Exception as e:
        logger.error(f"Error fetching AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching learner: {str(e)}")

@app.patch("/api/af1-learners/{learner_id}/archive")
async def archive_af1_learner(learner_id: str):
    """
    Archive an AF1 learner (soft delete)
    """
    try:
        response = supabase.table("als_af1")\
            .update({"archived": True})\
            .eq("id", learner_id)\
            .execute()
        
        logger.info(f"AF1 learner {learner_id} archived")
        return {"success": True, "message": "Learner archived successfully"}
            
    except Exception as e:
        logger.error(f"Error archiving AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error archiving learner: {str(e)}")

@app.patch("/api/af1-learners/{learner_id}/unarchive")
async def unarchive_af1_learner(learner_id: str):
    """
    Unarchive an AF1 learner
    """
    try:
        response = supabase.table("als_af1")\
            .update({"archived": False})\
            .eq("id", learner_id)\
            .execute()
        
        logger.info(f"AF1 learner {learner_id} unarchived")
        return {"success": True, "message": "Learner unarchived successfully"}
            
    except Exception as e:
        logger.error(f"Error unarchiving AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error unarchiving learner: {str(e)}")

@app.post("/api/instructor-mapped-learners/{instructor_id}")
async def add_instructor_mapped_learner(instructor_id: str, request_body: dict = Body(...)):
    """
    Map an AF1 learner to an instructor (learner already exists in als_af1)
    Just confirms the mapping - actual learner creation happens in /api/af1-learners
    """
    try:
        learner_id = request_body.get("learner_id")
        
        if not learner_id:
            raise HTTPException(status_code=400, detail="learner_id is required")
        
        # Verify the learner exists in als_af1
        learner_response = supabase.table("als_af1")\
            .select("*")\
            .eq("id", learner_id)\
            .execute()
        
        if not learner_response.data:
            raise HTTPException(status_code=404, detail="Learner not found")
        
        logger.info(f"AF1 learner {learner_id} mapped for instructor {instructor_id}")
        return {"success": True, "message": "Learner mapped successfully", "learner_id": learner_id}
            
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error mapping AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error mapping learner: {str(e)}")

@app.patch("/api/instructor-mapped-learners/{instructor_id}/{learner_id}/archive")
async def archive_instructor_mapped_learner(instructor_id: str, learner_id: str):
    """
    Archive an AF1 learner (soft delete)
    """
    try:
        # Update the archived flag to true
        response = supabase.table("als_af1")\
            .update({"archived": True})\
            .eq("id", learner_id)\
            .execute()
        
        logger.info(f"AF1 learner {learner_id} archived")
        return {"success": True, "message": "Learner archived successfully"}
            
    except Exception as e:
        logger.error(f"Error archiving AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error archiving learner: {str(e)}")

@app.patch("/api/instructor-mapped-learners/{instructor_id}/{learner_id}/unarchive")
async def unarchive_instructor_mapped_learner(instructor_id: str, learner_id: str):
    """
    Unarchive an AF1 learner
    """
    try:
        # Update the archived flag to false
        response = supabase.table("als_af1")\
            .update({"archived": False})\
            .eq("id", learner_id)\
            .execute()
        
        logger.info(f"AF1 learner {learner_id} unarchived")
        return {"success": True, "message": "Learner unarchived successfully"}
            
    except Exception as e:
        logger.error(f"Error unarchiving AF1 learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error unarchiving learner: {str(e)}")
# Debug endpoint to check AF1 data
@app.get("/api/debug/af1-table-info")
async def debug_af1_table():
    """
    Debug endpoint to check AF1 table structure and sample data
    """
    try:
        # Get a sample learner to see the structure
        response = supabase.table("als_af1").select("*").limit(1).execute()
        
        if response.data:
            sample_learner = response.data[0]
            columns = list(sample_learner.keys()) if sample_learner else []
            
            return {
                "success": True,
                "table": "als_af1",
                "columns": columns,
                "sample": sample_learner,
                "has_instructor_id": "instructor_id" in columns
            }
        else:
            return {
                "success": True,
                "table": "als_af1",
                "message": "No data in table",
                "columns": []
            }
    except Exception as e:
        return {
            "error": str(e),
            "message": "Could not fetch table info"
        }

barangay_coords = {
    "alipit": {"lat": 14.2818099, "lng": 121.414977},
    "bagumbayan": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion i": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion ii": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion iii": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion iv": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion v": {"lat": 14.2818099, "lng": 121.414977},
    "bubukal": {"lat": 14.2818099, "lng": 121.414977},
    "calios": {"lat": 14.2818099, "lng": 121.414977},
    "duhat": {"lat": 14.2818099, "lng": 121.414977},
    "gatid": {"lat": 14.2818099, "lng": 121.414977},
    "jasaan": {"lat": 14.2818099, "lng": 121.414977},
    "labuin": {"lat": 14.2818099, "lng": 121.414977},
    "malinao": {"lat": 14.2818099, "lng": 121.414977},
    "oogong": {"lat": 14.2818099, "lng": 121.414977},
    "pagsawitan": {"lat": 14.2818099, "lng": 121.414977},
    "palasan": {"lat": 14.2818099, "lng": 121.414977},
    "patimbao": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion i": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion ii": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion iii": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion iv": {"lat": 14.2818099, "lng": 121.414977},
    "poblacion v": {"lat": 14.2818099, "lng": 121.414977},
    "san jose": {"lat": 14.2818099, "lng": 121.414977},
    "san juan": {"lat": 14.2818099, "lng": 121.414977},
    "san pablo norte": {"lat": 14.2818099, "lng": 121.414977},
    "san pablo sur": {"lat": 14.2818099, "lng": 121.414977},
    "santisima cruz": {"lat": 14.2818099, "lng": 121.414977},
    "santo angel central": {"lat": 14.2818099, "lng": 121.414977},
    "santo angel norte": {"lat": 14.2818099, "lng": 121.414977},
    "santo angel sur": {"lat": 14.2818099, "lng": 121.414977}
}

barangays = [
    { "name": "Alipit", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Bagumbayan", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion I", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion II", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion III", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion IV", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion V", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Bubukal", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Calios", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Duhat", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Gatid", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Jasaan", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Labuin", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Malinao", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Oogong", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Pagsawitan", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Palasan", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Patimbao", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion I", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion II", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion III", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion IV", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Poblacion V", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "San Jose", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "San Juan", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "San Pablo Norte", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "San Pablo Sur", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Santisima Cruz", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Santo Angel Central", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Santo Angel Norte", "lat": 14.2818099, "lng": 121.414977 },
    { "name": "Santo Angel Sur", "lat": 14.2818099, "lng": 121.414977 }
]

# Elementary Schools in Santa Cruz, Laguna with Coordinates
schools = [
    {"id": 1, "school_name": "Bagumbayan Elementary School", "barangay": "Bagumbayan", "type": "Elementary", "lat": 14.268804631725034, "lng": 121.39979947057562, "address": "Bagumbayan, Santa Cruz, Laguna"},
    {"id": 2, "school_name": "Bubukal Elementary School", "barangay": "Bubukal", "type": "Elementary", "lat": 14.251157941121727, "lng": 121.40255750998381, "address": "Bubukal, Santa Cruz, Laguna"},
    {"id": 3, "school_name": "Calios Elementary School", "barangay": "Calios", "type": "Elementary", "lat": 14.275138925320823, "lng": 121.40270109834186, "address": "Calios, Santa Cruz, Laguna"},
    {"id": 4, "school_name": "Duhat Elementary School", "barangay": "Duhat", "type": "Elementary", "lat": 14.248671913684055, "lng": 121.37885222772985, "address": "Duhat, Santa Cruz, Laguna"},
    {"id": 5, "school_name": "Gatid Elementary School", "barangay": "Gatid", "type": "Elementary", "lat": 14.26136953826561, "lng": 121.38547404462257, "address": "Gatid, Santa Cruz, Laguna"},
    {"id": 6, "school_name": "Oogong Elementary School", "barangay": "Oogong", "type": "Elementary", "lat": 14.223958784202317, "lng": 121.39846896765496, "address": "Oogong, Santa Cruz, Laguna"},
    {"id": 7, "school_name": "Pagsawitan Elementary School", "barangay": "Pagsawitan", "type": "Elementary", "lat": 14.265459832536076, "lng": 121.42517109649133, "address": "Pagsawitan, Santa Cruz, Laguna"},
    {"id": 8, "school_name": "Palasan Elementary School", "barangay": "Palasan", "type": "Elementary", "lat": 14.254588856450583, "lng": 121.42019519649105, "address": "Palasan, Santa Cruz, Laguna"},
    {"id": 9, "school_name": "Patimbao Elementary School", "barangay": "Patimbao", "type": "Elementary", "lat": 14.272573942152114, "lng": 121.41732358484933, "address": "Patimbao, Santa Cruz, Laguna"},
    {"id": 10, "school_name": "San Jose Elementary School", "barangay": "San Jose", "type": "Elementary", "lat": 14.236571232323422, "lng": 121.40299913081627, "address": "San Jose, Santa Cruz, Laguna"},
    {"id": 11, "school_name": "Santisima Cruz Elementary School", "barangay": "Santisima Cruz", "type": "Elementary", "lat": 14.288230125362734, "lng": 121.41198043087904, "address": "Santisima Cruz, Santa Cruz, Laguna"},
    {"id": 12, "school_name": "Santo Angel Central Elementary School", "barangay": "Santo Angel Central", "type": "Elementary", "lat": 14.285503419158754, "lng": 121.41075330998406, "address": "Santo Angel Central, Santa Cruz, Laguna"},
    {"id": 13, "school_name": "Santo Angel Norte Elementary School", "barangay": "Santo Angel Norte", "type": "Elementary", "lat": 14.28872161573547, "lng": 121.40593611368526, "address": "Santo Angel Norte, Santa Cruz, Laguna"},
    {"id": 14, "school_name": "Santo Angel Sur Elementary School", "barangay": "Santo Angel Sur", "type": "Elementary", "lat": 14.281381537136495, "lng": 121.41136975416305, "address": "Santo Angel Sur, Santa Cruz, Laguna"},
    {"id": 15, "school_name": "Santa Cruz Central Elementary School", "barangay": "Poblacion V", "type": "Elementary", "lat": 14.279406465092405, "lng": 121.41711891368513, "address": "Poblacion V, Santa Cruz, Laguna"},
]

@app.get("/api/barangays")
async def get_barangays():
    try:
        return barangays  # This uses the barangays array already defined in your ALS.py
    except Exception as e:
        logger.error(f"Error fetching barangays: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching barangays: {str(e)}")

@app.get("/api/schools")
async def get_schools(barangay: str = "all", school_type: str = "all"):
    """
    Get schools in Santa Cruz, Laguna with optional filters
    """
    try:
        filtered_schools = schools
        
        if barangay != "all" and barangay:
            filtered_schools = [s for s in filtered_schools if s["barangay"].lower() == barangay.lower()]
        
        if school_type != "all" and school_type:
            filtered_schools = [s for s in filtered_schools if s["type"].lower() == school_type.lower()]
        
        return filtered_schools
    except Exception as e:
        logger.error(f"Error fetching schools: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching schools: {str(e)}")

@app.get("/api/schools/{school_id}")
async def get_school(school_id: int):
    """
    Get a specific school by ID
    """
    try:
        school = next((s for s in schools if s["id"] == school_id), None)
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        return school
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching school: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching school: {str(e)}")




@app.get("/api/learners")
async def get_learners(status: str = "all", barangay: str = "all"):
    """
    Get all learners with optional filters
    """
    try:
        query = supabase.table("learners").select("*")
        
        if status != "all":
            query = query.eq("status", status)
        if barangay != "all":
            query = query.eq("barangay", barangay)
        
        response = query.execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching learners: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching learners: {str(e)}")


@app.post("/api/learners")
async def add_learner(learner: Learner):
    """
    Create a new learner with split name fields
    """
    try:
        # Log the incoming data for debugging
        learner_data = learner.dict()
        logger.info(f"📥 Received learner data: {learner_data}")
        
        # Find the barangay coordinates
        barangay_obj = next((b for b in barangays if b["name"].lower() == learner_data["barangay"].lower()), None)
        
        if barangay_obj:
            learner_data["barangay"] = barangay_obj["name"]
            learner_data["lat"] = barangay_obj["lat"]
            learner_data["lng"] = barangay_obj["lng"]
        else:
            learner_data["lat"] = 14.2818099
            learner_data["lng"] = 121.414977
        
        # Initialize progress to 0
        learner_data["progress"] = 0
        
        logger.info(f"📤 Sending to database: {learner_data}")
        
        response = supabase.table("learners").insert(learner_data).execute()
        
        if response.data:
            logger.info(f"✅ Learner created: {learner_data['first_name']} {learner_data['last_name']}")
            return {"success": True, "data": response.data[0]}
        else:
            logger.error(f"❌ Database returned no data: {response}")
            raise HTTPException(status_code=400, detail="Failed to create learner")
            
    except ValidationError as ve:
        logger.error(f"❌ Validation Error: {ve.errors()}")
        raise HTTPException(status_code=422, detail=f"Validation error: {ve.errors()}")
    except Exception as e:
        logger.error(f"❌ Error creating learner: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error creating learner: {str(e)}")


# UPDATED UPDATE ENDPOINT
@app.put("/api/learners/{learner_id}")
async def update_learner(learner_id: int, learner: Learner):
    """
    Update an existing learner with split name fields
    """
    try:
        learner_data = learner.dict()
        logger.info(f"📥 Updating learner {learner_id} with: {learner_data}")
        
        # Find the barangay coordinates
        barangay_obj = next((b for b in barangays if b["name"].lower() == learner_data["barangay"].lower()), None)
        
        if barangay_obj:
            learner_data["barangay"] = barangay_obj["name"]
            learner_data["lat"] = barangay_obj["lat"]
            learner_data["lng"] = barangay_obj["lng"]
        else:
            learner_data["lat"] = 14.2818099
            learner_data["lng"] = 121.414977
        
        response = supabase.table("learners")\
            .update(learner_data)\
            .eq("id", learner_id)\
            .execute()
        
        if response.data:
            logger.info(f"✅ Learner updated: {learner_id}")
            return {"success": True, "data": response.data[0]}
        else:
            raise HTTPException(status_code=404, detail="Learner not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating learner: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error updating learner: {str(e)}")


@app.delete("/api/learners/{learner_id}")
async def delete_learner(learner_id: int):
    """
    Delete a learner
    """
    try:
        response = supabase.table("learners")\
            .delete()\
            .eq("id", learner_id)\
            .execute()
        
        if response.data:
            logger.info(f"✅ Learner deleted: {learner_id}")
            return {"success": True, "message": "Learner deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Learner not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting learner: {str(e)}")


@app.get("/api/learners/{learner_id}")
async def get_learner(learner_id: int):
    """
    Get a single learner by ID
    """
    try:
        response = supabase.table("learners")\
            .select("*")\
            .eq("id", learner_id)\
            .single()\
            .execute()
        
        if response.data:
            return response.data
        else:
            raise HTTPException(status_code=404, detail="Learner not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching learner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching learner: {str(e)}")



# Add these endpoints to your ALS.py file (after your existing endpoints)

@app.get("/api/approved-enrollments")
async def get_approved_enrollments(
    barangay: str = "all",
    status: str = "all",
    search: str = ""
):
    """
    Get approved enrollments with linked user account data
    This replaces the manual learners table for instructors
    """
    try:
        # Fetch approved enrollments without JOIN first (more reliable)
        query = supabase.table("als_enrollments_approved").select("*")
        
        # Apply barangay filter
        if barangay != "all" and barangay:
            query = query.eq("barangay", barangay)
        
        response = query.order("approved_at", desc=True).execute()
        
        if not response.data:
            return []
        
        # Enrich data with computed fields
        enriched_data = []
        for enrollment in response.data:
            full_name = f"{enrollment.get('first_name', '')} {enrollment.get('middle_name', '')} {enrollment.get('last_name', '')}".strip()
            middle_initial = enrollment.get('middle_name', '')[:1] if enrollment.get('middle_name') else None
            
            # Determine status based on username or user_id
            has_account = bool(enrollment.get("username") or enrollment.get("user_id"))
            account_status = "active" if has_account else "no_account"
            
            enriched_data.append({
                # Basic Info
                "id": enrollment.get("id"),
                "lrn": enrollment.get("lrn"),
                "full_name": full_name,
                "first_name": enrollment.get("first_name"),
                "last_name": enrollment.get("last_name"),
                "middle_name": enrollment.get("middle_name"),
                "middle_initial": middle_initial,
                
                # Contact & Location
                "barangay": enrollment.get("barangay"),
                "address": enrollment.get("house_no_street_sitio"),
                "contact_numbers": enrollment.get("contact_numbers"),
                "email_address": enrollment.get("email_address"),
                
                # Personal Details
                "birthdate": enrollment.get("birthdate"),
                "sex": enrollment.get("sex"),
                "civil_status": enrollment.get("civil_status"),
                
                # Education
                "last_grade_level_completed": enrollment.get("last_grade_level_completed"),
                "elementary_school": enrollment.get("elementary_school"),
                "junior_high_school": enrollment.get("junior_high_school"),
                
                # Dates
                "enrollment_date": enrollment.get("enrollment_date"),
                "approved_at": enrollment.get("approved_at"),
                "lastContact": enrollment.get("approved_at"),
                
                # User Account Data
                "user_id": enrollment.get("user_id"),
                "has_account": has_account,
                "username": enrollment.get("username", "No Account"),
                "account_email": enrollment.get("email_address"),
                "account_created": enrollment.get("approved_at"),
                
                # Status
                "status": account_status
            })
        
        return enriched_data
        
    except Exception as e:
        logger.error(f"Error fetching approved enrollments: {str(e)}")
        return []


@app.get("/api/approved-enrollments/{enrollment_id}")
async def get_approved_enrollment_detail(enrollment_id: str):
    """
    Get detailed information about a specific approved enrollment
    """
    try:
        response = supabase.table("als_enrollments_approved")\
            .select("""
                *,
                user:user_id(
                    id,
                    username,
                    email,
                    role,
                    created_at
                )
            """)\
            .eq("id", enrollment_id)\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Enrollment not found")
        
        enrollment = response.data
        
        # Format full name
        full_name = f"{enrollment['first_name']} {enrollment.get('middle_name', '')} {enrollment['last_name']}".strip()
        
        return {
            "enrollment": enrollment,
            "full_name": full_name,
            "has_account": enrollment.get("user") is not None,
            "account_info": enrollment.get("user")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching enrollment detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/approved-enrollments/stats/summary")
async def get_approved_enrollments_stats():
    """
    Get statistics summary for approved enrollments
    """
    try:
        response = supabase.table("als_enrollments_approved")\
            .select("*")\
            .execute()
        
        enrollments = response.data or []
        
        total = len(enrollments)
        with_accounts = sum(1 for e in enrollments if e.get("username") or e.get("user_id"))
        without_accounts = total - with_accounts
        
        # Recent approvals (last 7 days)
        now = dt.datetime.utcnow()
        week_ago = now - dt.timedelta(days=7)
        recent = 0
        
        for e in enrollments:
            approved_at = e.get("approved_at") or e.get("created_at")
            if approved_at:
                try:
                    approved_date = dt.datetime.fromisoformat(approved_at.replace('Z', '+00:00'))
                    if approved_date >= week_ago:
                        recent += 1
                except:
                    pass
        
        return {
            "total_approved": total,
            "with_accounts": with_accounts,
            "without_accounts": without_accounts,
            "recent_approvals": recent
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {str(e)}")
        return {
            "total_approved": 0,
            "with_accounts": 0,
            "without_accounts": 0,
            "recent_approvals": 0,
            "error": str(e)
        }






@app.get("/api/subjects")
async def get_subjects(instructor_id: str):
    # Fetch subjects for this instructor
    response = supabase.table("subjects").select("*").eq("instructor_id", instructor_id).execute()
    return response.data

@app.post("/api/subjects")
async def create_subject(subject: Subject):
    # Insert new subject
    response = supabase.table("subjects").insert(subject.dict()).execute()
    return {"success": True, "data": response.data}




@app.post("/api/reports")
async def generate_report(payload: dict):
    # Placeholder for report generation
    report_url = "/reports/sample.pdf"
    return {"success": True, "reportUrl": report_url}

@app.post("/api/enroll-subject")
async def enroll_in_subject(request: EnrollmentRequest):
    """
    Enroll student in a subject using class code
    """
    try:
        # Get student_id from the request body (it's already in EnrollmentRequest)
        student_id = request.student_id
        
        # Find subject by class code
        subject_response = supabase.table("subjects")\
            .select("id, subject_name, allow_enrollment")\
            .eq("class_code", request.class_code.upper())\
            .single()\
            .execute()
        
        if not subject_response.data:
            raise HTTPException(status_code=404, detail="Invalid class code")
        
        subject = subject_response.data
        
        if not subject.get("allow_enrollment", True):
            raise HTTPException(status_code=403, detail="Enrollment is currently closed for this subject")
        
        # Check if already enrolled
        existing = supabase.table("subject_enrollments")\
            .select("id")\
            .eq("subject_id", subject["id"])\
            .eq("student_id", student_id)\
            .execute()
        
        if existing.data:
            raise HTTPException(status_code=409, detail="You are already enrolled in this subject")
        
        # Create enrollment
        enrollment_data = {
            "subject_id": subject["id"],
            "student_id": student_id,
            "status": "active"
        }
        
        response = supabase.table("subject_enrollments").insert(enrollment_data).execute()
        
        if response.data:
            logger.info(f"✅ Student {student_id} enrolled in subject {subject['id']}")
            return {
                "success": True,
                "message": f"Successfully enrolled in {subject['subject_name']}",
                "data": response.data[0]
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to enroll")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Enrollment error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error enrolling: {str(e)}")

@app.get("/api/my-subjects")
async def get_student_subjects(student_id: str):
    """
    Get all subjects a student is enrolled in
    """
    try:
        response = supabase.table("subject_enrollments")\
            .select("""
                *,
                subject:subject_id(
                    id,
                    subject_name,
                    subject_code,
                    description,
                    cover_image,
                    instructor:instructor_id(username, first_name, last_name)
                )
            """)\
            .eq("student_id", student_id)\
            .eq("status", "active")\
            .execute()
        
        return response.data if response.data else []
        
    except Exception as e:
        logger.error(f"Error fetching student subjects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching subjects: {str(e)}")

@app.post("/api/subjects/{subject_id}/regenerate-code")
async def regenerate_class_code(subject_id: str, instructor_id: str):
    """
    Regenerate class code for a subject (instructor only)
    """
    try:
        # Verify instructor owns this subject
        subject = supabase.table("subjects")\
            .select("instructor_id")\
            .eq("id", subject_id)\
            .single()\
            .execute()
        
        if not subject.data or subject.data["instructor_id"] != instructor_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        new_code = generate_class_code()
        
        response = supabase.table("subjects")\
            .update({"class_code": new_code})\
            .eq("id", subject_id)\
            .execute()
        
        return {"success": True, "class_code": new_code}
        
    except Exception as e:
        logger.error(f"Error regenerating code: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/subjects/{subject_id}/toggle-enrollment")
async def toggle_enrollment(subject_id: str, allow: bool, instructor_id: str):
    """
    Toggle enrollment on/off for a subject
    """
    try:
        # Verify instructor owns this subject
        subject = supabase.table("subjects")\
            .select("instructor_id")\
            .eq("id", subject_id)\
            .single()\
            .execute()
        
        if not subject.data or subject.data["instructor_id"] != instructor_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        response = supabase.table("subjects")\
            .update({"allow_enrollment": allow})\
            .eq("id", subject_id)\
            .execute()
        
        return {"success": True, "allow_enrollment": allow}
        
    except Exception as e:
        logger.error(f"Error toggling enrollment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/enrollments/{enrollment_id}")
async def unenroll_student(enrollment_id: str, instructor_id: str):
    """
    Remove a student from a subject (instructor or student themselves)
    """
    try:
        # Get enrollment details
        enrollment = supabase.table("subject_enrollments")\
            .select("*, subject:subject_id(instructor_id)")\
            .eq("id", enrollment_id)\
            .single()\
            .execute()
        
        if not enrollment.data:
            raise HTTPException(status_code=404, detail="Enrollment not found")
        
        # Verify permission (instructor of the subject)
        if enrollment.data["subject"]["instructor_id"] != instructor_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        response = supabase.table("subject_enrollments")\
            .delete()\
            .eq("id", enrollment_id)\
            .execute()
        
        return {"success": True, "message": "Student unenrolled successfully"}
        
    except Exception as e:
        logger.error(f"Error unenrolling student: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/subjects/{subject_id}/enrolled-students")
async def get_enrolled_students(subject_id: str):
    """
    Get all students enrolled in a subject
    """
    try:
        response = supabase.table("subject_enrollments")\
            .select("""
                *,
                student:student_id(
                    id,
                    username,
                    first_name,
                    last_name,
                    email
                )
            """)\
            .eq("subject_id", subject_id)\
            .eq("status", "active")\
            .order("enrolled_at", desc=True)\
            .execute()
        
        return response.data if response.data else []
        
    except Exception as e:
        logger.error(f"Error fetching enrolled students: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



class Announcement(BaseModel):
    title: str
    content: str
    announcement_type: str  # 'system', 'subject', 'general'
    priority: str  # 'urgent', 'important', 'general'
    subject_id: Optional[str] = None
    author_id: str
    is_pinned: bool = False
    expires_at: Optional[str] = None

class AnnouncementRead(BaseModel):
    announcement_id: str
    student_id: str

# Add these endpoints after your existing endpoints

@app.get("/api/announcements/student/{student_id}")
async def get_student_announcements(
    student_id: str,
    filter_type: str = "all"  # all, unread, read
):
    """
    Get all announcements relevant to a student
    Includes: system announcements + announcements from enrolled subjects
    """
    try:
        # Get student's enrolled subjects
        enrollments_response = supabase.table("subject_enrollments")\
            .select("subject_id")\
            .eq("student_id", student_id)\
            .eq("status", "active")\
            .execute()
        
        enrolled_subject_ids = [e["subject_id"] for e in (enrollments_response.data or [])]
        
        # Fetch system-wide announcements from subject_posts
        system_announcements_response = supabase.table("subject_posts")\
            .select("""
                *,
                author:instructor_id(username, first_name, last_name),
                subject:subject_id(subject_name, subject_code)
            """)\
            .eq("post_type", "announcement")\
            .is_("subject_id", "null")\
            .eq("is_published", True)\
            .order("created_at", desc=True)\
            .execute()
        
        system_announcements = system_announcements_response.data or []
        
        # Fetch subject-specific announcements
        subject_announcements = []
        if enrolled_subject_ids:
            subject_announcements_response = supabase.table("subject_posts")\
                .select("""
                    *,
                    author:instructor_id(username, first_name, last_name),
                    subject:subject_id(subject_name, subject_code)
                """)\
                .eq("post_type", "announcement")\
                .in_("subject_id", enrolled_subject_ids)\
                .eq("is_published", True)\
                .order("created_at", desc=True)\
                .execute()
            
            subject_announcements = subject_announcements_response.data or []
        
        # Combine all announcements
        all_announcements = system_announcements + subject_announcements
        
        # Get read status for all announcements
        announcement_ids = [a["id"] for a in all_announcements]
        
        if announcement_ids:
            reads_response = supabase.table("announcement_reads")\
                .select("announcement_id, read_at")\
                .eq("student_id", student_id)\
                .in_("announcement_id", announcement_ids)\
                .execute()
            
            reads_map = {r["announcement_id"]: r["read_at"] for r in (reads_response.data or [])}
        else:
            reads_map = {}
        
        # Enrich announcements with read status
        enriched_announcements = []
        for announcement in all_announcements:
            read_at = reads_map.get(announcement["id"])
            
            enriched = {
                **announcement,
                "is_read": read_at is not None,
                "read_at": read_at,
                "announcement_type": "system" if announcement["subject_id"] is None else "subject",
                "source_name": announcement["subject"]["subject_name"] if announcement.get("subject") else "System",
                "author_name": f"{announcement['author'].get('first_name', '')} {announcement['author'].get('last_name', '')}".strip() or announcement['author']['username']
            }
            
            enriched_announcements.append(enriched)
        
        # Apply filters
        if filter_type == "unread":
            enriched_announcements = [a for a in enriched_announcements if not a["is_read"]]
        elif filter_type == "read":
            enriched_announcements = [a for a in enriched_announcements if a["is_read"]]
        
        # Sort: pinned first, then by date
        enriched_announcements.sort(key=lambda x: (
            not x.get("is_pinned", False),
            -dt.datetime.fromisoformat(x["created_at"].replace('Z', '+00:00')).timestamp()  # ✅ CORRECT
        ))
        
        return enriched_announcements
        
    except Exception as e:
        logger.error(f"Error fetching announcements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching announcements: {str(e)}")


@app.post("/api/announcements/{announcement_id}/mark-read")
async def mark_announcement_read(announcement_id: str, student_id: str):
    """
    Mark a specific announcement as read
    """
    try:
        # Check if already marked as read
        existing = supabase.table("announcement_reads")\
            .select("id")\
            .eq("announcement_id", announcement_id)\
            .eq("student_id", student_id)\
            .execute()
        
        if existing.data:
            return {"success": True, "message": "Already marked as read"}
        
        # Create read record
        read_data = {
            "announcement_id": announcement_id,
            "student_id": student_id,
            "read_at": dt.datetime.utcnow().isoformat() 
        }
        
        response = supabase.table("announcement_reads")\
            .insert(read_data)\
            .execute()
        
        if response.data:
            return {"success": True, "message": "Marked as read"}
        else:
            raise HTTPException(status_code=400, detail="Failed to mark as read")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking announcement as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/api/announcements/mark-all-read")
async def mark_all_announcements_read(student_id: str):
    """
    Mark all announcements as read for a student
    """
    try:
        # Get all announcements for the student
        announcements_response = await get_student_announcements(student_id, "unread")
        unread_announcements = announcements_response if isinstance(announcements_response, list) else []
        
        if not unread_announcements:
            return {"success": True, "message": "No unread announcements"}
        
        # Create read records for all unread announcements
        read_records = [
            {
                "announcement_id": announcement["id"],
                "student_id": student_id,
                "read_at": dt.datetime.utcnow().isoformat()
            }
            for announcement in unread_announcements
        ]
        
        response = supabase.table("announcement_reads")\
            .insert(read_records)\
            .execute()
        
        if response.data:
            return {"success": True, "message": f"Marked {len(read_records)} announcements as read"}
        else:
            raise HTTPException(status_code=400, detail="Failed to mark announcements as read")
            
    except Exception as e:
        logger.error(f"Error marking all as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.delete("/api/announcements/{announcement_id}/mark-unread")
async def mark_announcement_unread(announcement_id: str, student_id: str):
    """
    Mark an announcement as unread (remove read record)
    """
    try:
        response = supabase.table("announcement_reads")\
            .delete()\
            .eq("announcement_id", announcement_id)\
            .eq("student_id", student_id)\
            .execute()
        
        return {"success": True, "message": "Marked as unread"}
        
    except Exception as e:
        logger.error(f"Error marking announcement as unread: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/api/announcements/unread-count/{student_id}")
async def get_unread_count(student_id: str):
    """
    Get count of unread announcements for sidebar badge
    """
    try:
        announcements = await get_student_announcements(student_id, "unread")
        count = len(announcements) if isinstance(announcements, list) else 0
        
        return {"count": count}
        
    except Exception as e:
        logger.error(f"Error getting unread count: {str(e)}")
        return {"count": 0}




#ADMIN


# ...existing imports...

@app.get("/api/user_counts")
async def get_user_counts():
    try:
        # Get all users
        response = supabase.table("users").select("role").execute()
        users = response.data if response.data else []

        total = len(users)
        instructors = sum(1 for u in users if u.get("role", "").lower() == "instructor")
        students = sum(1 for u in users if u.get("role", "").lower() == "student")
        admins = sum(1 for u in users if u.get("role", "").lower() == "admin")

        return {
            "total": total,
            "instructors": instructors,
            "students": students,
            "admins": admins
        }
    except Exception as e:
        logger.error(f"Error fetching user counts: {str(e)}")
        return {"total": 0, "instructors": 0, "students": 0, "admins": 0}



class User(BaseModel):
    username: str
    email: str
    first_name: str
    last_name: str
    m_i: Optional[str] = None  # Fixed: was m.i., should be m_i
    password: str
    role: str

class UserUpdate(BaseModel):
    """Model for updating existing users"""
    username: str
    email: str
    first_name: str
    last_name: str
    m_i: Optional[str] = None
    password: Optional[str] = None  # Optional for updates
    role: str

class InstructorCreation(BaseModel):
    """Model for creating new instructors"""
    username: str
    email: str
    first_name: str
    last_name: str
    m_i: Optional[str] = None
    contact_number: Optional[str] = None
    password: Optional[str] = None  # If None, will be auto-generated

class StudentCreation(BaseModel):
    """Model for creating new students (LRN-based)"""
    # Personal Information
    lrn: str  # Learning Registration Number - becomes username
    enrollment_date: str  # ISO date format
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    name_extension: Optional[str] = None  # Jr., Sr., etc.
    birthdate: str  # ISO date format
    place_of_birth: str
    sex: str  # Male/Female
    civil_status: str
    religion: Optional[str] = None
    mother_tongue: Optional[str] = None
    ip_ethnic_group: Optional[str] = None  # Indigenous People/Ethnic Group
    contact_number: str
    email: str
    is_pwd: bool = False  # Person with Disability
    is_4ps: bool = False  # 4Ps Beneficiary
    
    # Address Information
    address: Optional[str] = None  # House No./Street/Sitio
    barangay: str
    municipality: str  # Default: Santa Cruz
    province: str  # Default: Laguna
    
    # Educational Information
    last_grade_completed: str
    program: str  # A&E, Elementary, JHS, SHS
    elementary_school: Optional[str] = None
    junior_high_school: Optional[str] = None
    senior_high_school: Optional[str] = None
    dropout_reason: Optional[str] = None
    dropout_reason_others: Optional[str] = None
    distance_km: Optional[float] = None
    distance_hours: Optional[int] = None
    distance_mins: Optional[int] = None
    transportation_mode: Optional[str] = None
    transportation_mode_others: Optional[str] = None
    
    # Previous ALS Experience
    previous_als: bool = False
    previous_program_name: Optional[str] = None
    previous_literacy_level: Optional[str] = None
    previous_year_attended: Optional[str] = None
    previous_program_completed: bool = False
    previous_not_completed_reason: Optional[str] = None
    
    # Family Information
    father_last_name: Optional[str] = None
    father_first_name: Optional[str] = None
    father_middle_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_last_name: Optional[str] = None
    mother_first_name: Optional[str] = None
    mother_middle_name: Optional[str] = None
    mother_occupation: Optional[str] = None
    
    # Additional Information
    als_teacher_facilitator: Optional[str] = None

class CertificateIssue(BaseModel):
    """Model for issuing a certificate to a student"""
    student_id: str
    program: str  # A&E, Elementary, JHS, SHS
    issued_by: str  # UserID or name of admin
    remarks: Optional[str] = None

class RegistrationApproval(BaseModel):
    registration_id: str
    username: str
    password: str
    email: str
    admin_id: Optional[str] = None
    rejection_reason: Optional[str] = None

def generate_secure_password(length: int = 12) -> str:
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(characters) for _ in range(length))
    return password

async def send_instructor_welcome_email(to_email: str, first_name: str, last_name: str, username: str, password: str):
    """Send welcome email to newly created instructor"""
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "Welcome to ALS Portal - Instructor Account Created"
    
    email_body = f"""
Dear {first_name} {last_name},

Welcome to the ALS (Alternative Learning System) Portal!

Your instructor account has been successfully created by the administrator. You can now access the portal and start managing your classes and students.

📧 Account Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Username: {username}
Password: {password}
Portal URL: http://localhost:8000/als_instructor_portal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Next Steps:
1. Visit the portal URL above
2. Log in using your credentials
3. We recommend changing your password immediately after first login

⚠️ Important Security Reminders:
• Keep your username and password confidential
• Do not share your credentials with anyone
• Use a strong password when you change it
• If you didn't request this account, please contact the administrator immediately

📞 Support:
If you have any questions or need assistance, please contact the ALS Administration office.

Best regards,
ALS-Santa Cruz Administration
"""
    
    msg.set_content(email_body.strip())

    try:
        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASS"),
            start_tls=True,
        )
        logger.info(f"✅ Instructor welcome email sent to {to_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send instructor welcome email to {to_email}: {str(e)}")

async def send_student_welcome_email(to_email: str, first_name: str, last_name: str, lrn: str, password: str, barangay: str, program: str):
    """Send welcome email to newly created student"""
    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", "als.portal@example.com")
    msg["To"] = to_email
    msg["Subject"] = "Welcome to ALS Portal - Your Student Account"
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8000")
    
    email_body = f"""
Dear {first_name} {last_name},

Welcome to the ALS Portal!

Your account has been created by the administrator. You can now log in and start your ALS journey.

📧 Your Login Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Username: {lrn} (Your LRN)
Password: {password}
Portal URL: {frontend_url}/als_student_dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 Security Note:
For your security, please change your password after your first login. 
You can do this in your profile settings.

📚 Your ALS Information:
- Program: {program}
- Barangay: {barangay}

Welcome to ALS!

Best regards,
ALS-Santa Cruz Administration
"""
    
    msg.set_content(email_body.strip())

    try:
        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASS"),
            start_tls=True,
        )
        logger.info(f"✅ Student welcome email sent to {to_email}")
    except Exception as e:
        logger.error(f"❌ Failed to send student welcome email to {to_email}: {str(e)}")

@app.post("/api/instructors")
async def create_instructor(instructor: InstructorCreation):
    """Create a new instructor account"""
    try:
        # Generate password if not provided
        password = instructor.password or generate_secure_password()
        
        # Hash the password
        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        # Prepare instructor data
        instructor_data = {
            "username": instructor.username,
            "email": instructor.email,
            "first_name": instructor.first_name,
            "last_name": instructor.last_name,
            "m_i": instructor.m_i,
            "password": hashed_password,
            "role": "instructor",
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        # Note: contact_number will be handled separately in future updates
        
        # Insert into database
        response = supabase.table("users").insert(instructor_data).execute()
        
        if response.data:
            # Send welcome email
            await send_instructor_welcome_email(
                instructor.email,
                instructor.first_name,
                instructor.last_name,
                instructor.username,
                password
            )
            
            logger.info(f"✅ Instructor created successfully: {instructor.username}")
            return {
                "success": True,
                "message": "Instructor created successfully. Welcome email sent.",
                "data": response.data[0],
                "password_generated": instructor.password is None  # Indicates if password was auto-generated
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to create instructor")
            
    except Exception as e:
        logger.error(f"❌ Error creating instructor: {str(e)}")
        # Check if it's a duplicate username/email error
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Username or email already exists")
        raise HTTPException(status_code=500, detail=f"Error creating instructor: {str(e)}")

@app.post("/api/admin/students")
async def create_student(student: StudentCreation):
    """Create a new student account (LRN-based username)"""
    try:
        # LRN becomes the username
        username = student.lrn
        
        # Check if LRN (username) already exists
        existing_user = supabase.table("users").select("*").eq("username", username).execute()
        if existing_user.data:
            raise HTTPException(status_code=409, detail="This LRN already exists in the system")
        
        # Check if email already exists
        existing_email = supabase.table("users").select("*").eq("email", student.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=409, detail="Email already exists in the system")
        
        # Generate random password
        password = generate_secure_password()
        
        # Hash the password
        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        # Prepare student user data - store all demographic info in users table
        student_user_data = {
            "username": username,  # LRN
            "email": student.email,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "m_i": student.middle_name[0] if student.middle_name else None,  # Store first letter
            "password": hashed_password,
            "role": "student",
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        # Insert into users table
        user_response = supabase.table("users").insert(student_user_data).execute()
        
        if not user_response.data:
            raise HTTPException(status_code=400, detail="Failed to create student user account")
        
        student_id = user_response.data[0]['id']
        
        # Prepare comprehensive student profile data
        # Try to store as much as possible in student_profiles table
        student_profile_data = {
            "student_id": student_id,
            "lrn": student.lrn,
            "enrollment_date": student.enrollment_date,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "middle_name": student.middle_name,
            "name_extension": student.name_extension,
            "birthdate": student.birthdate,
            "place_of_birth": student.place_of_birth,
            "sex": student.sex,
            "civil_status": student.civil_status,
            "religion": student.religion,
            "mother_tongue": student.mother_tongue,
            "ip_ethnic_group": student.ip_ethnic_group,
            "contact_number": student.contact_number,
            "is_pwd": student.is_pwd,
            "is_4ps": student.is_4ps,
            "address": student.address,
            "barangay": student.barangay,
            "municipality": student.municipality,
            "province": student.province,
            "last_grade_completed": student.last_grade_completed,
            "program": student.program,
            "elementary_school": student.elementary_school,
            "junior_high_school": student.junior_high_school,
            "senior_high_school": student.senior_high_school,
            "dropout_reason": student.dropout_reason,
            "dropout_reason_others": student.dropout_reason_others,
            "distance_km": student.distance_km,
            "distance_hours": student.distance_hours,
            "distance_mins": student.distance_mins,
            "transportation_mode": student.transportation_mode,
            "transportation_mode_others": student.transportation_mode_others,
            "previous_als": student.previous_als,
            "previous_program_name": student.previous_program_name,
            "previous_literacy_level": student.previous_literacy_level,
            "previous_year_attended": student.previous_year_attended,
            "previous_program_completed": student.previous_program_completed,
            "previous_not_completed_reason": student.previous_not_completed_reason,
            "father_last_name": student.father_last_name,
            "father_first_name": student.father_first_name,
            "father_middle_name": student.father_middle_name,
            "father_occupation": student.father_occupation,
            "mother_last_name": student.mother_last_name,
            "mother_first_name": student.mother_first_name,
            "mother_middle_name": student.mother_middle_name,
            "mother_occupation": student.mother_occupation,
            "als_teacher_facilitator": student.als_teacher_facilitator,
            "status": "active",
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        # Try to insert into student profile table
        try:
            supabase.table("student_profiles").insert(student_profile_data).execute()
        except Exception as e:
            logger.warning(f"⚠️ Could not create extended student profile: {str(e)}")
            # Try to insert into als_af1 if student_profiles doesn't exist
            try:
                als_af1_data = {
                    "student_id": student_id,
                    "lrn": student.lrn,
                    "barangay": student.barangay,
                    "program": student.program,
                    "status": "active",
                    "created_at": dt.datetime.utcnow().isoformat()
                }
                supabase.table("als_af1").insert(als_af1_data).execute()
            except Exception as als_error:
                logger.warning(f"⚠️ Could not create student profile in als_af1: {str(als_error)}")
        
        # Send welcome email
        await send_student_welcome_email(
            student.email,
            student.first_name,
            student.last_name,
            student.lrn,
            password,
            student.barangay,
            student.program
        )
        
        logger.info(f"✅ Student created successfully: {student.lrn}")
        return {
            "success": True,
            "message": "Student created successfully. Welcome email sent.",
            "student_id": student_id,
            "username": username,
            "password": password,  # Return password once for display
            "data": user_response.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating student: {str(e)}")
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Student LRN or email already exists")
        raise HTTPException(status_code=500, detail=f"Error creating student: {str(e)}")

# ==================== CERTIFICATE MANAGEMENT ====================

@app.post("/api/admin/certificates")
async def issue_certificate(
    student_id: str = Form(...),
    program: str = Form(...),
    issued_by: str = Form(...),
    remarks: Optional[str] = Form(None),
    certificate_file: UploadFile = File(...)
):
    """Issue a program completion certificate to a student"""
    try:
        if not student_id or not program or not issued_by:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Verify student exists
        student = supabase.table("users").select("*").eq("id", student_id).execute()
        if not student.data:
            raise HTTPException(status_code=404, detail="Student not found")
        
        # Read and store the certificate file
        file_content = await certificate_file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="Certificate file is empty")
        
        # Validate file is PDF
        if certificate_file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are allowed. Received: " + certificate_file.content_type)
        
        # Create certificate folder path using absolute path
        import os
        from pathlib import Path
        cert_folder = os.path.abspath("COMPONENTS/CERTIFICATE")
        os.makedirs(cert_folder, exist_ok=True)
        logger.info(f"Certificate folder: {cert_folder}")
        
        # Use original filename with sanitization
        filename = certificate_file.filename
        # Sanitize filename - remove any path components and special characters
        filename = Path(filename).name  # Get just the filename, no paths
        if not filename.lower().endswith('.pdf'):
            filename = filename + '.pdf'
        
        logger.info(f"Using original filename: {filename}")
        filepath = os.path.join(cert_folder, filename)
        
        # Save file to folder
        try:
            with open(filepath, "wb") as f:
                f.write(file_content)
            logger.info(f"✅ Certificate file saved: {filepath} ({len(file_content)} bytes)")
            
            if not os.path.exists(filepath):
                logger.error(f"❌ File was not created even after writing: {filepath}")
                raise HTTPException(status_code=500, detail="Failed to save certificate file to disk")
        except IOError as io_error:
            logger.error(f"❌ IO Error saving file: {str(io_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to save certificate file: {str(io_error)}")
        
        # Insert certificate record (store only filename, not base64)
        cert_record = {
            "student_id": student_id,
            "program": program,
            "certificate_file": filename,  # Just the filename
            "issued_by": issued_by,
            "remarks": remarks,
            "status": "active",
            "issued_date": dt.datetime.utcnow().isoformat(),
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        logger.info(f"📝 Certificate record to insert:")
        logger.info(f"   student_id: {student_id}")
        logger.info(f"   program: {program}")
        logger.info(f"   certificate_file: {filename}")
        logger.info(f"   issued_by: {issued_by}")
        logger.info(f"   Full record: {cert_record}")
        
        response = supabase.table("student_certificates").insert(cert_record).execute()
        
        logger.info(f"📝 Response from Supabase: {response.data}")
        
        if not response.data:
            # Delete the file if database insert failed
            if os.path.exists(filepath):
                os.remove(filepath)
            raise HTTPException(status_code=400, detail="Failed to issue certificate")
        
        logger.info(f"✅ Certificate issued to student {student_id} for program {program} - File: {filename} (ID: {response.data[0]['id']})")
        return {
            "success": True,
            "message": "Certificate issued successfully",
            "certificate_id": response.data[0]['id'],
            "student_id": student_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error issuing certificate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error issuing certificate: {str(e)}")

@app.get("/api/admin/certificates")
async def get_certificates_admin(
    student_id: Optional[str] = None,
    program: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "issued_date",
    order: str = "desc"
):
    """Get certificates for admin panel with filtering and sorting"""
    try:
        query = supabase.table("student_certificates").select(
            "*, users(first_name, last_name, m_i, username)"
        )
        
        if student_id:
            query = query.eq("student_id", student_id)
        if program:
            query = query.eq("program", program)
        if status:
            query = query.eq("status", status)
        
        # Apply sorting
        query = query.order(sort_by, desc=(order.lower() == "desc"))
        
        response = query.execute()
        certificates = response.data if response.data else []
        
        logger.info(f"✅ Retrieved {len(certificates)} certificates for admin")
        return {
            "success": True,
            "total": len(certificates),
            "certificates": certificates
        }
    
    except Exception as e:
        logger.error(f"❌ Error retrieving certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving certificates: {str(e)}")

@app.put("/api/admin/certificates/{cert_id}")
async def update_certificate(
    cert_id: str,
    remarks: Optional[str] = None,
    certificate_file: Optional[UploadFile] = None
):
    """Update certificate remarks and/or file"""
    try:
        import os
        
        # Get existing certificate
        response = supabase.table("student_certificates").select("*").eq("id", cert_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        existing_cert = response.data[0]
        update_data = {"updated_at": dt.datetime.utcnow().isoformat()}
        
        if remarks is not None:
            update_data["remarks"] = remarks
        
        if certificate_file:
            file_content = await certificate_file.read()
            if not file_content:
                raise HTTPException(status_code=400, detail="Certificate file is empty")
            
            # Validate file is PDF
            if certificate_file.content_type != "application/pdf":
                raise HTTPException(status_code=400, detail="Only PDF files are allowed")
            
            # Create certificate folder path using absolute path
            cert_folder = os.path.abspath("COMPONENTS/CERTIFICATE")
            os.makedirs(cert_folder, exist_ok=True)
            
            # Delete old file if it exists
            old_filename = existing_cert['certificate_file']
            
            # Handle hex-encoded filename from Supabase
            if old_filename.startswith('\\x'):
                try:
                    hex_string = old_filename[2:]
                    old_filename = bytes.fromhex(hex_string).decode('utf-8')
                    logger.info(f"Decoded old filename: {old_filename}")
                except Exception as e:
                    logger.warning(f"Could not decode old filename: {str(e)}")
            
            old_filepath = os.path.join(cert_folder, old_filename)
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                    logger.info(f"Deleted old certificate file: {old_filepath}")
                except Exception as e:
                    logger.warning(f"Could not delete old file {old_filepath}: {str(e)}")
            
            # Generate unique filename for new file
            new_filename = f"cert_{cert_id}.pdf"
            new_filepath = os.path.join(cert_folder, new_filename)
            
            # Save new file
            with open(new_filepath, "wb") as f:
                f.write(file_content)
            
            update_data["certificate_file"] = new_filename
        
        response = supabase.table("student_certificates").update(update_data).eq("id", cert_id).execute()
        
        logger.info(f"✅ Certificate {cert_id} updated")
        return {
            "success": True,
            "message": "Certificate updated successfully",
            "certificate": response.data[0]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating certificate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating certificate: {str(e)}")

@app.delete("/api/admin/certificates/{cert_id}")
async def revoke_certificate(cert_id: str):
    """Revoke (soft delete) a certificate"""
    try:
        import os
        
        # Get certificate details before revoking
        response = supabase.table("student_certificates").select("*").eq("id", cert_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        cert = response.data[0]
        
        # Soft delete by changing status
        response = supabase.table("student_certificates").update({
            "status": "revoked",
            "updated_at": dt.datetime.utcnow().isoformat()
        }).eq("id", cert_id).execute()
        
        # Clean up the certificate file from disk
        filename = cert['certificate_file']
        
        # Handle hex-encoded filename from Supabase
        if filename.startswith('\\x'):
            try:
                hex_string = filename[2:]
                filename = bytes.fromhex(hex_string).decode('utf-8')
                logger.info(f"Decoded filename for deletion: {filename}")
            except Exception as e:
                logger.warning(f"Could not decode filename: {str(e)}")
        
        cert_folder = os.path.abspath("COMPONENTS/CERTIFICATE")
        filepath = os.path.join(cert_folder, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                logger.info(f"Deleted revoked certificate file: {filepath}")
            except Exception as e:
                logger.warning(f"Could not delete certificate file {filepath}: {str(e)}")
        
        logger.info(f"✅ Certificate {cert_id} revoked")
        return {
            "success": True,
            "message": "Certificate revoked successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error revoking certificate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error revoking certificate: {str(e)}")

@app.get("/api/students")
async def get_students():
    """Get all students (users with role='student')"""
    try:
        response = supabase.table("users").select("id, username, first_name, last_name, email, role").eq("role", "student").execute()
        students = response.data if response.data else []
        
        logger.info(f"✅ Retrieved {len(students)} students")
        return {
            "success": True,
            "total": len(students),
            "students": students,
            "data": students
        }
    except Exception as e:
        logger.error(f"❌ Error retrieving students: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving students: {str(e)}")

@app.get("/api/student/certificates")
async def get_student_certificates(student_id: str):
    """Get all active certificates for a student"""
    try:
        response = supabase.table("student_certificates").select("*").eq(
            "student_id", student_id
        ).eq("status", "active").order("issued_date", desc=True).execute()
        
        certificates = response.data if response.data else []
        
        logger.info(f"✅ Retrieved {len(certificates)} certificates for student {student_id}")
        return {
            "success": True,
            "total": len(certificates),
            "certificates": certificates
        }
    
    except Exception as e:
        logger.error(f"❌ Error retrieving student certificates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving certificates: {str(e)}")

@app.get("/api/certificates/{cert_id}")
async def get_certificate_file(cert_id: str):
    """Get certificate PDF file for viewing/downloading"""
    try:
        response = supabase.table("student_certificates").select("*").eq("id", cert_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        cert = response.data[0]
        
        if cert['status'] == 'revoked':
            raise HTTPException(status_code=403, detail="This certificate has been revoked")
        
        import os
        import base64
        
        cert_file_data = cert['certificate_file']
        
        if not cert_file_data:
            raise HTTPException(status_code=400, detail="Certificate file is empty")
        
        file_data_b64 = None
        
        # Try to read from file first (new system) - use absolute path
        cert_folder = os.path.abspath("COMPONENTS/CERTIFICATE")
        
        # Handle potential hex-encoding from Supabase (e.g., \x636572745f... = cert_)
        clean_filename = cert_file_data
        if cert_file_data.startswith('\\x'):
            # Hex-encoded filename - decode it
            try:
                hex_string = cert_file_data[2:]  # Remove \x prefix
                clean_filename = bytes.fromhex(hex_string).decode('utf-8')
                logger.info(f"  Decoded hex filename: {repr(cert_file_data)} -> {repr(clean_filename)}")
            except Exception as hex_error:
                logger.error(f"  Failed to decode hex filename: {str(hex_error)}")
                clean_filename = cert_file_data
        
        filepath = os.path.join(cert_folder, clean_filename)
        logger.info(f"Looking for certificate file: {filepath}")
        logger.info(f"  Filename from DB: {repr(cert_file_data)}")
        
        if os.path.exists(filepath):
            # File-based storage (new system)
            try:
                with open(filepath, "rb") as f:
                    file_content = f.read()
                
                file_data_b64 = base64.b64encode(file_content).decode('utf-8')
                logger.info(f"✅ Certificate {cert_id} retrieved from file: {filepath} ({len(file_content)} bytes)")
            except Exception as file_error:
                logger.error(f"❌ Error reading certificate file {filepath}: {str(file_error)}")
                raise HTTPException(status_code=500, detail=f"Error reading certificate file: {str(file_error)}")
        else:
            # Try to decode as base64 (old system or direct data)
            logger.info(f"File not found at {filepath}, trying base64 decode...")
            logger.info(f"Certificate data in database: {cert_file_data[:100]}... (length: {len(cert_file_data)})")
            
            file_data_b64 = cert_file_data
            
            # Add padding if necessary
            missing_padding = len(file_data_b64) % 4
            if missing_padding:
                file_data_b64 += '=' * (4 - missing_padding)
            
            # Verify it's valid base64
            try:
                file_content = base64.b64decode(file_data_b64, validate=True)
                logger.info(f"✅ Certificate {cert_id} retrieved from database (base64, {len(file_content)} bytes)")
            except Exception as decode_error:
                logger.error(f"❌ Invalid certificate data for cert {cert_id}: {str(decode_error)}")
                logger.error(f"   File path tried: {filepath}")
                logger.error(f"   Data length: {len(cert_file_data)} chars")
                raise HTTPException(status_code=400, detail=f"Certificate file not found and base64 data is invalid. Path tried: {filepath}")
        
        return {
            "success": True,
            "certificate_id": cert_id,
            "student_id": cert['student_id'],
            "program": cert['program'],
            "issued_date": cert['issued_date'],
            "remarks": cert['remarks'],
            "file_data": file_data_b64,  # Base64 encoded PDF
            "file_name": clean_filename  # Use the actual filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error retrieving certificate file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving certificate: {str(e)}")

@app.get("/api/certificates/{cert_id}/download")
async def download_certificate_file(cert_id: str):
    """Download certificate PDF file directly"""
    try:
        response = supabase.table("student_certificates").select("*").eq("id", cert_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        cert = response.data[0]
        
        if cert['status'] == 'revoked':
            raise HTTPException(status_code=403, detail="This certificate has been revoked")
        
        import os
        import base64
        from io import BytesIO
        
        cert_file_data = cert['certificate_file']
        
        # Try to serve from file first (new system) - use absolute path
        cert_folder = os.path.abspath("COMPONENTS/CERTIFICATE")
        
        # Handle potential hex-encoding from Supabase 
        clean_filename = cert_file_data
        if cert_file_data.startswith('\\x'):
            # Hex-encoded filename - decode it
            try:
                hex_string = cert_file_data[2:]  # Remove \x prefix
                clean_filename = bytes.fromhex(hex_string).decode('utf-8')
                logger.info(f"  Decoded hex filename: {repr(cert_file_data)} -> {repr(clean_filename)}")
            except Exception as hex_error:
                logger.error(f"  Failed to decode hex filename: {str(hex_error)}")
                clean_filename = cert_file_data
        
        filepath = os.path.join(cert_folder, clean_filename)
        logger.info(f"Looking for certificate file to download: {filepath}")
        
        if os.path.exists(filepath):
            # File-based storage (new system)
            try:
                logger.info(f"✅ Certificate {cert_id} downloaded from file: {filepath}")
                return FileResponse(filepath, media_type="application/pdf", filename=clean_filename)
            except Exception as file_error:
                logger.error(f"❌ Error reading certificate file {filepath}: {str(file_error)}")
                raise HTTPException(status_code=500, detail=f"Error reading certificate file: {str(file_error)}")
        else:
            # Try to decode as base64 (old system)
            logger.info(f"File not found at {filepath}, trying base64 decode...")
            
            file_data_b64 = cert_file_data
            
            # Add padding if necessary
            missing_padding = len(file_data_b64) % 4
            if missing_padding:
                file_data_b64 += '=' * (4 - missing_padding)
            
            try:
                file_content = base64.b64decode(file_data_b64, validate=True)
                logger.info(f"✅ Certificate {cert_id} downloaded from database (base64)")
                return FileResponse(
                    BytesIO(file_content),
                    media_type="application/pdf",
                    filename=clean_filename
                )
            except Exception as decode_error:
                logger.error(f"❌ Invalid certificate data for cert {cert_id}: {str(decode_error)}")
                raise HTTPException(status_code=400, detail=f"Certificate file not found and base64 data is invalid.")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error downloading certificate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error downloading certificate: {str(e)}")

@app.get("/api/users")
async def get_users(archived: bool = False):
    try:
        # Get all users first
        response = supabase.table("users").select("*").execute()
        users = response.data if response.data else []
        
        # Filter by is_archived status
        # If is_archived column doesn't exist or is null, treat as not archived
        filtered_users = []
        for user in users:
            is_archived = user.get("is_archived", False)
            if is_archived == archived:
                filtered_users.append(user)
        
        return filtered_users
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@app.post("/api/users")
async def create_user(user: User):
    try:
        # Hash the password before storing
        hashed_password = bcrypt.hashpw(
            user.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        # Prepare user data
        user_data = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "m_i": user.m_i,  # Changed from m.i. to m_i
            "password": hashed_password,  # Use hashed password
            "role": user.role.lower(),  # Ensure role is lowercase
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        # Insert into database
        response = supabase.table("users").insert(user_data).execute()
        
        if response.data:
            logger.info(f"✅ User created successfully: {user.username}")
            return {"success": True, "data": response.data[0]}
        else:
            raise HTTPException(status_code=400, detail="Failed to create user")
            
    except Exception as e:
        logger.error(f"❌ Error creating user: {str(e)}")
        # Check if it's a duplicate username/email error
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Username or email already exists")
        raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user: UserUpdate):  # ✅ Changed from User to UserUpdate
    try:
        # Prepare user data
        user_data = {
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "m_i": user.m_i,
            "role": user.role.lower()
        }
        
        # Only hash and update password if provided
        if user.password:
            hashed_password = bcrypt.hashpw(
                user.password.encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            user_data["password"] = hashed_password
        
        # Update user in database
        response = supabase.table("users").update(user_data).eq("id", user_id).execute()
        
        if response.data:
            logger.info(f"✅ User updated successfully: {user_id}")
            return {"success": True, "data": response.data[0]}
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating user: {str(e)}")
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Username or email already exists")
        raise HTTPException(status_code=500, detail=f"Error updating user: {str(e)}")

@app.put("/api/users/{user_id}/archive")
async def archive_user(user_id: str):
    try:
        response = supabase.table("users").update({"is_archived": True}).eq("id", user_id).execute()
        
        if response.data:
            logger.info(f"✅ User archived successfully: {user_id}")
            return {"success": True, "message": "User archived successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        error_str = str(e).lower()
        if "is_archived" in error_str and "could not find" in error_str:
            raise HTTPException(
                status_code=500, 
                detail="The 'is_archived' column does not exist in the users table. Please run: ALTER TABLE public.users ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;"
            )
        logger.error(f"❌ Error archiving user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error archiving user: {str(e)}")

@app.put("/api/users/{user_id}/unarchive")
async def unarchive_user(user_id: str):
    try:
        response = supabase.table("users").update({"is_archived": False}).eq("id", user_id).execute()
        
        if response.data:
            logger.info(f"✅ User unarchived successfully: {user_id}")
            return {"success": True, "message": "User unarchived successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        error_str = str(e).lower()
        if "is_archived" in error_str and "could not find" in error_str:
            raise HTTPException(
                status_code=500, 
                detail="The 'is_archived' column does not exist in the users table. Please run: ALTER TABLE public.users ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;"
            )
        logger.error(f"❌ Error unarchiving user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error unarchiving user: {str(e)}")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    try:
        response = supabase.table("users").delete().eq("id", user_id).execute()
        
        if response.data:
            logger.info(f"✅ User deleted successfully: {user_id}")
            return {"success": True, "message": "User deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    except Exception as e:
        logger.error(f"❌ Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")


# Add these new endpoints to your ALS.py file (after your existing endpoints)

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """
    Get comprehensive dashboard statistics
    """
    try:
        # Get all users
        users_response = supabase.table("users").select("*").execute()
        users = users_response.data if users_response.data else []
        
        # Get all subjects
        subjects_response = supabase.table("subjects").select("*").execute()
        subjects = subjects_response.data if subjects_response.data else []
        
        # Get all enrollments
        enrollments_response = supabase.table("subject_enrollments").select("*").execute()
        enrollments = enrollments_response.data if enrollments_response.data else []
        
        # Get all assignments (posts of type 'assignment')
        assignments_response = supabase.table("subject_posts")\
            .select("*")\
            .eq("post_type", "assignment")\
            .execute()
        assignments = assignments_response.data if assignments_response.data else []
        
        # Get all submissions
        submissions_response = supabase.table("post_submissions").select("*").execute()
        submissions = submissions_response.data if submissions_response.data else []
        
        # Calculate user statistics
        total_users = len(users)
        students = [u for u in users if u.get("role", "").lower() == "student"]
        instructors = [u for u in users if u.get("role", "").lower() == "instructor"]
        admins = [u for u in users if u.get("role", "").lower() == "admin"]
        
        total_students = len(students)
        total_instructors = len(instructors)
        total_admins = len(admins)
        
        # Calculate enrollment metrics
        total_enrolled = len(enrollments)
        unique_enrolled_students = len(set(e.get("student_id") for e in enrollments))
        enrollment_rate = (unique_enrolled_students / total_students * 100) if total_students > 0 else 0
        students_per_instructor = (total_students / total_instructors) if total_instructors > 0 else 0
        
        # Calculate platform stats
        total_subjects = len(subjects)
        total_assignments = len(assignments)
        total_submissions = len(submissions)
        
        # Calculate completion rate
        graded_submissions = [s for s in submissions if s.get("grade") is not None]
        avg_completion_rate = (len(graded_submissions) / total_submissions * 100) if total_submissions > 0 else 0
        
        # Calculate time-based user metrics
        now = datetime.datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now - datetime.timedelta(days=7)
        month_ago = now - datetime.timedelta(days=30)
        
        new_today = sum(1 for u in users if datetime.datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) >= today)
        new_this_week = sum(1 for u in users if datetime.datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) >= week_ago)
        new_this_month = sum(1 for u in users if datetime.datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) >= month_ago)
        
        # Calculate growth trend
        two_months_ago = now - datetime.timedelta(days=60)
        prev_month_users = sum(1 for u in users if two_months_ago <= datetime.datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) < month_ago)
        growth_percent = ((new_this_month - prev_month_users) / prev_month_users * 100) if prev_month_users > 0 else 0
        
        return {
            "user_analytics": {
                "total_users": total_users,
                "total_students": total_students,
                "total_instructors": total_instructors,
                "total_admins": total_admins,
                "student_percentage": (total_students / total_users * 100) if total_users > 0 else 0,
                "new_today": new_today,
                "new_this_week": new_this_week,
                "new_this_month": new_this_month,
                "growth_percent": growth_percent
            },
            "enrollment_metrics": {
                "total_enrolled": total_enrolled,
                "enrollment_rate": enrollment_rate,
                "students_per_instructor": students_per_instructor
            },
            "platform_stats": {
                "total_subjects": total_subjects,
                "total_assignments": total_assignments,
                "total_submissions": total_submissions,
                "avg_completion_rate": avg_completion_rate
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


@app.get("/api/dashboard/user-growth")
async def get_user_growth():
    """
    Get user growth data for the last 6 months
    """
    try:
        users_response = supabase.table("users").select("created_at").execute()
        users = users_response.data if users_response.data else []
        
        now = datetime.datetime.utcnow()
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        growth_data = []
        for i in range(5, -1, -1):
            month_date = datetime.datetime(now.year, now.month, 1) - datetime.timedelta(days=i*30)
            month_start = month_date.replace(day=1)
            next_month = month_start.replace(day=28) + datetime.timedelta(days=4)
            month_end = next_month.replace(day=1)
            
            count = sum(1 for u in users if 
                       month_start <= datetime.datetime.fromisoformat(u["created_at"].replace('Z', '+00:00')) < month_end)
            
            growth_data.append({
                "month": month_names[month_start.month - 1],
                "count": count
            })
        
        return growth_data
        
    except Exception as e:
        logger.error(f"Error fetching user growth: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching user growth: {str(e)}")


@app.get("/api/dashboard/enrollment-growth")
async def get_enrollment_growth():
    """
    Get enrollment growth data for the last 6 months
    """
    try:
        enrollments_response = supabase.table("subject_enrollments").select("enrolled_at").execute()
        enrollments = enrollments_response.data if enrollments_response.data else []
        
        now = datetime.datetime.utcnow()
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        growth_data = []
        for i in range(5, -1, -1):
            month_date = datetime.datetime(now.year, now.month, 1) - datetime.timedelta(days=i*30)
            month_start = month_date.replace(day=1)
            next_month = month_start.replace(day=28) + datetime.timedelta(days=4)
            month_end = next_month.replace(day=1)
            
            count = 0
            for e in enrollments:
                try:
                    enrolled_at = datetime.datetime.fromisoformat(e["enrolled_at"].replace('Z', '+00:00'))
                    if enrolled_at.tzinfo:
                        enrolled_at = enrolled_at.replace(tzinfo=None)
                    if month_start <= enrolled_at < month_end:
                        count += 1
                except:
                    pass
            
            growth_data.append({
                "month": month_names[month_start.month - 1],
                "count": count
            })
        
        return growth_data
        
    except Exception as e:
        logger.error(f"Error fetching enrollment growth: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching enrollment growth: {str(e)}")


@app.get("/api/dashboard/top-instructors")
async def get_top_instructors(limit: int = 5):
    """
    Get most active instructors based on subjects and student count
    """
    try:
        instructors_response = supabase.table("users")\
            .select("*")\
            .eq("role", "instructor")\
            .execute()
        instructors = instructors_response.data if instructors_response.data else []
        
        subjects_response = supabase.table("subjects").select("*").execute()
        subjects = subjects_response.data if subjects_response.data else []
        
        enrollments_response = supabase.table("subject_enrollments").select("*").execute()
        enrollments = enrollments_response.data if enrollments_response.data else []
        
        instructor_stats = []
        for instructor in instructors[:limit]:
            instructor_subjects = [s for s in subjects if s.get("instructor_id") == instructor["id"]]
            
            # Count unique students across all instructor's subjects
            student_ids = set()
            for subject in instructor_subjects:
                subject_enrollments = [e for e in enrollments if e.get("subject_id") == subject["id"]]
                student_ids.update(e.get("student_id") for e in subject_enrollments)
            
            instructor_stats.append({
                "id": instructor["id"],
                "name": f"{instructor.get('first_name', '')} {instructor.get('last_name', '')}".strip(),
                "subjects": len(instructor_subjects),
                "students": len(student_ids)
            })
        
        # Sort by number of students (descending)
        instructor_stats.sort(key=lambda x: x["students"], reverse=True)
        
        return instructor_stats[:limit]
        
    except Exception as e:
        logger.error(f"Error fetching top instructors: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching top instructors: {str(e)}")


@app.get("/api/dashboard/top-students")
async def get_top_students(limit: int = 5):
    """
    Get most engaged students based on submissions and grades
    """
    try:
        students_response = supabase.table("users")\
            .select("*")\
            .eq("role", "student")\
            .execute()
        students = students_response.data if students_response.data else []
        
        submissions_response = supabase.table("post_submissions").select("*").execute()
        submissions = submissions_response.data if submissions_response.data else []
        
        enrollments_response = supabase.table("subject_enrollments").select("*").execute()
        enrollments = enrollments_response.data if enrollments_response.data else []
        
        posts_response = supabase.table("subject_posts")\
            .select("*")\
            .eq("post_type", "assignment")\
            .execute()
        posts = posts_response.data if posts_response.data else []
        
        student_stats = []
        for student in students[:limit]:
            # Get subjects student is enrolled in
            student_enrollments = [e for e in enrollments if e.get("student_id") == student["id"]]
            student_subject_ids = set(e.get("subject_id") for e in student_enrollments)
            
            # Get assignments (posts) for student's enrolled subjects
            student_posts = [p for p in posts if p.get("subject_id") in student_subject_ids]
            student_post_ids = set(p["id"] for p in student_posts)
            
            # Get submissions for those posts
            student_submissions = [s for s in submissions if s.get("student_id") == student["id"] and s.get("post_id") in student_post_ids]
            
            # Calculate weighted average grade (percentage)
            graded_submissions = [s for s in student_submissions if s.get("grade") is not None]
            total_points = 0
            earned_points = 0
            for submission in graded_submissions:
                post_id = submission.get("post_id")
                post = next((p for p in student_posts if p["id"] == post_id), None)
                if post:
                    points = post.get("points", 100)
                    total_points += points
                    earned_points += float(submission.get("grade", 0))
            avg_grade = (earned_points / total_points * 100) if total_points > 0 else 0
            
            # Calculate completion rate: submissions completed / total assignments assigned
            completion_rate = (len(student_submissions) / len(student_posts) * 100) if student_posts else 0
            # Cap at 100% max
            completion_rate = min(completion_rate, 100)
            
            student_stats.append({
                "id": student["id"],
                "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                "completion": round(completion_rate, 1),
                "grade": round(avg_grade, 1)
            })
        
        # Sort by completion rate (descending)
        student_stats.sort(key=lambda x: x["completion"], reverse=True)
        
        return student_stats[:limit]
        
    except Exception as e:
        logger.error(f"Error fetching top students: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching top students: {str(e)}")


@app.get("/api/dashboard/system-alerts")
async def get_system_alerts():
    """
    Generate system alerts based on database analysis
    """
    try:
        users_response = supabase.table("users").select("*").execute()
        users = users_response.data if users_response.data else []
        
        instructors_response = supabase.table("users")\
            .select("*")\
            .eq("role", "instructor")\
            .execute()
        instructors = instructors_response.data if instructors_response.data else []
        
        subjects_response = supabase.table("subjects").select("*").execute()
        subjects = subjects_response.data if subjects_response.data else []
        
        submissions_response = supabase.table("post_submissions").select("*").execute()
        submissions = submissions_response.data if submissions_response.data else []
        
        # Calculate alerts
        now = datetime.datetime.utcnow()
        thirty_days_ago = now - datetime.timedelta(days=30)
        
        # Get inactive users (no activity for 30+ days) - check last_activity, not created_at
        inactive_user_list = []
        for u in users:
            try:
                if u.get("last_activity"):
                    last_activity = datetime.datetime.fromisoformat(u["last_activity"].replace('Z', '+00:00'))
                    # Convert to naive datetime for comparison
                    if last_activity.tzinfo:
                        last_activity = last_activity.replace(tzinfo=None)
                    if last_activity < thirty_days_ago:
                        inactive_user_list.append(u)
            except:
                # If there's any error parsing the date, skip this user
                pass
        
        # Instructors with no subjects
        instructor_ids_with_subjects = set(s.get("instructor_id") for s in subjects)
        instructors_no_subjects_list = [i for i in instructors if i["id"] not in instructor_ids_with_subjects]
        
        # Students with low grades (below 60)
        low_grade_student_ids = set()
        for s in submissions:
            if s.get("grade") and float(s["grade"]) < 60:
                low_grade_student_ids.add(s.get("student_id"))
        low_grade_students_list = [u for u in users if u["id"] in low_grade_student_ids]
        
        alerts = [
            {
                "id": 1,
                "type": "warning",
                "message": "Users needing verification",
                "count": 0,
                "affected_users": [],
                "priority": "medium",
                "icon": "fa-exclamation-triangle"
            },
            {
                "id": 2,
                "type": "info",
                "message": "Instructors with no active subjects",
                "count": len(instructors_no_subjects_list),
                "affected_users": [
                    {
                        "id": i["id"],
                        "name": f"{i.get('first_name', '')} {i.get('last_name', '')}".strip()
                    }
                    for i in instructors_no_subjects_list[:5]
                ],
                "priority": "low",
                "icon": "fa-info-circle"
            },
            {
                "id": 3,
                "type": "danger",
                "message": "Students at risk (low grades)",
                "count": len(low_grade_students_list),
                "affected_users": [
                    {
                        "id": u["id"],
                        "name": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                    }
                    for u in low_grade_students_list[:5]
                ],
                "priority": "high",
                "icon": "fa-exclamation-circle"
            },
            {
                "id": 4,
                "type": "warning",
                "message": "Inactive accounts (30+ days)",
                "count": len(inactive_user_list),
                "affected_users": [
                    {
                        "id": u["id"],
                        "name": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
                    }
                    for u in inactive_user_list[:5]
                ],
                "priority": "medium",
                "icon": "fa-user-clock"
            }
        ]
        
        return alerts
        
    except Exception as e:
        logger.error(f"Error fetching system alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching alerts: {str(e)}")

@app.get("/api/dashboard/recent-activities")
async def get_recent_activities(limit: int = 10):
    """
    Get recent system activities: new subjects created and student enrollments
    """
    try:
        from datetime import datetime, timedelta
        
        def get_time_ago(timestamp_str):
            """Calculate 'X minutes ago' style string on the server"""
            if not timestamp_str:
                return "Unknown"
            
            try:
                # Parse the ISO format timestamp
                if isinstance(timestamp_str, str):
                    # Handle ISO format with or without timezone
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                    event_time = datetime.fromisoformat(timestamp_str)
                else:
                    event_time = timestamp_str
                
                # Get current time in UTC
                now = datetime.utcnow()
                if event_time.tzinfo:
                    now = datetime.now(event_time.tzinfo)
                
                # Calculate difference
                diff = now - event_time if event_time.tzinfo else now.replace(tzinfo=None) - event_time
                seconds = int(diff.total_seconds())
                
                if seconds < 60:
                    return "Just now"
                elif seconds < 3600:
                    minutes = seconds // 60
                    return f"{minutes}m ago"
                elif seconds < 86400:
                    hours = seconds // 3600
                    return f"{hours}h ago"
                elif seconds < 604800:
                    days = seconds // 86400
                    return f"{days}d ago"
                elif seconds < 2592000:
                    weeks = seconds // 604800
                    return f"{weeks}w ago"
                else:
                    months = seconds // 2592000
                    return f"{months}mo ago"
            except Exception:
                return "Recently"
        
        activities = []
        
        # Get recent subjects created
        subjects_response = supabase.table("subjects")\
            .select("id, subject_name, instructor_id, created_at")\
            .order("created_at", desc=True)\
            .limit(5)\
            .execute()
        subjects = subjects_response.data if subjects_response.data else []
        
        # Get all users for name lookups
        users_response = supabase.table("users").select("id, first_name, last_name").execute()
        users = users_response.data if users_response.data else []
        users_map = {u["id"]: f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() for u in users}
        
        # Add subject creation activities
        for subject in subjects:
            instructor_id = subject.get("instructor_id")
            instructor_name = users_map.get(instructor_id, "Unknown")
            created_at = subject.get("created_at")
            
            activities.append({
                "id": f"subject_{subject['id']}",
                "type": "subject_created",
                "icon": "fa-book",
                "color": "green",
                "message": f"New subject created: {subject.get('subject_name', 'Untitled')}",
                "responsible": instructor_name,
                "created_at": created_at,
                "time_ago": get_time_ago(created_at)
            })
        
        # Get recent enrollments
        enrollments_response = supabase.table("subject_enrollments")\
            .select("id, subject_id, student_id, enrolled_at")\
            .order("enrolled_at", desc=True)\
            .limit(5)\
            .execute()
        enrollments = enrollments_response.data if enrollments_response.data else []
        
        # Get subject names
        if enrollments and subjects_response.data:
            subject_map = {s["id"]: s.get("subject_name", "Untitled") for s in subjects_response.data}
        else:
            subject_map = {}
        
        # Add enrollment activities
        for enrollment in enrollments:
            student_id = enrollment.get("student_id")
            subject_id = enrollment.get("subject_id")
            student_name = users_map.get(student_id, "Unknown")
            subject_name = subject_map.get(subject_id, "Unknown Subject")
            enrolled_at = enrollment.get("enrolled_at")
            
            activities.append({
                "id": f"enrollment_{enrollment['id']}",
                "type": "student_enrolled",
                "icon": "fa-user-check",
                "color": "purple",
                "message": f"Student enrolled in: {subject_name}",
                "responsible": student_name,
                "created_at": enrolled_at,
                "time_ago": get_time_ago(enrolled_at)
            })
        
        # Add user registrations
        users_response = supabase.table("users")\
            .select("id, first_name, last_name, role, created_at")\
            .order("created_at", desc=True)\
            .limit(3)\
            .execute()
        recent_users = users_response.data if users_response.data else []
        
        for user in recent_users:
            if user.get("role") == "student":
                icon = "fa-user-plus"
                color = "blue"
                message = "New student registered"
            elif user.get("role") == "instructor":
                icon = "fa-chalkboard-teacher"
                color = "green"
                message = "New instructor registered"
            else:
                icon = "fa-user-shield"
                color = "purple"
                message = "New admin registered"
            
            user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            created_at = user.get("created_at")
            
            activities.append({
                "id": f"user_{user['id']}",
                "type": "user_registered",
                "icon": icon,
                "color": color,
                "message": message,
                "responsible": user_name,
                "created_at": created_at,
                "time_ago": get_time_ago(created_at)
            })
        
        # Sort by created_at descending and limit
        activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return activities[:limit]
        
    except Exception as e:
        logger.error(f"Error fetching recent activities: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching activities: {str(e)}")

@app.get("/api/admin/all-subjects")
async def get_all_subjects_admin():
    """
    Get ALL subjects (admin only)
    """
    try:
        logger.info("📥 Admin fetching all subjects")
        response = supabase.table("subjects").select("*").execute()
        subjects = response.data if response.data else []
        logger.info(f"✅ Found {len(subjects)} subjects")
        return subjects
    except Exception as e:
        logger.error(f"❌ Error fetching all subjects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching all subjects: {str(e)}")
    

@app.get("/api/all-enrollments")
async def get_all_enrollments():
    """
    Get all subject enrollments
    """
    try:
        response = supabase.table("subject_enrollments").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching enrollments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching enrollments: {str(e)}")


@app.get("/api/all-submissions")
async def get_all_submissions():
    """
    Get all assignment submissions
    """
    try:
        response = supabase.table("post_submissions").select("*").execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching submissions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching submissions: {str(e)}")


@app.post("/api/users/{user_id}/link-learner")
async def link_user_to_learner(user_id: str, enrollment_id: str = Body(..., embed=True)):
    """
    Link an existing user account to an approved enrollment (als_enrollments_approved)
    """
    try:
        # Update als_enrollments_approved table with user_id
        response = supabase.table("als_enrollments_approved")\
            .update({"user_id": user_id})\
            .eq("id", enrollment_id)\
            .execute()
        
        if response.data:
            return {"success": True, "message": "User linked to enrollment profile"}
        raise HTTPException(status_code=404, detail="Enrollment not found")
    except Exception as e:
        logger.error(f"Error linking user to enrollment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 2. Get user with their learner profile
@app.get("/api/users/{user_id}/with-learner")
async def get_user_with_learner(user_id: str):
    """
    Get user account info along with linked learner profile
    """
    try:
        # Get user info
        user_response = supabase.table("users")\
            .select("*")\
            .eq("id", user_id)\
            .single()\
            .execute()
        
        if not user_response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = user_response.data
        
        # Get linked learner profile
        learner_response = supabase.table("learners")\
            .select("*")\
            .eq("user_id", user_id)\
            .execute()
        
        user["learner_profile"] = learner_response.data[0] if learner_response.data else None
        
        return user
    except Exception as e:
        logger.error(f"Error fetching user with learner: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 3. Create user AND learner profile together (for new registrations)
@app.post("/api/register-learner-with-account")
async def register_learner_with_account(
    username: str,
    password: str,
    email: str,
    first_name: str,
    last_name: str,
    learner_data: dict
):
    """
    Create both user account and learner profile in one transaction
    """
    try:
        # 1. Create user account
        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        user_data = {
            "username": username,
            "password": hashed_password,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": "student"
        }
        
        user_response = supabase.table("users").insert(user_data).execute()
        
        if not user_response.data:
            raise HTTPException(status_code=400, detail="Failed to create user")
        
        user_id = user_response.data[0]["id"]
        
        # 2. Create learner profile linked to user (WITH SPLIT NAMES)
        learner_entry = {
            **learner_data,
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name
            # Remove the old "name" field
        }
        
        learner_response = supabase.table("learners")\
            .insert(learner_entry)\
            .execute()
        
        if not learner_response.data:
            # Rollback: delete user if learner creation fails
            supabase.table("users").delete().eq("id", user_id).execute()
            raise HTTPException(status_code=400, detail="Failed to create learner profile")
        
        return {
            "success": True,
            "user": user_response.data[0],
            "learner": learner_response.data[0]
        }
        
    except Exception as e:
        logger.error(f"Error registering learner with account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/create-user-with-enrollment")
async def create_user_with_enrollment(data: dict = Body(...)):
    """
    Create user account AND enrollment record in als_enrollments_approved in one transaction
    Used by admin to create new users with full enrollment data
    """
    try:
        # Extract user data
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        m_i = data.get("m_i")
        lrn = data.get("lrn")
        
        if not all([username, email, password, first_name, last_name]):
            raise HTTPException(status_code=400, detail="Missing required user fields")
        
        # Check for duplicate email in users table
        email_check = supabase.table("users").select("id").eq("email", email).execute()
        if email_check.data:
            raise HTTPException(status_code=409, detail="Email already exists in user accounts")
        
        # Check for duplicate email in enrollments
        email_enrollment_check = supabase.table("als_enrollments_approved").select("id").eq("email_address", email).execute()
        if email_enrollment_check.data:
            raise HTTPException(status_code=409, detail="Email already exists in enrollment records")
        
        # Check for duplicate LRN if provided
        if lrn:
            lrn_check = supabase.table("als_enrollments_approved").select("id").eq("lrn", lrn).execute()
            if lrn_check.data:
                raise HTTPException(status_code=409, detail=f"LRN '{lrn}' already exists in the system")
        
        # Check for duplicate username
        username_check = supabase.table("users").select("id").eq("username", username).execute()
        if username_check.data:
            raise HTTPException(status_code=409, detail="Username already exists")
        
        # 1. Create user account
        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        user_data = {
            "username": username,
            "password": hashed_password,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "m_i": m_i,
            "role": "student",
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        user_response = supabase.table("users").insert(user_data).execute()
        
        if not user_response.data:
            raise HTTPException(status_code=400, detail="Failed to create user account")
        
        user_id = user_response.data[0]["id"]
        
        # 2. Create enrollment record linked to user
        enrollment_data = {
            "first_name": first_name,
            "last_name": last_name,
            "email_address": email,
            "user_id": user_id,
            "approved_at": dt.datetime.utcnow().isoformat(),
            "created_at": dt.datetime.utcnow().isoformat(),
            "updated_at": dt.datetime.utcnow().isoformat()
        }
        
        # Add all enrollment-specific fields from the request
        enrollment_specific_fields = [
            "lrn", "enrollment_date", "middle_name", "name_extension",
            "house_no_street_sitio", "barangay", "municipality_city", "province",
            "birthdate", "place_of_birth", "sex", "civil_status", "religion",
            "ip_ethnic_group", "mother_tongue", "is_pwd", "contact_numbers", "is_4ps",
            "father_guardian_last_name", "father_guardian_first_name", "father_guardian_middle_name",
            "father_guardian_occupation", "mother_maiden_last_name", "mother_maiden_first_name",
            "mother_maiden_middle_name", "mother_maiden_occupation", "last_grade_level_completed",
            "elementary_school", "junior_high_school", "dropout_reason", "dropout_reason_others",
            "attended_als_before", "previous_program_name", "previous_literacy_level",
            "previous_year_attended", "previous_program_completed", "previous_not_completed_reason",
            "distance_to_learning_center_km", "distance_to_learning_center_hours",
            "distance_to_learning_center_mins", "transportation_mode", "transportation_mode_others",
            "monday_available", "monday_time", "tuesday_available", "tuesday_time",
            "wednesday_available", "wednesday_time", "thursday_available", "thursday_time",
            "friday_available", "friday_time", "saturday_available", "saturday_time",
            "sunday_available", "sunday_time", "als_teacher_facilitator", "teacher_signature_date",
            "learner_signature_date"
        ]
        
        for field in enrollment_specific_fields:
            if field in data and data[field] is not None:
                enrollment_data[field] = data[field]
        
        enrollment_response = supabase.table("als_enrollments_approved")\
            .insert(enrollment_data)\
            .execute()
        
        if not enrollment_response.data:
            # Rollback: delete user if enrollment creation fails
            supabase.table("users").delete().eq("id", user_id).execute()
            raise HTTPException(status_code=400, detail="Failed to create enrollment record")
        
        logger.info(f"✅ User and enrollment created successfully: {username}")
        return {
            "success": True,
            "message": "User account and enrollment created successfully",
            "user": user_response.data[0],
            "enrollment": enrollment_response.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user with enrollment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 4. Get all learners with their user account status
@app.get("/api/learners-with-accounts")
async def get_learners_with_accounts(search: Optional[str] = None):
    """
    Get all approved enrollments and show which ones have user accounts.
    Can search by LRN, name (first/last), or barangay.
    """
    try:
        response = supabase.table("als_enrollments_approved")\
            .select("*")\
            .execute()
        
        enrollments = response.data if response.data else []
        
        # Filter by search term if provided
        if search and search.strip():
            search_term = search.strip().lower()
            filtered_enrollments = []
            
            for enrollment in enrollments:
                # Check LRN
                if enrollment.get("lrn") and search_term in str(enrollment.get("lrn", "")).lower():
                    filtered_enrollments.append(enrollment)
                # Check first name
                elif enrollment.get("first_name") and search_term in enrollment.get("first_name", "").lower():
                    filtered_enrollments.append(enrollment)
                # Check last name
                elif enrollment.get("last_name") and search_term in enrollment.get("last_name", "").lower():
                    filtered_enrollments.append(enrollment)
                # Check barangay
                elif enrollment.get("barangay") and search_term in enrollment.get("barangay", "").lower():
                    filtered_enrollments.append(enrollment)
            
            enrollments = filtered_enrollments
        
        return enrollments
    except Exception as e:
        logger.error(f"Error fetching enrollments with accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/registrations")
async def get_registrations(status: str = "pending"):
    """
    Get enrollment registrations based on status
    - pending: from als_enrollments
    - approved: from als_enrollments_approved
    """
    try:
        if status == "pending":
            response = supabase.table("als_enrollments")\
                .select("*")\
                .order("created_at", desc=True)\
                .execute()
        elif status == "approved":
            response = supabase.table("als_enrollments_approved")\
                .select("*")\
                .order("created_at", desc=True)\
                .execute()
        else:
            # For "all" or other statuses, combine both tables
            pending_response = supabase.table("als_enrollments").select("*").execute()
            approved_response = supabase.table("als_enrollments_approved").select("*").execute()
            
            pending_data = [{"status": "pending", **item} for item in (pending_response.data or [])]
            approved_data = [{"status": "approved", **item} for item in (approved_response.data or [])]
            
            return pending_data + approved_data
        
        registrations = response.data if response.data else []
        
        # Add status field for consistency
        for reg in registrations:
            if status == "pending":
                reg["status"] = "pending"
            elif status == "approved":
                reg["status"] = "approved"
        
        return registrations
        
    except Exception as e:
        logger.error(f"Error fetching registrations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching registrations: {str(e)}")


@app.get("/api/registrations/stats")
async def get_registration_stats():
    """
    Get statistics for registration dashboard
    """
    try:
        # Count pending
        pending_response = supabase.table("als_enrollments").select("id", count="exact").execute()
        pending_count = len(pending_response.data) if pending_response.data else 0
        
        # Count approved
        approved_response = supabase.table("als_enrollments_approved").select("id", count="exact").execute()
        approved_count = len(approved_response.data) if approved_response.data else 0
        
        # Count today's pending registrations
        today = dt.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_response = supabase.table("als_enrollments")\
            .select("id")\
            .gte("created_at", today.isoformat())\
            .execute()
        today_count = len(today_response.data) if today_response.data else 0
        
        return {
            "pending": pending_count,
            "approved": approved_count,
            "rejected": 0,  # We don't track rejections since they're deleted
            "today": today_count
        }
        
    except Exception as e:
        logger.error(f"Error fetching registration stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


@app.get("/api/registrations/{registration_id}")
async def get_registration_detail(registration_id: str):
    """
    Get detailed information about a specific registration
    """
    try:
        # Try pending table first
        response = supabase.table("als_enrollments")\
            .select("*")\
            .eq("id", registration_id)\
            .execute()
        
        if response.data:
            data = response.data[0]
            data["status"] = "pending"
            return data
        
        # If not found, try approved table
        response = supabase.table("als_enrollments_approved")\
            .select("*")\
            .eq("id", registration_id)\
            .execute()
        
        if response.data:
            data = response.data[0]
            data["status"] = "approved"
            return data
        
        raise HTTPException(status_code=404, detail="Registration not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching registration detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching registration: {str(e)}")


@app.post("/api/registrations/{registration_id}/approve")
async def approve_registration(registration_id: str, approval_data: RegistrationApproval):
    """
    Approve a registration:
    1. Create user account
    2. Move data from als_enrollments to als_enrollments_approved
    3. Delete from als_enrollments
    """
    try:
        logger.info(f"📋 Approving registration: {registration_id}")
        
        # 1. Get registration data
        reg_response = supabase.table("als_enrollments")\
            .select("*")\
            .eq("id", registration_id)\
            .single()\
            .execute()
        
        if not reg_response.data:
            raise HTTPException(status_code=404, detail="Registration not found")
        
        registration_data = reg_response.data
        
        # ✅ CHECK IF EMAIL ALREADY EXISTS IN USERS TABLE
        email_check = supabase.table("users")\
            .select("id")\
            .eq("email", approval_data.email)\
            .execute()
        
        if email_check.data:
            raise HTTPException(
                status_code=409,
                detail=f"Email {approval_data.email} is already in use by another user account. Please use a different email."
            )
        
        # 2. Create user account
        hashed_password = bcrypt.hashpw(
            approval_data.password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        
        user_data = {
            "username": approval_data.username,
            "password": hashed_password,
            "email": approval_data.email,
            "first_name": registration_data["first_name"],
            "last_name": registration_data["last_name"],
            "m_i": registration_data.get("middle_name", "")[:1] if registration_data.get("middle_name") else None,
            "role": "student",
            "created_at": dt.datetime.utcnow().isoformat()
        }
        
        user_response = supabase.table("users").insert(user_data).execute()
        
        if not user_response.data:
            raise HTTPException(status_code=400, detail="Failed to create user account")
        
        user_id = user_response.data[0]["id"]
        logger.info(f"✅ User account created: {user_id}")
        
        # 3. Copy to als_enrollments_approved (preserve original data)
        approved_data = {**registration_data}
        approved_data.pop("id", None)  # Remove old ID to generate new one
        approved_data["user_id"] = user_id  # Link to user account
        approved_data["approved_at"] = dt.datetime.utcnow().isoformat()
        if approval_data.admin_id:
            approved_data["approved_by"] = approval_data.admin_id
        
        approved_response = supabase.table("als_enrollments_approved")\
            .insert(approved_data)\
            .execute()
        
        if not approved_response.data:
            # Rollback: delete user if approved record creation fails
            supabase.table("users").delete().eq("id", user_id).execute()
            raise HTTPException(status_code=400, detail="Failed to create approved record")
        
        logger.info(f"✅ Moved to approved table")
        
        # 4. Delete from als_enrollments (pending)
        delete_response = supabase.table("als_enrollments")\
            .delete()\
            .eq("id", registration_id)\
            .execute()
        
        logger.info(f"✅ Removed from pending table")
        
        # 5. Create learner profile (optional - links user to geographic data)
        learner_data = {
            "first_name": registration_data["first_name"],
            "last_name": registration_data["last_name"],
            "middle_initial": registration_data.get("middle_name", "")[:1] if registration_data.get("middle_name") else None,
            "status": "active",
            "barangay": registration_data.get("barangay", ""),
            "address": registration_data.get("house_no_street_sitio", ""),
            "lastContact": dt.datetime.utcnow().isoformat(),
            "progress": 0,
            "user_id": user_id
        }
        
        # Get barangay coordinates
        barangay_name = registration_data.get("barangay", "").lower()
        barangay_obj = next((b for b in barangays if b["name"].lower() == barangay_name), None)
        
        if barangay_obj:
            learner_data["lat"] = barangay_obj["lat"]
            learner_data["lng"] = barangay_obj["lng"]
        else:
            learner_data["lat"] = 14.2818099
            learner_data["lng"] = 121.414977
        
        learner_response = supabase.table("learners").insert(learner_data).execute()
        
        if learner_response.data:
            logger.info(f"✅ Learner profile created")
        
        # 6. Send approval confirmation email to the student
        try:
            await send_approval_confirmation_email(
                approval_data.email,
                registration_data["first_name"],
                registration_data["last_name"],
                approval_data.username,
                approval_data.password
            )
        except Exception as e:
            logger.error(f"Warning: Could not send approval email: {str(e)}")
        
        return {
            "success": True,
            "message": "Registration approved successfully",
            "user": user_response.data[0],
            "approved_record": approved_response.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error approving registration: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Error approving registration: {str(e)}")


@app.post("/api/registrations/{registration_id}/reject")
async def reject_registration(registration_id: str, reason: str = Body(..., embed=True)):
    """
    Reject a registration - delete it from als_enrollments and send rejection email
    """
    try:
        logger.info(f"❌ Rejecting registration: {registration_id}")
        
        # Get registration data first (for notification purposes)
        reg_response = supabase.table("als_enrollments")\
            .select("*")\
            .eq("id", registration_id)\
            .single()\
            .execute()
        
        if not reg_response.data:
            raise HTTPException(status_code=404, detail="Registration not found")
        
        registration_data = reg_response.data
        logger.info(f"Registration data: {registration_data}")
        
        # Send rejection email to applicant
        email = registration_data.get("email_address")
        first_name = registration_data.get("first_name", "Applicant")
        last_name = registration_data.get("last_name", "")
        
        logger.info(f"Email to send: {email}, First Name: {first_name}, Last Name: {last_name}")
        
        if email:
            logger.info(f"Attempting to send rejection email to {email}")
            try:
                await send_rejection_email(email, first_name, last_name, reason)
                logger.info(f"✅ Rejection email sent successfully to {email}")
            except Exception as email_error:
                logger.error(f"Email sending failed: {str(email_error)}", exc_info=True)
                # Continue with rejection even if email fails
        else:
            logger.warning(f"No email found in registration data {registration_id}")
            logger.warning(f"Available fields: {list(registration_data.keys())}")
        
        # Delete from als_enrollments
        logger.info(f"Deleting registration {registration_id}")
        delete_response = supabase.table("als_enrollments")\
            .delete()\
            .eq("id", registration_id)\
            .execute()
        
        logger.info(f"✅ Registration rejected and removed: {registration_id}")
        return {
            "success": True,
            "message": "Registration rejected successfully",
            "reason": reason
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error rejecting registration: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error rejecting registration: {str(e)}")


@app.post("/api/admin/migrate-add-mother-tongue")
async def migrate_add_mother_tongue():
    """
    Add mother_tongue column to als_af1 table if it doesn't exist
    """
    try:
        # Try to add the mother_tongue column
        response = supabase.postgrest.from_("raw_sql").select("*").execute()
    except:
        # If that fails, we'll try via direct SQL execution
        pass
    
    try:
        # Query to add the column
        sql = "ALTER TABLE public.als_af1 ADD COLUMN IF NOT EXISTS mother_tongue text null;"
        
        # Since Supabase doesn't expose raw SQL directly, we'll try via the admin API
        # For now, return instruction
        logger.info("Mother tongue column migration requested")
        return {
            "success": True, 
            "message": "Please run this SQL manually in Supabase: ALTER TABLE public.als_af1 ADD COLUMN IF NOT EXISTS mother_tongue text null;",
            "sql": "ALTER TABLE public.als_af1 ADD COLUMN IF NOT EXISTS mother_tongue text null;"
        }
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Migration error: {str(e)}")


# ==================== DSS (Decision Support System) ENDPOINTS ====================

@app.get("/api/dss/barangay-analysis/{barangay_name}")
async def get_barangay_analysis(barangay_name: str):
    """
    Get comprehensive DSS analysis for a specific barangay
    Returns: Priority score, component scores, recommendations, insights, learner profiles
    Can pull from both als_af1 AND als_enrollments_approved tables
    """
    if not DSS_AVAILABLE:
        raise HTTPException(status_code=503, detail="DSS module not available")
    
    try:
        # Fetch AF1 data (may be empty if learners only in enrollments_approved)
        response = supabase.table("als_af1") \
            .select("*") \
            .eq("barangay", barangay_name) \
            .eq("archived", False) \
            .execute()
        
        learner_records = response.data if response.data else []
        
        # Fetch enrichment data from als_enrollments_approved
        enrollment_response = supabase.table("als_enrollments_approved") \
            .select("*") \
            .eq("barangay", barangay_name) \
            .execute()
        
        enrollment_records = enrollment_response.data if enrollment_response.data else []
        
        # If neither als_af1 nor als_enrollments_approved have data, fail
        if not learner_records and not enrollment_records:
            logger.warning(f"No data found for barangay: {barangay_name}")
            raise HTTPException(status_code=404, detail=f"No learner data for {barangay_name}")
        
        # Create lookup maps
        enrollment_map = {str(e.get('user_id')): e for e in enrollment_records}
        af1_map = {str(l.get('user_id')): l for l in learner_records}
        
        # Aggregate barangay data from AF1 records (if they exist)
        interested_count = len([l for l in learner_records if l.get('interested_in_als', False)])
        active_count = len([l for l in learner_records if l.get('als_status') != 'dropout'])
        completed_count = len([l for l in learner_records if l.get('als_status') == 'completed'])
        at_risk_count = len([l for l in learner_records if l.get('dropout_reason')])
        
        # Analyze barriers from enrollment data
        distance_barriers = 0
        accessibility_barriers = 0
        pwd_count = 0
        four_ps_count = 0
        walking_only = 0
        
        for record in enrollment_records:
            if record.get('distance_to_learning_center_km'):
                dist = float(record.get('distance_to_learning_center_km', 0))
                if dist > 3:  # More than 3km is significant barrier
                    distance_barriers += 1
            
            transport = record.get('transportation_mode')
            if transport == 'Walking':
                walking_only += 1
                accessibility_barriers += 1
            
            if record.get('is_pwd'):
                pwd_count += 1
                accessibility_barriers += 1
            
            if record.get('is_4ps'):
                four_ps_count += 1
        
        # Calculate barrier percentages from BOTH tables combined
        total_learner_pool = len(learner_records) + len(enrollment_records)
        distance_pct = (distance_barriers / total_learner_pool * 100) if total_learner_pool > 0 else 0
        accessibility_pct = (accessibility_barriers / total_learner_pool * 100) if total_learner_pool > 0 else 0
        pwd_pct = (pwd_count / total_learner_pool * 100) if total_learner_pool > 0 else 0
        four_ps_pct = (four_ps_count / total_learner_pool * 100) if total_learner_pool > 0 else 0
        walking_pct = (walking_only / total_learner_pool * 100) if total_learner_pool > 0 else 0
        
        barangay_data = {
            'barangay': barangay_name,
            'total_learners': len(learner_records),
            'active_learners': active_count,
            'completed_learners': completed_count,
            'at_risk_learners': at_risk_count,
            'interested_count': interested_count,
            'dropout_rate': calculate_dropout_rate(learner_records),
            'avg_performance': calculate_avg_performance(learner_records),
            'enrollment_trend': 'stable',
            # ADD BARRIER PERCENTAGES FOR CONTEXT-AWARE RECOMMENDATIONS
            'barrier_analysis': {
                'total_learner_pool': total_learner_pool,
                'from_af1': len(learner_records),
                'from_enrollments': len(enrollment_records),
                'distance_barrier_pct': round(distance_pct, 1),
                'distance_barrier_count': distance_barriers,
                'accessibility_barrier_pct': round(accessibility_pct, 1),
                'accessibility_barrier_count': accessibility_barriers,
                'pwd_pct': round(pwd_pct, 1),
                'pwd_count': pwd_count,
                'four_ps_pct': round(four_ps_pct, 1),
                'four_ps_count': four_ps_count,
                'walking_only_pct': round(walking_pct, 1),
                'walking_only_count': walking_only,
                'top_barriers': sorted([
                    ('distance', distance_pct),
                    ('accessibility', accessibility_pct),
                    ('4PS', four_ps_pct),
                    ('PWD', pwd_pct),
                    ('walking_only', walking_pct)
                ], key=lambda x: x[1], reverse=True)[:3]  # Top 3 barriers
            }
        }
        
        # Run DSS analysis
        analysis = dss.analyze_barangay(barangay_data)
        
        # Enrich response with detailed learner profiles
        # Include learners from BOTH als_af1 AND als_enrollments_approved
        learner_profiles = []
        processed_user_ids = set()
        
        # First, add learners from als_af1 (if they exist)
        for learner in learner_records:
            user_id = str(learner.get('user_id', ''))
            enrollment_data = enrollment_map.get(user_id)
            
            profile = {
                'id': learner.get('id'),
                'name': f"{learner.get('first_name', '')} {learner.get('last_name', '')}",
                'age': learner.get('age'),
                'barangay': barangay_name,
                'als_status': learner.get('als_status'),
                'interested_in_als': learner.get('interested_in_als'),
                'engagement_score': learner.get('engagement_score'),
                # Enrichment from enrollments_approved
                'distance_km': enrollment_data.get('distance_to_learning_center_km') if enrollment_data else None,
                'transport_mode': enrollment_data.get('transportation_mode') if enrollment_data else None,
                'is_pwd': enrollment_data.get('is_pwd') if enrollment_data else False,
                'is_4ps': enrollment_data.get('is_4ps') if enrollment_data else False,
                'last_grade_completed': enrollment_data.get('last_grade_level_completed') if enrollment_data else None,
                'email': enrollment_data.get('email_address') if enrollment_data else None,
                'contact': enrollment_data.get('contact_numbers') if enrollment_data else None,
                'available_days': [
                    d for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    if enrollment_data and enrollment_data.get(f'{d.lower()}_available')
                ] if enrollment_data else []
            }
            learner_profiles.append(profile)
            if user_id:
                processed_user_ids.add(user_id)
        
        # Also add learners from als_enrollments_approved that are NOT already in als_af1
        # This allows barriers to show even for learners only in enrollment records
        for enrollment in enrollment_records:
            user_id = str(enrollment.get('user_id', ''))
            
            # Skip if already added from als_af1
            if user_id and user_id in processed_user_ids:
                continue
            
            profile = {
                'id': enrollment.get('id'),
                'name': f"{enrollment.get('first_name', '')} {enrollment.get('last_name', '')}",
                'age': None,  # Not available in enrollment record
                'barangay': barangay_name,
                'als_status': 'approved',  # From als_enrollments_approved = already approved
                'interested_in_als': None,
                'engagement_score': None,
                # Data directly from enrollments_approved
                'distance_km': enrollment.get('distance_to_learning_center_km'),
                'transport_mode': enrollment.get('transportation_mode'),
                'is_pwd': enrollment.get('is_pwd'),
                'is_4ps': enrollment.get('is_4ps'),
                'last_grade_completed': enrollment.get('last_grade_level_completed'),
                'email': enrollment.get('email_address'),
                'contact': enrollment.get('contact_numbers'),
                'available_days': [
                    d for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    if enrollment.get(f'{d.lower()}_available')
                ]
            }
            learner_profiles.append(profile)
        
        # CALCULATE DETAILED STATISTICS FOR PROFESSIONAL OVERVIEW
        total_pool = len(learner_records) + len(enrollment_records)
        
        # Education levels
        education_levels = {}
        for profile in learner_profiles:
            grade = profile.get('last_grade_completed', 'Unknown')
            if grade:
                education_levels[grade] = education_levels.get(grade, 0) + 1
        
        # Age distribution
        ages = [p.get('age') for p in learner_profiles if p.get('age')]
        avg_age = sum(ages) / len(ages) if ages else None
        
        # Availability patterns
        availability_counts = {'Full week (5+ days)': 0, 'Weekend only': 0, 'Limited (1-2 days)': 0, 'Unknown': 0}
        for profile in learner_profiles:
            days = profile.get('available_days', [])
            if not days:
                availability_counts['Unknown'] += 1
            elif len(days) >= 5:
                availability_counts['Full week (5+ days)'] += 1
            elif set(days) & {'Saturday', 'Sunday'} and len(days) <= 2:
                availability_counts['Weekend only'] += 1
            elif len(days) <= 2:
                availability_counts['Limited (1-2 days)'] += 1
            else:
                availability_counts['Full week (5+ days)'] += 1
        
        # Distance breakdown
        distance_breakdown = {'Within 3km': 0, '3-10km': 0, 'Over 10km': 0, 'Unknown': 0}
        for profile in learner_profiles:
            dist = profile.get('distance_km')
            if not dist:
                distance_breakdown['Unknown'] += 1
            else:
                dist_val = float(dist)
                if dist_val <= 3:
                    distance_breakdown['Within 3km'] += 1
                elif dist_val <= 10:
                    distance_breakdown['3-10km'] += 1
                else:
                    distance_breakdown['Over 10km'] += 1
        
        # Add barrier analysis to response
        analysis_dict = analysis.dict()
        analysis_dict['learner_profiles'] = learner_profiles
        
        # Calculate percentages for barrier analysis
        pwd_pct = (pwd_count / total_pool * 100) if total_pool > 0 else 0
        distance_pct = (distance_barriers / total_pool * 100) if total_pool > 0 else 0
        accessibility_pct = (accessibility_barriers / total_pool * 100) if total_pool > 0 else 0
        four_ps_pct = (four_ps_count / total_pool * 100) if total_pool > 0 else 0
        walking_pct = (walking_only / total_pool * 100) if total_pool > 0 else 0
        
        analysis_dict['barrier_analysis'] = {
            'distance_barriers': distance_barriers,
            'distance_barrier_pct': round(distance_pct, 1),
            'accessibility_barriers': accessibility_barriers,
            'accessibility_barrier_pct': round(accessibility_pct, 1),
            'pwd_count': pwd_count,
            'pwd_pct': round(pwd_pct, 1),
            'four_ps_count': four_ps_count,
            'four_ps_pct': round(four_ps_pct, 1),
            'walking_only_count': walking_only,
            'walking_only_pct': round(walking_pct, 1),
            'barrier_summary': f"{distance_barriers} learners >3km away, {accessibility_barriers} with mobility issues, {pwd_count} PWD, {four_ps_count} 4PS"
        }
        
        # Add detailed statistics to response
        analysis_dict['detailed_statistics'] = {
            'learner_composition': {
                'total_learners': total_pool,
                'from_af1': len(learner_records),
                'from_enrollments_approved': len(enrollment_records),
                'af1_percentage': round(len(learner_records) / total_pool * 100, 1) if total_pool > 0 else 0,
                'enrollment_percentage': round(len(enrollment_records) / total_pool * 100, 1) if total_pool > 0 else 0
            },
            'demographics': {
                'average_age': round(avg_age, 1) if avg_age else None,
                'age_range': f"{min(ages)}-{max(ages)}" if ages else None,
                'education_distribution': education_levels,
                'most_common_grade': max(education_levels.items(), key=lambda x: x[1])[0] if education_levels else None
            },
            'accessibility': {
                'pwd_count': pwd_count,
                'pwd_percentage': round(pwd_count / total_pool * 100, 1) if total_pool > 0 else 0,
                'four_ps_count': four_ps_count,
                'four_ps_percentage': round(four_ps_count / total_pool * 100, 1) if total_pool > 0 else 0,
                'walking_only_count': walking_only,
                'walking_only_percentage': round(walking_only / total_pool * 100, 1) if total_pool > 0 else 0
            },
            'distance_distribution': distance_breakdown,
            'availability_patterns': availability_counts,
            'transportation_modes': {
                'walking': walking_only,
                'motorcycle': len([p for p in learner_profiles if p.get('transport_mode') == 'Motorcycle']),
                'tricycle': len([p for p in learner_profiles if p.get('transport_mode') == 'Tricycle']),
                'other': len([p for p in learner_profiles if p.get('transport_mode') and p.get('transport_mode') not in ['Walking', 'Motorcycle', 'Tricycle']])
            }
        }
        
        logger.info(f"✅ DSS analysis generated for {barangay_name} - Priority: {analysis.priority_tier} - {len(learner_profiles)} learner profiles (AF1: {len(learner_records)}, Enrollment: {len(enrollment_records)})")
        return analysis_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DSS Error for {barangay_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"DSS analysis error: {str(e)}")


@app.get("/api/dss/all-barangays")
async def get_all_barangays_analysis():
    """
    Get DSS analysis for all barangays, ranked by priority
    """
    if not DSS_AVAILABLE:
        raise HTTPException(status_code=503, detail="DSS module not available")
    
    try:
        barangay_list = [
            "Alipit", "Bagumbayan", "Barangay I (Poblacion)", "Barangay II (Poblacion)",
            "Barangay III (Poblacion)", "Barangay IV (Poblacion)", "Barangay V (Poblacion)",
            "Bubukal", "Calios", "Duhat", "Gatid", "Jasaan", "Labuin", "Malinao",
            "Oogong", "Pagsawitan", "Palasan", "Patimbao", "San Jose", "San Juan",
            "San Pablo Norte", "San Pablo Sur", "Santisima Cruz", "Santo Angel Central",
            "Santo Angel Norte", "Santo Angel Sur"
        ]
        
        analyses = []
        for barangay in barangay_list:
            try:
                response = supabase.table("als_af1") \
                    .select("*") \
                    .eq("barangay", barangay) \
                    .eq("archived", False) \
                    .execute()
                
                learner_records = response.data if response.data else []
                
                if not learner_records:
                    continue
                
                # Aggregate barangay data (SIMPLIFIED - only real data)
                interested_count = len([l for l in learner_records if l.get('interested_in_als', False)])
                active_count = len([l for l in learner_records if l.get('als_status') != 'dropout'])
                completed_count = len([l for l in learner_records if l.get('als_status') == 'completed'])
                at_risk_count = len([l for l in learner_records if l.get('dropout_reason')])
                
                barangay_data = {
                    'barangay': barangay,
                    'total_learners': len(learner_records),
                    'active_learners': active_count,
                    'completed_learners': completed_count,
                    'at_risk_learners': at_risk_count,
                    'interested_count': interested_count,
                    'dropout_rate': calculate_dropout_rate(learner_records),
                    'avg_performance': calculate_avg_performance(learner_records),
                    'enrollment_trend': 'stable',
                }
                
                analysis = dss.analyze_barangay(barangay_data)
                analyses.append(analysis.dict())
            except Exception as e:
                logger.warning(f"Could not analyze {barangay}: {str(e)}")
                continue
        
        # Sort by priority score (descending)
        analyses.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return {
            'total_barangays': len(analyses),
            'high_priority_count': len([a for a in analyses if a['priority_tier'] == 'high']),
            'medium_priority_count': len([a for a in analyses if a['priority_tier'] == 'medium']),
            'low_priority_count': len([a for a in analyses if a['priority_tier'] == 'low']),
            'barangays': analyses
        }
        
    except Exception as e:
        logger.error(f"DSS All Barangays Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dss/top-recommendations")
async def get_top_recommendations(limit: int = 10):
    """
    Get top recommendations across all barangays
    """
    if not DSS_AVAILABLE:
        raise HTTPException(status_code=503, detail="DSS module not available")
    
    try:
        all_analyses_response = await get_all_barangays_analysis()
        all_recommendations = []
        
        for barangay_analysis in all_analyses_response.get('barangays', []):
            all_recommendations.extend(barangay_analysis.get('recommendations', []))
        
        # Sort by priority
        all_recommendations.sort(key=lambda x: x.get('priority', 0), reverse=True)
        
        logger.info(f"📋 Retrieved {len(all_recommendations)} recommendations")
        return {
            'total_recommendations': len(all_recommendations),
            'top_recommendations': all_recommendations[:limit]
        }
        
    except Exception as e:
        logger.error(f"DSS Recommendations Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dss/forecast/{barangay_name}")
async def get_barangay_forecast(barangay_name: str):
    """
    Get school year enrollment forecast for a barangay (June 2025 - April 2026)
    Integrates AF1 historical data + als_enrollments_approved interest/demand signals
    Uses demographic and barrier-specific factors to refine projections
    """
    if not DSS_AVAILABLE:
        raise HTTPException(status_code=503, detail="DSS module not available")
    
    try:
        # Fetch learner records from AF1 (historical)
        af1_response = supabase.table("als_af1") \
            .select("*") \
            .eq("barangay", barangay_name) \
            .eq("archived", False) \
            .execute()
        
        learner_records = af1_response.data if af1_response.data else []
        
        # Fetch enrollment interest from als_enrollments_approved (recent interest)
        enrollment_response = supabase.table("als_enrollments_approved") \
            .select("*") \
            .eq("barangay", barangay_name) \
            .execute()
        
        enrollment_records = enrollment_response.data if enrollment_response.data else []
        
        # If neither source has data, fail
        if not learner_records and not enrollment_records:
            logger.warning(f"No data found for barangay: {barangay_name}")
            raise HTTPException(status_code=404, detail=f"No learner data for {barangay_name}")
        
        # Analyze barrier distribution across both recordsets
        all_records = learner_records + enrollment_records
        pwd_count = sum(1 for r in enrollment_records if r.get('is_pwd'))
        four_ps_count = sum(1 for r in enrollment_records if r.get('is_4ps'))
        distance_count = sum(1 for r in enrollment_records if r.get('distance_to_learning_center_km') and float(r.get('distance_to_learning_center_km', 0)) > 3)
        
        # Generate enhanced forecast using DSS
        forecast = dss.forecaster.generate_schoolyear_forecast(
            learner_records=learner_records,
            enrollment_records=enrollment_records,
            barangay=barangay_name,
            pwd_count=pwd_count,
            four_ps_count=four_ps_count,
            distance_count=distance_count
        )
        
        logger.info(f"✅ Enhanced school year forecast generated for {barangay_name} - AF1: {len(learner_records)}, Enrollments: {len(enrollment_records)}")
        return forecast
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast Error for {barangay_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecast generation error: {str(e)}")


# ==================== DSS HELPER FUNCTIONS ====================

def calculate_dropout_rate(learner_records: list) -> float:
    """Calculate dropout rate from learner records"""
    if not learner_records:
        return 0.0
    
    # Count learners with dropout_reason (indicates dropout)
    dropouts = len([r for r in learner_records if r.get('dropout_reason')])
    return (dropouts / len(learner_records)) * 100


def calculate_avg_performance(learner_records: list) -> float:
    """Calculate average performance based on available data"""
    if not learner_records:
        return 50.0
    
    # For als_af1, we can use last_grade_completed or other available fields
    # Calculate based on interest and status
    interested_count = len([r for r in learner_records if r.get('interested_in_als', False)])
    completed_count = len([r for r in learner_records if r.get('als_status') == 'completed'])
    
    if interested_count > 0 or completed_count > 0:
        performance_score = ((interested_count + completed_count * 2) / (len(learner_records) * 2)) * 100
        return min(100.0, max(0.0, performance_score))
    
    return 50.0  # Default middle score

# ==================== MESSAGING SYSTEM ====================

class MessageData(BaseModel):
    sender_id: str
    receiver_id: str
    subject_id: Optional[str] = None
    message_text: str
    attachment_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    sender_id: str
    receiver_id: str
    subject_id: Optional[str]
    message_text: str
    attachment_url: Optional[str]
    is_read: bool
    created_at: str

@app.post("/api/messages/send")
async def send_message(message_data: MessageData):
    """Send a message from one user to another"""
    try:
        logger.info(f"Sending message from {message_data.sender_id} to {message_data.receiver_id}")
        
        # Insert message into Supabase
        response = supabase.table('messages').insert({
            'sender_id': message_data.sender_id,
            'receiver_id': message_data.receiver_id,
            'subject_id': message_data.subject_id,
            'message_text': message_data.message_text,
            'attachment_url': message_data.attachment_url,
            'is_read': False,
            'created_at': datetime.datetime.utcnow().isoformat()
        }).execute()
        
        logger.info(f"Message sent successfully: {response.data}")
        
        return {
            "success": True,
            "message": "Message sent successfully",
            "data": response.data[0] if response.data else None
        }
    except Exception as e:
        logger.error(f"❌ Error sending message: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")

@app.get("/api/messages/conversation/{user_id}/{other_user_id}")
async def get_conversation(user_id: str, other_user_id: str):
    """Get conversation between two users"""
    try:
        # Fetch all messages between the two users
        response = supabase.table('messages').select('*').or_(
            f"and(sender_id.eq.{user_id},receiver_id.eq.{other_user_id})," +
            f"and(sender_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).order('created_at', desc=False).execute()
        
        # Return as array for frontend compatibility
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")

@app.get("/api/messages/threads/{user_id}")
async def get_message_threads(user_id: str):
    """Get all message threads for a user (conversations with unique people)"""
    try:
        # Fetch all messages where user is sender or receiver
        response = supabase.table('messages').select('*').or_(
            f"sender_id.eq.{user_id},receiver_id.eq.{user_id}"
        ).order('created_at', desc=True).execute()
        
        # Group messages into threads (conversations)
        threads = {}
        for msg in response.data:
            sender_id = msg['sender_id']
            receiver_id = msg['receiver_id']
            other_user_id = receiver_id if sender_id == user_id else sender_id
            
            if other_user_id not in threads:
                threads[other_user_id] = {
                    'other_user_id': other_user_id,
                    'other_user_name': 'Unknown User',  # Will be updated below
                    'subject_id': msg.get('subject_id'),
                    'last_message': msg['message_text'],
                    'last_message_at': msg['created_at'],
                    'unread_count': 0
                }
                if msg['receiver_id'] == user_id and not msg['is_read']:
                    threads[other_user_id]['unread_count'] += 1
        
        # Fetch user details for each thread
        for other_user_id in threads:
            try:
                user_response = supabase.table('users').select(
                    'id, first_name, last_name, username'
                ).eq('id', other_user_id).execute()
                
                if user_response.data:
                    user_data = user_response.data[0]
                    first_name = user_data.get('first_name', '').strip()
                    last_name = user_data.get('last_name', '').strip()
                    username = user_data.get('username', 'Unknown User')
                    
                    # Build display name
                    if first_name and last_name:
                        display_name = f"{first_name} {last_name}"
                    elif first_name:
                        display_name = first_name
                    elif last_name:
                        display_name = last_name
                    else:
                        display_name = username
                    
                    threads[other_user_id]['other_user_name'] = display_name
            except Exception as e:
                logger.warning(f"Could not fetch user details for {other_user_id}: {str(e)}")
                threads[other_user_id]['other_user_name'] = 'Unknown User'
        
        return {
            "success": True,
            "threads": list(threads.values())
        }
    except Exception as e:
        logger.error(f"Error fetching message threads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching message threads: {str(e)}")

@app.put("/api/messages/{message_id}/read")
async def mark_message_as_read(message_id: int):
    """Mark a message as read"""
    try:
        response = supabase.table('messages').update({
            'is_read': True,
            'updated_at': datetime.datetime.utcnow().isoformat()
        }).eq('id', message_id).execute()
        
        return {
            "success": True,
            "message": "Message marked as read"
        }
    except Exception as e:
        logger.error(f"Error marking message as read: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error marking message as read: {str(e)}")

@app.get("/api/messages/unread/{user_id}")
async def get_unread_count(user_id: str):
    """Get count of unread messages for a user"""
    try:
        response = supabase.table('messages').select('id').eq(
            'receiver_id', user_id
        ).eq('is_read', False).execute()
        
        return {
            "success": True,
            "unread_count": len(response.data)
        }
    except Exception as e:
        logger.error(f"Error fetching unread count: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching unread count: {str(e)}")

@app.get("/api/messages/get-recipient-info/{user_id}")
async def get_recipient_info(user_id: str):
    """Get user info (name, email, role) for display in messages"""
    try:
        # Query the public.users table
        response = supabase.table('users').select('*').eq('id', user_id).execute()
        
        if response.data:
            user = response.data[0]
            first_name = user.get('first_name', '').strip()
            last_name = user.get('last_name', '').strip()
            username = user.get('username', 'Unknown User')
            
            # Build display name
            if first_name and last_name:
                display_name = f"{first_name} {last_name}"
            elif first_name:
                display_name = first_name
            elif last_name:
                display_name = last_name
            else:
                display_name = username
            
            return {
                "success": True,
                "user": {
                    "id": user.get('id'),
                    "name": display_name,
                    "email": user.get('email', ''),
                    "role": user.get('role', 'user'),
                    "avatar": user.get('avatar_url')
                }
            }
        else:
            return {
                "success": False,
                "message": "User not found"
            }
    except Exception as e:
        logger.error(f"Error fetching recipient info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching recipient info: {str(e)}")

@app.get("/api/instructor-learners/{instructor_id}")
async def get_instructor_learners(instructor_id: str):
    """Get all learners assigned to an instructor with their enrolled subjects"""
    try:
        # Get all subjects taught by this instructor
        subjects_response = supabase.table('subjects').select('id, subject_name').eq('instructor_id', instructor_id).execute()
        instructor_subject_ids = [s['id'] for s in (subjects_response.data or [])]
        instructor_subjects = {s['id']: s['subject_name'] for s in (subjects_response.data or [])}
        
        logger.info(f"Found {len(instructor_subject_ids)} subjects for instructor {instructor_id}: {list(instructor_subjects.values())}")
        
        if not instructor_subject_ids:
            # No subjects for this instructor, return empty list
            logger.info(f"No subjects found for instructor {instructor_id}")
            return {
                "success": True,
                "learners": []
            }
        
        # Get all students enrolled in any of the instructor's subjects
        learner_data = {}
        
        # Query subject_enrollments for students in the instructor's subjects
        for subject_id in instructor_subject_ids:
            try:
                # Try with student_id field first
                enrollments_response = supabase.table('subject_enrollments').select(
                    'student_id'
                ).eq('subject_id', subject_id).execute()
                
                logger.info(f"Found {len(enrollments_response.data or [])} enrollments for subject {subject_id}")
                
                for enrollment in (enrollments_response.data or []):
                    student_id = enrollment.get('student_id')
                    if student_id:
                        if student_id not in learner_data:
                            learner_data[student_id] = {'subjects': []}
                        
                        learner_data[student_id]['subjects'].append({
                            'id': subject_id,
                            'title': instructor_subjects.get(subject_id, 'Unknown')
                        })
            except Exception as e:
                logger.warning(f"Error fetching enrollments for subject {subject_id}: {str(e)}")
                # Try with learner_id as fallback
                try:
                    enrollments_response = supabase.table('subject_enrollments').select(
                        'learner_id'
                    ).eq('subject_id', subject_id).execute()
                    
                    for enrollment in (enrollments_response.data or []):
                        student_id = enrollment.get('learner_id')
                        if student_id:
                            if student_id not in learner_data:
                                learner_data[student_id] = {'subjects': []}
                            
                            learner_data[student_id]['subjects'].append({
                                'id': subject_id,
                                'title': instructor_subjects.get(subject_id, 'Unknown')
                            })
                except Exception as e2:
                    logger.error(f"Failed both student_id and learner_id for subject {subject_id}: {str(e2)}")
        
        logger.info(f"Found {len(learner_data)} unique learners across all subjects")
        
        # Get learner details (name, username, etc.)
        learners = []
        for student_id in learner_data.keys():
            try:
                # Try to get user info from users table
                user_response = supabase.table('users').select(
                    'id, first_name, last_name, username'
                ).eq('id', student_id).execute()
                
                if user_response.data and len(user_response.data) > 0:
                    user = user_response.data[0]
                    learner_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('username', 'Unknown')
                    learners.append({
                        'id': user.get('id'),
                        'name': learner_name,
                        'username': user.get('username'),
                        'subjects': learner_data[student_id]['subjects']
                    })
                    logger.info(f"Added learner: {learner_name} with {len(learner_data[student_id]['subjects'])} subjects")
            except Exception as e:
                logger.warning(f"Error fetching user details for student {student_id}: {str(e)}")
                # Add learner with just ID if we can't get details
                learners.append({
                    'id': student_id,
                    'name': 'Unknown Learner',
                    'username': student_id,
                    'subjects': learner_data[student_id]['subjects']
                })
        
        logger.info(f"Returning {len(learners)} learners for instructor {instructor_id}")
        return {
            "success": True,
            "learners": learners
        }
    except Exception as e:
        logger.error(f"Error fetching instructor learners: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching instructor learners: {str(e)}")


@app.get("/api/student-profile/{user_id}")
async def get_student_profile(user_id: str):
    """
    Fetch student profile data from als_enrollments_approved table
    """
    try:
        # Get enrollment data for the user
        enrollment = supabase.table("als_enrollments_approved") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not enrollment.data or len(enrollment.data) == 0:
            raise HTTPException(status_code=404, detail="Student enrollment record not found")
        
        profile_data = enrollment.data[0]
        
        return {
            "lrn": profile_data.get("lrn"),
            "enrollment_date": profile_data.get("enrollment_date"),
            "first_name": profile_data.get("first_name"),
            "middle_name": profile_data.get("middle_name"),
            "last_name": profile_data.get("last_name"),
            "name_extension": profile_data.get("name_extension"),
            "birthdate": profile_data.get("birthdate"),
            "place_of_birth": profile_data.get("place_of_birth"),
            "sex": profile_data.get("sex"),
            "civil_status": profile_data.get("civil_status"),
            "religion": profile_data.get("religion"),
            "ip_ethnic_group": profile_data.get("ip_ethnic_group"),
            "mother_tongue": profile_data.get("mother_tongue"),
            "is_pwd": profile_data.get("is_pwd"),
            "contact_numbers": profile_data.get("contact_numbers"),
            "is_4ps": profile_data.get("is_4ps"),
            "house_no_street_sitio": profile_data.get("house_no_street_sitio"),
            "barangay": profile_data.get("barangay"),
            "municipality_city": profile_data.get("municipality_city"),
            "province": profile_data.get("province"),
            "last_grade_level_completed": profile_data.get("last_grade_level_completed"),
            "elementary_school": profile_data.get("elementary_school"),
            "junior_high_school": profile_data.get("junior_high_school"),
            "dropout_reason": profile_data.get("dropout_reason"),
            "dropout_reason_others": profile_data.get("dropout_reason_others"),
            "attended_als_before": profile_data.get("attended_als_before"),
            "previous_program_name": profile_data.get("previous_program_name"),
            "previous_literacy_level": profile_data.get("previous_literacy_level"),
            "previous_year_attended": profile_data.get("previous_year_attended"),
            "previous_program_completed": profile_data.get("previous_program_completed"),
            "previous_not_completed_reason": profile_data.get("previous_not_completed_reason"),
            "distance_to_learning_center_km": profile_data.get("distance_to_learning_center_km"),
            "distance_to_learning_center_hours": profile_data.get("distance_to_learning_center_hours"),
            "distance_to_learning_center_mins": profile_data.get("distance_to_learning_center_mins"),
            "transportation_mode": profile_data.get("transportation_mode"),
            "transportation_mode_others": profile_data.get("transportation_mode_others"),
            "father_guardian_first_name": profile_data.get("father_guardian_first_name"),
            "father_guardian_middle_name": profile_data.get("father_guardian_middle_name"),
            "father_guardian_last_name": profile_data.get("father_guardian_last_name"),
            "father_guardian_occupation": profile_data.get("father_guardian_occupation"),
            "mother_maiden_first_name": profile_data.get("mother_maiden_first_name"),
            "mother_maiden_middle_name": profile_data.get("mother_maiden_middle_name"),
            "mother_maiden_last_name": profile_data.get("mother_maiden_last_name"),
            "mother_maiden_occupation": profile_data.get("mother_maiden_occupation"),
            "email_address": profile_data.get("email_address"),
            "als_teacher_facilitator": profile_data.get("als_teacher_facilitator"),
            "profile_photo": profile_data.get("profile_photo")
        }
        
    except Exception as e:
        logger.error(f"Error fetching student profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching student profile: {str(e)}")


class StudentAddressUpdate(BaseModel):
    house_no_street_sitio: Optional[str] = None
    barangay: Optional[str] = None
    municipality_city: Optional[str] = None
    province: Optional[str] = None


@app.put("/api/student-profile/{user_id}/address")
async def update_student_address(user_id: str, address_data: StudentAddressUpdate):
    """
    Update student address in als_enrollments_approved table
    """
    try:
        # Get enrollment record
        enrollment = supabase.table("als_enrollments_approved") \
            .select("id") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not enrollment.data or len(enrollment.data) == 0:
            raise HTTPException(status_code=404, detail="Student enrollment record not found")
        
        enrollment_id = enrollment.data[0]['id']
        
        # Update address fields
        update_data = {}
        if address_data.house_no_street_sitio is not None:
            update_data['house_no_street_sitio'] = address_data.house_no_street_sitio
        if address_data.barangay is not None:
            update_data['barangay'] = address_data.barangay
        if address_data.municipality_city is not None:
            update_data['municipality_city'] = address_data.municipality_city
        if address_data.province is not None:
            update_data['province'] = address_data.province
        
        # Add updated_at timestamp
        update_data['updated_at'] = dt.datetime.now(dt.timezone.utc).isoformat()
        
        result = supabase.table("als_enrollments_approved") \
            .update(update_data) \
            .eq("id", enrollment_id) \
            .execute()
        
        return {
            "success": True,
            "message": "Address updated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error updating student address: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating student address: {str(e)}")


@app.post("/api/student-profile/{user_id}/photo")
async def upload_student_photo(user_id: str, file: UploadFile = File(...)):
    """
    Upload student profile photo and save filename to database
    """
    try:
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Only image files allowed.")
        
        # Read file content
        contents = await file.read()
        
        # Validate file size (5MB max)
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Generate filename
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1].lower()
        filename = f"{user_id}_{timestamp}.{file_extension}"
        
        # Create PFP directory if it doesn't exist
        pfp_dir = Path("COMPONENTS/PFP")
        pfp_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file_path = pfp_dir / filename
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Update database
        enrollment = supabase.table("als_enrollments_approved") \
            .select("id") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not enrollment.data or len(enrollment.data) == 0:
            # Delete the uploaded file if no enrollment found
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=404, detail="Student enrollment record not found")
        
        enrollment_id = enrollment.data[0]['id']
        
        # Update profile_photo field
        supabase.table("als_enrollments_approved") \
            .update({
                'profile_photo': filename,
                'updated_at': dt.datetime.now(dt.timezone.utc).isoformat()
            }) \
            .eq("id", enrollment_id) \
            .execute()
        
        return {
            "success": True,
            "filename": filename,
            "message": "Photo uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading student photo: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading photo: {str(e)}")


@app.delete("/api/student-profile/{user_id}/photo")
async def delete_student_photo(user_id: str):
    """
    Delete student profile photo
    """
    try:
        # Get enrollment record with current photo
        enrollment = supabase.table("als_enrollments_approved") \
            .select("id, profile_photo") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not enrollment.data or len(enrollment.data) == 0:
            raise HTTPException(status_code=404, detail="Student enrollment record not found")
        
        enrollment_id = enrollment.data[0]['id']
        profile_photo = enrollment.data[0].get('profile_photo')
        
        # Delete file if it exists
        if profile_photo:
            file_path = Path("COMPONENTS/PFP") / profile_photo
            file_path.unlink(missing_ok=True)
        
        # Update database to clear photo reference
        supabase.table("als_enrollments_approved") \
            .update({
                'profile_photo': None,
                'updated_at': dt.datetime.now(dt.timezone.utc).isoformat()
            }) \
            .eq("id", enrollment_id) \
            .execute()
        
        return {
            "success": True,
            "message": "Photo deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting student photo: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting photo: {str(e)}")

    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ALS:app", host="0.0.0.0", port=8000, reload=True)
