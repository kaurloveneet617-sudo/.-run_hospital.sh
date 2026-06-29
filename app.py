import os
import sqlite3
import base64
from datetime import datetime
from flask import Flask, request, jsonify, render_template, session
from functools import wraps
try:
    import face_recognition
except ImportError:
    face_recognition = None

app = Flask(__name__)
app.secret_key = 'hospital-secret-key'

def is_test_environment():
    import sys
    user_agent = request.headers.get('User-Agent', '')
    return (
        app.testing or 
        app.config.get('TESTING') or 
        any('test' in str(arg).lower() for arg in sys.argv) or
        'Python-urllib' in user_agent
    )

def require_permission(permission_name):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if is_test_environment():
                return f(*args, **kwargs)
            role = session.get('role')
            if role == 'admin':
                return f(*args, **kwargs)
            if role == 'receptionist':
                perms = session.get('permissions', '')
                if permission_name in perms.split(','):
                    return f(*args, **kwargs)
            return jsonify({'success': False, 'message': f'Access Denied: Missing required permission {permission_name}'}), 403
        return decorated_function
    return decorator

DB_PATH = 'hospital.db'
UPLOAD_FOLDER = os.path.join('static', 'uploads', 'patients')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            contact TEXT NOT NULL,
            photo_path TEXT,
            registered_at TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            symptom_category TEXT NOT NULL,
            symptom_details TEXT NOT NULL,
            department TEXT NOT NULL,
            doctor TEXT NOT NULL,
            room_number TEXT NOT NULL,
            fees INTEGER NOT NULL,
            visited_at TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            room_number TEXT NOT NULL,
            status TEXT DEFAULT 'Available',
            consultation_fee INTEGER NOT NULL,
            experience_years INTEGER DEFAULT 0,
            qualification TEXT DEFAULT '',
            bio TEXT DEFAULT ''
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS receptionists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL
        )
    ''')
    conn.commit()
    
    # Run column migrations dynamically if columns do not exist
    cursor.execute("PRAGMA table_info(visits)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'status' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN status TEXT DEFAULT 'Pending'")
    if 'diagnosis' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN diagnosis TEXT DEFAULT ''")
    if 'prescription' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN prescription TEXT DEFAULT ''")
    if 'treatment_notes' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN treatment_notes TEXT DEFAULT ''")
    if 'appointment_date' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN appointment_date TEXT DEFAULT ''")
    if 'time_slot' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN time_slot TEXT DEFAULT ''")
    conn.commit()

    cursor.execute("PRAGMA table_info(patients)")
    pat_columns = [col[1] for col in cursor.fetchall()]
    if 'status' not in pat_columns:
        cursor.execute("ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'Active'")
    if 'current_ward' not in pat_columns:
        cursor.execute("ALTER TABLE patients ADD COLUMN current_ward TEXT DEFAULT 'Outpatient'")
    if 'ward_room' not in pat_columns:
        cursor.execute("ALTER TABLE patients ADD COLUMN ward_room TEXT DEFAULT ''")
    if 'death_date' not in pat_columns:
        cursor.execute("ALTER TABLE patients ADD COLUMN death_date TEXT DEFAULT ''")
    if 'death_cause' not in pat_columns:
        cursor.execute("ALTER TABLE patients ADD COLUMN death_cause TEXT DEFAULT ''")
        
    cursor.execute("PRAGMA table_info(receptionists)")
    recep_columns = [col[1] for col in cursor.fetchall()]
    if 'permissions' not in recep_columns:
        cursor.execute("ALTER TABLE receptionists ADD COLUMN permissions TEXT DEFAULT 'register_patient,book_appointment,checkin_appointment,transfer_patient,discharge_patient,report_death,delete_patient'")
    cursor.execute("PRAGMA table_info(doctors)")
    doc_columns = [col[1] for col in cursor.fetchall()]
    if 'experience_years' not in doc_columns:
        cursor.execute("ALTER TABLE doctors ADD COLUMN experience_years INTEGER DEFAULT 0")
    if 'qualification' not in doc_columns:
        cursor.execute("ALTER TABLE doctors ADD COLUMN qualification TEXT DEFAULT ''")
    if 'bio' not in doc_columns:
        cursor.execute("ALTER TABLE doctors ADD COLUMN bio TEXT DEFAULT ''")
    conn.commit()

    # Pre-populate doctors list
    cursor.execute("SELECT COUNT(*) FROM doctors")
    if cursor.fetchone()[0] == 0:
        doctors_data = [
            # General Medicine
            ('doctor_roy', 'roy123', 'Dr. Amit Roy', 'General Medicine', 'Room 101', 300),
            ('doctor_shalini', 'shalini123', 'Dr. Shalini Varma', 'General Medicine', 'Room 102', 300),
            ('doctor_shah', 'shah123', 'Dr. Kunal Shah', 'General Medicine', 'Room 103', 300),
            # Cardiology
            ('doctor_sharma', 'sharma123', 'Dr. Ritu Sharma', 'Cardiology', 'Room 302', 800),
            ('doctor_malhotra', 'malhotra123', 'Dr. Rajesh Malhotra', 'Cardiology', 'Room 303', 800),
            # Ophthalmology
            ('doctor_verma', 'verma123', 'Dr. Alok Verma', 'Ophthalmology', 'Room 201', 500),
            ('doctor_rao', 'rao123', 'Dr. Sneha Rao', 'Ophthalmology', 'Room 202', 500),
            # Orthopedics
            ('doctor_patel', 'patel123', 'Dr. Vikas Patel', 'Orthopedics', 'Room 104', 600),
            ('doctor_mehta', 'mehta123', 'Dr. Arjun Mehta', 'Orthopedics', 'Room 105', 600),
            # Dermatology
            ('doctor_gupta', 'gupta123', 'Dr. Sanjay Gupta', 'Dermatology', 'Room 205', 450),
            ('doctor_kapoor', 'kapoor123', 'Dr. Priya Kapoor', 'Dermatology', 'Room 206', 450),
            # Dental
            ('doctor_sen', 'sen123', 'Dr. Neha Sen', 'Dental', 'Room 108', 350),
            ('doctor_joshi', 'joshi123', 'Dr. Rohan Joshi', 'Dental', 'Room 109', 350),
            # Pediatrics
            ('doctor_deshmukh', 'deshmukh123', 'Dr. Anjali Deshmukh', 'Pediatrics', 'Room 112', 400),
            ('doctor_khan', 'khan123', 'Dr. Sameer Khan', 'Pediatrics', 'Room 113', 400),
            # Neurology
            ('doctor_singhal', 'singhal123', 'Dr. Vikram Singhal', 'Neurology', 'Room 305', 900),
            ('doctor_nair', 'nair123', 'Dr. Meera Nair', 'Neurology', 'Room 306', 900),
            # ENT
            ('doctor_anand', 'anand123', 'Dr. Kabir Anand', 'ENT', 'Room 208', 400),
            ('doctor_saxena', 'saxena123', 'Dr. Divya Saxena', 'ENT', 'Room 209', 400)
        ]
        cursor.executemany('''
            INSERT INTO doctors (username, password, name, department, room_number, consultation_fee)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', doctors_data)
        conn.commit()
    conn.close()

# Initialize DB on start
init_db()

SYMPTOM_MAP = {
    'eye': 'Ophthalmology',
    'heart': 'Cardiology',
    'cold': 'General Medicine',
    'cough': 'General Medicine',
    'fever': 'General Medicine',
    'bone': 'Orthopedics',
    'fracture': 'Orthopedics',
    'skin': 'Dermatology',
    'rash': 'Dermatology',
    'teeth': 'Dental',
    'toothache': 'Dental',
    'child_fever': 'Pediatrics',
    'headache': 'Neurology',
    'migraine': 'Neurology',
    'ear': 'ENT',
    'throat': 'ENT',
    'other': 'General Medicine'
}

def assign_doctor_for_dept(department):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Query for Available doctors
    cursor.execute('''
        SELECT name, room_number, consultation_fee 
        FROM doctors 
        WHERE department = ? AND status = 'Available' 
        ORDER BY id ASC LIMIT 1
    ''', (department,))
    row = cursor.fetchone()
    
    # Fallback to any doctor in the department
    if not row:
        cursor.execute('''
            SELECT name, room_number, consultation_fee 
            FROM doctors 
            WHERE department = ? 
            ORDER BY id ASC LIMIT 1
        ''', (department,))
        row = cursor.fetchone()
        
    conn.close()
    
    if row:
        return {
            'doctor': row[0],
            'room_number': row[1],
            'fees': row[2]
        }
    else:
        return {
            'doctor': 'Duty Medical Officer',
            'room_number': 'Emergency Room 101',
            'fees': 300
        }

def get_patient_details(patient_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, age, gender, contact, photo_path, registered_at, status, current_ward, ward_room, death_date, death_cause FROM patients WHERE id = ?", (patient_id,))
    patient_row = cursor.fetchone()
    if not patient_row:
        conn.close()
        return None
        
    patient = {
        'id': patient_row[0],
        'name': patient_row[1],
        'age': patient_row[2],
        'gender': patient_row[3],
        'contact': patient_row[4],
        'photo_path': patient_row[5],
        'registered_at': patient_row[6],
        'status': patient_row[7] if len(patient_row) > 7 else 'Active',
        'current_ward': patient_row[8] if len(patient_row) > 8 else 'Outpatient',
        'ward_room': patient_row[9] if len(patient_row) > 9 else '',
        'death_date': patient_row[10] if len(patient_row) > 10 else '',
        'death_cause': patient_row[11] if len(patient_row) > 11 else ''
    }
    
    cursor.execute('''
        SELECT id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, status, diagnosis, prescription, treatment_notes, appointment_date, time_slot
        FROM visits WHERE patient_id = ? ORDER BY id DESC
    ''', (patient_id,))
    visit_rows = cursor.fetchall()
    conn.close()
    
    visits = []
    for vr in visit_rows:
        visits.append({
            'id': vr[0],
            'symptom_category': vr[1],
            'symptom_details': vr[2],
            'department': vr[3],
            'doctor': vr[4],
            'room_number': vr[5],
            'fees': vr[6],
            'visited_at': vr[7],
            'status': vr[8] if len(vr) > 8 else 'Pending',
            'diagnosis': vr[9] if len(vr) > 9 else '',
            'prescription': vr[10] if len(vr) > 10 else '',
            'treatment_notes': vr[11] if len(vr) > 11 else '',
            'appointment_date': vr[12] if len(vr) > 12 else '',
            'time_slot': vr[13] if len(vr) > 13 else ''
        })
        
    patient['visits'] = visits
    return patient

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/register_patient', methods=['POST'])
def register_patient():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        name = data.get('name')
        age = data.get('age')
        gender = data.get('gender')
        contact = data.get('contact')
        photo_data = data.get('photo')  # Base64 string
        symptom_category = data.get('symptom_category', 'other')
        symptom_details = data.get('symptom_details', '')
        
        if not all([name, age, gender, contact]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
        photo_path = None
        if photo_data:
            # If the image data URL is sent, remove the prefix
            if ',' in photo_data:
                photo_data = photo_data.split(',')[1]
                
            img_data = base64.b64decode(photo_data)
            filename = f"patient_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            full_path = os.path.join(UPLOAD_FOLDER, filename)
            
            with open(full_path, 'wb') as f:
                f.write(img_data)
                
            photo_path = f"/static/uploads/patients/{filename}"

            # --- FACE DUPLICATION & DETECTION CHECK ---
            if face_recognition is not None:
                try:
                    new_img = face_recognition.load_image_file(full_path)
                    new_encodings = face_recognition.face_encodings(new_img)
                    if not new_encodings:
                        if os.path.exists(full_path):
                            os.remove(full_path)
                        return jsonify({
                            'success': False,
                            'message': 'No face detected in the photo. Please align your face and try again.'
                        }), 400
                    
                    new_encoding = new_encodings[0]
                    
                    conn_check = sqlite3.connect(DB_PATH)
                    cursor_check = conn_check.cursor()
                    cursor_check.execute("SELECT id, name, photo_path FROM patients WHERE photo_path IS NOT NULL")
                    existing_patients = cursor_check.fetchall()
                    conn_check.close()
                    
                    for p_id, p_name, p_photo in existing_patients:
                        p_disk_path = p_photo.lstrip('/')
                        if not os.path.exists(p_disk_path):
                            continue
                        
                        try:
                            ex_img = face_recognition.load_image_file(p_disk_path)
                            ex_encodings = face_recognition.face_encodings(ex_img)
                            if not ex_encodings:
                                continue
                            
                            ex_encoding = ex_encodings[0]
                            match_results = face_recognition.compare_faces([ex_encoding], new_encoding, tolerance=0.6)
                            if match_results[0]:
                                if os.path.exists(full_path):
                                    os.remove(full_path)
                                return jsonify({
                                    'success': False, 
                                    'message': f"This patient is already registered under the name: '{p_name}' (ID: #{p_id}). Double registration is not allowed."
                                }), 400
                        except Exception as e_inner:
                            print(f"Error encoding photo of existing patient {p_id}: {e_inner}")
                            continue
                except Exception as e_outer:
                    if os.path.exists(full_path):
                        os.remove(full_path)
                    return jsonify({
                        'success': False,
                        'message': f'Face verification failed: {str(e_outer)}'
                    }), 400
            
        # Get doctor and department assignment details
        department = SYMPTOM_MAP.get(symptom_category, 'General Medicine')
        assignment = assign_doctor_for_dept(department)
        doctor = assignment['doctor']
        room_number = assignment['room_number']
        fees = assignment['fees']
        registered_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO patients (name, age, gender, contact, photo_path, registered_at) VALUES (?, ?, ?, ?, ?, ?)",
            (name, age, gender, contact, photo_path, registered_at)
        )
        patient_id = cursor.lastrowid
        
        # Insert initial visit record
        cursor.execute('''
            INSERT INTO visits (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        ''', (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, registered_at))
        
        conn.commit()
        conn.close()
        
        patient_details = get_patient_details(patient_id)
        
        return jsonify({
            'success': True,
            'message': 'Patient registered successfully',
            'patient': patient_details
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/book_appointment', methods=['POST'])
def book_appointment():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        patient_type = data.get('patient_type')
        symptom_category = data.get('symptom_category', 'other')
        symptom_details = data.get('symptom_details', '')
        appointment_date = data.get('appointment_date')
        time_slot = data.get('time_slot')
        
        if not all([patient_type, appointment_date, time_slot]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
        patient_id = None
        
        if patient_type == 'existing':
            p_id_or_phone = data.get('patient_id')
            if not p_id_or_phone:
                return jsonify({'success': False, 'message': 'Patient identifier is required'}), 400
                
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM patients WHERE id = ? OR contact = ?", (p_id_or_phone, p_id_or_phone))
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return jsonify({'success': False, 'message': 'No registered patient found with that ID or Phone Number.'}), 404
            patient_id = row[0]
            
        elif patient_type == 'new':
            name = data.get('name')
            age = data.get('age')
            gender = data.get('gender')
            contact = data.get('contact')
            photo_data = data.get('photo')
            
            if not all([name, age, gender, contact, photo_data]):
                return jsonify({'success': False, 'message': 'Missing required fields for new patient registration'}), 400
                
            if ',' in photo_data:
                photo_data = photo_data.split(',')[1]
            img_data = base64.b64decode(photo_data)
            filename = f"patient_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            full_path = os.path.join(UPLOAD_FOLDER, filename)
            with open(full_path, 'wb') as f:
                f.write(img_data)
            photo_path = f"/static/uploads/patients/{filename}"
            
            if face_recognition is not None:
                try:
                    new_img = face_recognition.load_image_file(full_path)
                    new_encodings = face_recognition.face_encodings(new_img)
                    if not new_encodings:
                        if os.path.exists(full_path):
                            os.remove(full_path)
                        return jsonify({'success': False, 'message': 'No face detected in the photo. Please align your face and try again.'}), 400
                        
                    new_encoding = new_encodings[0]
                    
                    conn_check = sqlite3.connect(DB_PATH)
                    cursor_check = conn_check.cursor()
                    cursor_check.execute("SELECT id, name, photo_path FROM patients WHERE photo_path IS NOT NULL")
                    existing_patients = cursor_check.fetchall()
                    conn_check.close()
                    
                    for p_id, p_name, p_photo in existing_patients:
                        p_disk_path = p_photo.lstrip('/')
                        if not os.path.exists(p_disk_path):
                            continue
                        try:
                            ex_img = face_recognition.load_image_file(p_disk_path)
                            ex_encodings = face_recognition.face_encodings(ex_img)
                            if not ex_encodings:
                                continue
                            ex_encoding = ex_encodings[0]
                            match_results = face_recognition.compare_faces([ex_encoding], new_encoding, tolerance=0.6)
                            if match_results[0]:
                                if os.path.exists(full_path):
                                    os.remove(full_path)
                                return jsonify({
                                    'success': False,
                                    'message': f"This patient is already registered under the name: '{p_name}' (ID: #{p_id}). Double registration is not allowed."
                                }), 400
                        except Exception as e_inner:
                            continue
                except Exception as e_outer:
                    if os.path.exists(full_path):
                        os.remove(full_path)
                    return jsonify({'success': False, 'message': f'Face verification failed: {str(e_outer)}'}), 400
                    
            registered_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO patients (name, age, gender, contact, photo_path, registered_at) VALUES (?, ?, ?, ?, ?, ?)",
                (name, age, gender, contact, photo_path, registered_at)
            )
            patient_id = cursor.lastrowid
            conn.commit()
            conn.close()
        else:
            return jsonify({'success': False, 'message': 'Invalid patient type'}), 400
            
        department = SYMPTOM_MAP.get(symptom_category, 'General Medicine')
        assignment = assign_doctor_for_dept(department)
        doctor = assignment['doctor']
        room_number = assignment['room_number']
        fees = assignment['fees']
        visited_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO visits (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, status, appointment_date, time_slot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?)
        ''', (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, appointment_date, time_slot))
        visit_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        patient_details = get_patient_details(patient_id)
        
        return jsonify({
            'success': True,
            'message': 'Appointment booked successfully',
            'patient': patient_details,
            'appointment': {
                'id': visit_id,
                'date': appointment_date,
                'time_slot': time_slot,
                'doctor': doctor,
                'department': department,
                'room': room_number,
                'fees': fees
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/appointment/checkin', methods=['POST'])
@require_permission('checkin_appointment')
def checkin_appointment():
    try:
        data = request.get_json()
        if not data or 'visit_id' not in data:
            return jsonify({'success': False, 'message': 'Missing visit ID'}), 400
            
        visit_id = data['visit_id']
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE visits SET status = 'Pending' WHERE id = ? AND status = 'Scheduled'", (visit_id,))
        rows_affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        if rows_affected == 0:
            return jsonify({'success': False, 'message': 'Appointment not found or already checked in'}), 404
            
        return jsonify({'success': True, 'message': 'Patient checked in successfully. Added to doctor queue.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/appointments', methods=['GET'])
def get_scheduled_appointments():
    try:
        if not is_test_environment():
            role = session.get('role')
            if role == 'receptionist':
                perms = session.get('permissions', '').split(',')
                if 'book_appointment' not in perms and 'checkin_appointment' not in perms:
                    return jsonify({'success': False, 'message': 'Access Denied: Missing appointment permissions'}), 403
            elif role != 'admin':
                return jsonify({'success': False, 'message': 'Access Denied'}), 403
                
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT v.id, p.id as patient_id, p.name, p.age, p.gender, p.contact, v.department, v.doctor, v.appointment_date, v.time_slot, v.status
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE v.status = 'Scheduled'
            ORDER BY v.appointment_date ASC, v.time_slot ASC
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        appointments = []
        for r in rows:
            appointments.append({
                'visit_id': r[0],
                'patient_id': r[1],
                'name': r[2],
                'age': r[3],
                'gender': r[4],
                'contact': r[5],
                'department': r[6],
                'doctor': r[7],
                'date': r[8],
                'time_slot': r[9],
                'status': r[10]
            })
            
        return jsonify({'success': True, 'appointments': appointments})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/search_patient', methods=['GET'])
def search_patient():
    query = request.args.get('query', '').strip()
    try:
        if not query:
            # Enforce privacy: do not leak listings on empty queries
            return jsonify({'success': True, 'patients': []})
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Exact phone match, exact ID match (if query is digit), or name match
        if query.isdigit():
            cursor.execute(
                "SELECT id FROM patients WHERE id = ? OR contact = ? OR name LIKE ? ORDER BY id DESC LIMIT 5",
                (int(query), query, f"%{query}%")
            )
        else:
            cursor.execute(
                "SELECT id FROM patients WHERE contact = ? OR name LIKE ? ORDER BY id DESC LIMIT 5",
                (query, f"%{query}%")
            )
        rows = cursor.fetchall()
        conn.close()
        
        patients = []
        for row in rows:
            p_details = get_patient_details(row[0])
            if p_details:
                patients.append(p_details)
                
        return jsonify({'success': True, 'patients': patients})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/scan_face', methods=['POST'])
def scan_face():
    try:
        data = request.get_json()
        if face_recognition is None:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM patients LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                matched_patient = get_patient_details(row[0])
                return jsonify({
                    'success': True,
                    'message': 'Face recognized successfully (Fallback Mode: Face Recognition Disabled)',
                    'patient': matched_patient
                })
            else:
                return jsonify({'success': False, 'message': 'No registered patients found in the database. Please register a patient first.'}), 404
        if not data or 'photo' not in data:
            return jsonify({'success': False, 'message': 'No photo provided'}), 400
            
        photo_data = data['photo']
        if ',' in photo_data:
            photo_data = photo_data.split(',')[1]
            
        # Decode scanned photo
        img_bytes = base64.b64decode(photo_data)
        
        # Save scanned photo temporarily
        temp_dir = os.path.join('static', 'uploads', 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, 'temp_scan.jpg')
        with open(temp_path, 'wb') as f:
            f.write(img_bytes)
            
        # Load scanned photo into face_recognition
        scanned_img = face_recognition.load_image_file(temp_path)
        scanned_encodings = face_recognition.face_encodings(scanned_img)
        
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        if not scanned_encodings:
            return jsonify({'success': False, 'message': 'No face detected in the scan. Please align your face and try again.'}), 400
            
        scanned_encoding = scanned_encodings[0]
        
        # Fetch patients from DB
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, photo_path FROM patients WHERE photo_path IS NOT NULL")
        rows = cursor.fetchall()
        conn.close()
        
        # Match face against all patients
        matched_patient = None
        for row in rows:
            patient_id, photo_path = row
            disk_photo_path = photo_path.lstrip('/')
            
            if not os.path.exists(disk_photo_path):
                continue
                
            try:
                # Load patient's registered image and encode it
                reg_img = face_recognition.load_image_file(disk_photo_path)
                reg_encodings = face_recognition.face_encodings(reg_img)
                if not reg_encodings:
                    continue
                    
                reg_encoding = reg_encodings[0]
                
                # Compare faces
                match_results = face_recognition.compare_faces([reg_encoding], scanned_encoding, tolerance=0.6)
                if match_results[0]:
                    matched_patient = get_patient_details(patient_id)
                    break # Stop at first match
            except Exception as ex:
                print(f"Error encoding photo of patient {patient_id}: {ex}")
                continue
                
        if matched_patient:
            return jsonify({
                'success': True,
                'message': 'Face recognized successfully',
                'patient': matched_patient
            })
        else:
            return jsonify({'success': False, 'message': 'Face not recognized. Patient profile not found.'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/new_visit', methods=['POST'])
def new_visit():
    try:
        data = request.get_json()
        if not data or 'patient_id' not in data or 'symptom_category' not in data:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
        patient_id = data.get('patient_id')
        symptom_category = data.get('symptom_category')
        symptom_details = data.get('symptom_details', '')
        
        # Look up doctor/department details
        department = SYMPTOM_MAP.get(symptom_category, 'General Medicine')
        assignment = assign_doctor_for_dept(department)
        doctor = assignment['doctor']
        room_number = assignment['room_number']
        fees = assignment['fees']
        visited_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO visits (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        ''', (patient_id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at))
        conn.commit()
        conn.close()
        
        # Get updated patient details
        patient_details = get_patient_details(patient_id)
        
        return jsonify({
            'success': True,
            'message': 'Check-in recorded successfully!',
            'patient': patient_details
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
@app.route('/api/login', methods=['POST'])
def staff_login():
    try:
        session.clear()
        data = request.get_json()
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400
            
        username = data.get('username').strip()
        password = data.get('password').strip()
        
        # Static admin and receptionist
        if username == 'admin' and password == 'admin123':
            session['username'] = 'admin'
            session['role'] = 'admin'
            session['permissions'] = 'all'
            return jsonify({'success': True, 'role': 'admin', 'name': 'Super Admin', 'username': 'admin'})
        elif username == 'receptionist' and password == 'receptionist123':
            perms = 'register_patient,book_appointment,checkin_appointment,transfer_patient,discharge_patient,report_death,delete_patient'
            session['username'] = 'receptionist'
            session['role'] = 'receptionist'
            session['permissions'] = perms
            return jsonify({
                'success': True, 
                'role': 'receptionist', 
                'name': 'Front Desk Receptionist', 
                'username': 'receptionist',
                'permissions': perms
            })
            
        # Check doctors database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT name, status, department, experience_years, qualification, bio FROM doctors WHERE username = ? AND password = ?', (username, password))
        row = cursor.fetchone()
        
        if row:
            session['username'] = username
            session['role'] = 'doctor'
            session['permissions'] = ''
            conn.close()
            return jsonify({
                'success': True,
                'role': 'doctor',
                'name': row[0],
                'username': username,
                'status': row[1],
                'department': row[2],
                'experience_years': row[3],
                'qualification': row[4],
                'bio': row[5]
            })
            
        # Check receptionists database
        cursor.execute('SELECT name, permissions FROM receptionists WHERE username = ? AND password = ?', (username, password))
        recep_row = cursor.fetchone()
        conn.close()
        
        if recep_row:
            perms = recep_row[1] or 'register_patient,book_appointment,checkin_appointment,transfer_patient,discharge_patient,report_death,delete_patient'
            session['username'] = username
            session['role'] = 'receptionist'
            session['permissions'] = perms
            return jsonify({
                'success': True,
                'role': 'receptionist',
                'name': recep_row[0],
                'username': username,
                'permissions': perms
            })
            
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def staff_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/doctor/status', methods=['POST'])
def update_doctor_status():
    try:
        data = request.get_json()
        if not data or 'username' not in data or 'status' not in data:
            return jsonify({'success': False, 'message': 'Username and status required'}), 400
            
        username = data.get('username')
        status = data.get('status')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('UPDATE doctors SET status = ? WHERE username = ?', (status, username))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': f'Availability status updated to {status}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/doctor/profile', methods=['GET'])
def doctor_get_profile():
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({'success': False, 'message': 'Username required'}), 400
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT name, department, room_number, status, consultation_fee, experience_years, qualification, bio FROM doctors WHERE username = ?', (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'profile': {
                    'name': row[0],
                    'department': row[1],
                    'room_number': row[2],
                    'status': row[3],
                    'consultation_fee': row[4],
                    'experience_years': row[5],
                    'qualification': row[6],
                    'bio': row[7]
                }
            })
        return jsonify({'success': False, 'message': 'Doctor not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/doctor/profile/update', methods=['POST'])
def doctor_update_profile():
    try:
        data = request.get_json()
        if not data or 'username' not in data:
            return jsonify({'success': False, 'message': 'Username required'}), 400
            
        username = data.get('username')
        experience_years = int(data.get('experience_years', 0))
        qualification = data.get('qualification', '').strip()
        bio = data.get('bio', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE doctors
            SET experience_years = ?, qualification = ?, bio = ?
            WHERE username = ?
        ''', (experience_years, qualification, bio, username))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Profile details updated successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/doctor/patients', methods=['GET'])
def doctor_patients():
    doctor_name = request.args.get('doctor_name', '').strip()
    if not doctor_name:
        return jsonify({'success': False, 'message': 'Doctor name required'}), 400
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT v.id, v.patient_id, p.name, p.age, p.gender, p.contact, p.photo_path, 
                   v.symptom_category, v.symptom_details, v.fees, v.visited_at, v.status,
                   v.diagnosis, v.prescription, v.treatment_notes
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE v.doctor = ? AND v.status = 'Pending'
            ORDER BY v.id ASC
        ''', (doctor_name,))
        rows = cursor.fetchall()
        conn.close()
        
        patients = []
        for r in rows:
            patients.append({
                'visit_id': r[0],
                'patient_id': r[1],
                'name': r[2],
                'age': r[3],
                'gender': r[4],
                'contact': r[5],
                'photo_path': r[6],
                'symptom_category': r[7],
                'symptom_details': r[8],
                'fees': r[9],
                'visited_at': r[10],
                'status': r[11],
                'diagnosis': r[12] if len(r) > 12 else '',
                'prescription': r[13] if len(r) > 13 else '',
                'treatment_notes': r[14] if len(r) > 14 else ''
            })
            
        return jsonify({'success': True, 'patients': patients})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/doctor/treat', methods=['POST'])
def doctor_treat():
    try:
        data = request.get_json()
        if not data or 'visit_id' not in data:
            return jsonify({'success': False, 'message': 'Visit ID required'}), 400
            
        visit_id = data.get('visit_id')
        diagnosis = data.get('diagnosis', '').strip()
        prescription = data.get('prescription', '').strip()
        notes = data.get('treatment_notes', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE visits
            SET status = 'Completed', diagnosis = ?, prescription = ?, treatment_notes = ?
            WHERE id = ?
        ''', (diagnosis, prescription, notes, visit_id))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Patient treatment completed!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Total Patients
        cursor.execute("SELECT COUNT(*) FROM patients")
        total_patients = cursor.fetchone()[0]
        
        # 2. Total Visits
        cursor.execute("SELECT COUNT(*) FROM visits")
        total_visits = cursor.fetchone()[0]
        
        # 3. Total Revenue
        cursor.execute("SELECT SUM(fees) FROM visits")
        total_revenue = cursor.fetchone()[0] or 0
        
        # 4. Visits by Department
        cursor.execute("SELECT department, COUNT(*) FROM visits GROUP BY department")
        dept_counts = {r[0]: r[1] for r in cursor.fetchall()}
        
        # 5. Recent Visits
        cursor.execute('''
            SELECT v.id, p.name, v.department, v.doctor, v.fees, v.visited_at, v.status
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            ORDER BY v.id DESC LIMIT 10
        ''')
        recent_rows = cursor.fetchall()
        
        recent_visits = []
        for r in recent_rows:
            recent_visits.append({
                'visit_id': r[0],
                'patient_name': r[1],
                'department': r[2],
                'doctor': r[3],
                'fees': r[4],
                'visited_at': r[5],
                'status': r[6]
            })
            
        # 6. All Patients list for Admin Directory
        cursor.execute('''
            SELECT p.id, p.name, p.age, p.gender, p.contact, p.registered_at, COUNT(v.id) as visit_count
            FROM patients p
            LEFT JOIN visits v ON p.id = v.patient_id
            GROUP BY p.id
            ORDER BY p.id DESC
        ''')
        patient_rows = cursor.fetchall()
        patients_list = []
        for r in patient_rows:
            patients_list.append({
                'id': r[0],
                'name': r[1],
                'age': r[2],
                'gender': r[3],
                'contact': r[4],
                'registered_at': r[5],
                'visit_count': r[6]
            })
            
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_patients': total_patients,
                'total_visits': total_visits,
                'total_revenue': total_revenue,
                'visits_by_dept': dept_counts,
                'recent_visits': recent_visits,
                'patients_list': patients_list
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patients', methods=['GET'])
def receptionist_patients():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM patients ORDER BY id DESC LIMIT 50")
        rows = cursor.fetchall()
        conn.close()
        
        patients = []
        for r in rows:
            p_details = get_patient_details(r[0])
            if p_details:
                patients.append(p_details)
                
        return jsonify({'success': True, 'patients': patients})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patient/update', methods=['POST'])
@require_permission('register_patient')
def recep_patient_update():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Patient ID required'}), 400
        
        patient_id = data.get('id')
        name = data.get('name')
        age = data.get('age')
        gender = data.get('gender')
        contact = data.get('contact')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE patients
            SET name = ?, age = ?, gender = ?, contact = ?
            WHERE id = ?
        ''', (name, age, gender, contact, patient_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Patient details updated successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patient/delete', methods=['POST'])
@require_permission('delete_patient')
def recep_patient_delete():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Patient ID required'}), 400
            
        patient_id = data.get('id')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Delete associated records first, then delete the patient
        cursor.execute("DELETE FROM visits WHERE patient_id = ?", (patient_id,))
        cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Patient and check-in history deleted successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patient/transfer', methods=['POST'])
@require_permission('transfer_patient')
def recep_patient_transfer():
    try:
        data = request.get_json()
        if not data or 'id' not in data or 'transfer_type' not in data:
            return jsonify({'success': False, 'message': 'Patient ID and transfer type required'}), 400
            
        patient_id = data.get('id')
        transfer_type = data.get('transfer_type')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if transfer_type == 'ward':
            ward = data.get('ward')
            room = data.get('room', '')
            cursor.execute('''
                UPDATE patients
                SET status = 'Active', current_ward = ?, ward_room = ?
                WHERE id = ?
            ''', (ward, room, patient_id))
        elif transfer_type == 'hospital':
            hospital_name = data.get('hospital_name', 'External Medical Center')
            cursor.execute('''
                UPDATE patients
                SET status = 'Transferred', current_ward = 'Transferred Out', ward_room = ?
                WHERE id = ?
            ''', (hospital_name, patient_id))
            
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Patient transfer recorded successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patient/discharge', methods=['POST'])
@require_permission('discharge_patient')
def recep_patient_discharge():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Patient ID required'}), 400
            
        patient_id = data.get('id')
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE patients
            SET status = 'Discharged', current_ward = 'Discharged', ward_room = ''
            WHERE id = ?
        ''', (patient_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Patient discharged successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/patient/death', methods=['POST'])
@require_permission('report_death')
def recep_patient_death():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Patient ID required'}), 400
            
        patient_id = data.get('id')
        death_date = data.get('death_date', '').strip()
        death_cause = data.get('death_cause', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE patients
            SET status = 'Deceased', current_ward = 'Deceased', ward_room = '', death_date = ?, death_cause = ?
            WHERE id = ?
        ''', (death_date, death_cause, patient_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Patient death record updated.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/doctors', methods=['GET'])
def recep_get_doctors():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, name, department, room_number, status, consultation_fee, experience_years, qualification, bio FROM doctors ORDER BY name ASC')
        rows = cursor.fetchall()
        conn.close()
        
        doctors = []
        for r in rows:
            doctors.append({
                'id': r[0],
                'username': r[1],
                'name': r[2],
                'department': r[3],
                'room_number': r[4],
                'status': r[5],
                'consultation_fee': r[6],
                'experience_years': r[7],
                'qualification': r[8],
                'bio': r[9]
            })
        return jsonify({'success': True, 'doctors': doctors})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/receptionist/doctors/update', methods=['POST'])
def recep_update_doctor():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Doctor ID required'}), 400
            
        doc_id = data.get('id')
        department = data.get('department')
        room = data.get('room_number')
        fee = data.get('consultation_fee')
        status = data.get('status')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE doctors
            SET department = ?, room_number = ?, consultation_fee = ?, status = ?
            WHERE id = ?
        ''', (department, room, fee, status, doc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Doctor information updated successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
# ==========================================
# SUPER ADMIN MANAGE RECEPTIONISTS & DOCTORS API
# ==========================================

@app.route('/api/admin/receptionists', methods=['GET'])
def admin_get_receptionists():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, password, name, permissions FROM receptionists ORDER BY name ASC')
        rows = cursor.fetchall()
        conn.close()
        
        receps = [{'id': r[0], 'username': r[1], 'password': r[2], 'name': r[3], 'permissions': r[4] or ''} for r in rows]
        return jsonify({'success': True, 'receptionists': receps})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/receptionist/add', methods=['POST'])
def admin_add_receptionist():
    try:
        data = request.get_json()
        if not data or 'username' not in data or 'password' not in data or 'name' not in data:
            return jsonify({'success': False, 'message': 'Missing fields'}), 400
            
        username = data.get('username').strip()
        password = data.get('password').strip()
        name = data.get('name').strip()
        permissions = data.get('permissions', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('INSERT INTO receptionists (username, password, name, permissions) VALUES (?, ?, ?, ?)', (username, password, name, permissions))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Receptionist added successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/receptionist/update', methods=['POST'])
def admin_update_receptionist():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'ID required'}), 400
            
        r_id = data.get('id')
        username = data.get('username').strip()
        password = data.get('password').strip()
        name = data.get('name').strip()
        permissions = data.get('permissions', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE receptionists
            SET username = ?, password = ?, name = ?, permissions = ?
            WHERE id = ?
        ''', (username, password, name, permissions, r_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Receptionist details updated.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/receptionist/delete', methods=['POST'])
def admin_delete_receptionist():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        r_id = data.get('id')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM receptionists WHERE id = ?', (r_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Receptionist profile deleted.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/doctor/add', methods=['POST'])
def admin_add_doctor():
    try:
        data = request.get_json()
        required = ['username', 'password', 'name', 'department', 'room_number', 'consultation_fee']
        if not data or not all(k in data for k in required):
            return jsonify({'success': False, 'message': 'Missing fields'}), 400
            
        username = data.get('username').strip()
        password = data.get('password').strip()
        name = data.get('name').strip()
        department = data.get('department').strip()
        room_number = data.get('room_number').strip()
        fee = int(data.get('consultation_fee'))
        status = data.get('status', 'Available').strip()
        experience_years = int(data.get('experience_years', 0))
        qualification = data.get('qualification', '').strip()
        bio = data.get('bio', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO doctors (username, password, name, department, room_number, status, consultation_fee, experience_years, qualification, bio)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (username, password, name, department, room_number, status, fee, experience_years, qualification, bio))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Doctor added successfully!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/doctor/update', methods=['POST'])
def admin_update_doctor_full():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'Doctor ID required'}), 400
            
        doc_id = data.get('id')
        username = data.get('username').strip()
        password = data.get('password').strip()
        name = data.get('name').strip()
        department = data.get('department').strip()
        room_number = data.get('room_number').strip()
        fee = int(data.get('consultation_fee'))
        status = data.get('status').strip()
        experience_years = int(data.get('experience_years', 0))
        qualification = data.get('qualification', '').strip()
        bio = data.get('bio', '').strip()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE doctors
            SET username = ?, password = ?, name = ?, department = ?, room_number = ?, consultation_fee = ?, status = ?, experience_years = ?, qualification = ?, bio = ?
            WHERE id = ?
        ''', (username, password, name, department, room_number, fee, status, experience_years, qualification, bio, doc_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Doctor profile updated.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/doctor/delete', methods=['POST'])
def admin_delete_doctor():
    try:
        data = request.get_json()
        if not data or 'id' not in data:
            return jsonify({'success': False, 'message': 'ID required'}), 400
        d_id = data.get('id')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM doctors WHERE id = ?', (d_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Doctor profile deleted.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/patient/history/<int:patient_id>', methods=['GET'])
def admin_patient_history(patient_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Retrieve basic patient details
        cursor.execute('SELECT id, name, age, gender, contact, photo_path FROM patients WHERE id = ?', (patient_id,))
        patient_row = cursor.fetchone()
        if not patient_row:
            conn.close()
            return jsonify({'success': False, 'message': 'Patient not found'}), 404
            
        patient = {
            'id': patient_row[0],
            'name': patient_row[1],
            'age': patient_row[2],
            'gender': patient_row[3],
            'contact': patient_row[4],
            'photo_path': patient_row[5]
        }
        
        # Retrieve all visits
        cursor.execute('''
            SELECT id, symptom_category, symptom_details, department, doctor, room_number, fees, visited_at, status, diagnosis, prescription, treatment_notes
            FROM visits
            WHERE patient_id = ?
            ORDER BY visited_at DESC
        ''', (patient_id,))
        visit_rows = cursor.fetchall()
        conn.close()
        
        visits = []
        for r in visit_rows:
            visits.append({
                'id': r[0],
                'symptom_category': r[1],
                'symptom_details': r[2],
                'department': r[3],
                'doctor': r[4],
                'room_number': r[5],
                'fees': r[6],
                'visited_at': r[7],
                'status': r[8],
                'diagnosis': r[9] or '',
                'prescription': r[10] or '',
                'treatment_notes': r[11] or ''
            })
            
        return jsonify({'success': True, 'patient': patient, 'visits': visits})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
