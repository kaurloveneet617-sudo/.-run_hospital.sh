// Application State Management
let stream = null;
let existingStream = null;
let capturedPhotoBase64 = null;

// DOM Elements
const screens = {
    home: document.getElementById('home-screen'),
    registration: document.getElementById('registration-screen'),
    success: document.getElementById('success-screen'),
    existing: document.getElementById('existing-screen'),
    admin: document.getElementById('admin-screen'),
    doctor: document.getElementById('doctor-screen'),
    receptionist: document.getElementById('receptionist-screen'),
    appointment: document.getElementById('appointment-booking-screen')
};

const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('photo-canvas');
const previewImg = document.getElementById('photo-preview');
const cameraOverlay = document.getElementById('camera-overlay');
const cameraError = document.getElementById('camera-error');

// Existing Patient Face Scan Elements
const existingCameraPanel = document.getElementById('existing-camera-panel');
const existingWebcam = document.getElementById('existing-webcam');
const existingPhotoCanvas = document.getElementById('existing-photo-canvas');
const btnExistingScanTrigger = document.getElementById('btn-existing-scan-trigger');
const btnExistingCapture = document.getElementById('btn-existing-capture');
const btnExistingCameraClose = document.getElementById('btn-existing-camera-close');

// Buttons
const btnNewPatient = document.getElementById('btn-new-patient');
const btnExistingPatient = document.getElementById('btn-existing-patient');
const btnBackButtons = document.querySelectorAll('.btn-back');
const btnCapture = document.getElementById('btn-capture');
const btnRetake = document.getElementById('btn-retake');
const btnRetryCamera = document.getElementById('btn-retry-camera');
const btnSuccessDone = document.getElementById('btn-success-done');
const btnSearchTrigger = document.getElementById('btn-search-trigger');
const captureConfirmButtons = document.querySelector('.capture-confirm-buttons');

// Form and Inputs
const registrationForm = document.getElementById('registration-form');
const inputName = document.getElementById('patient-name');
const inputAge = document.getElementById('patient-age');
const inputGender = document.getElementById('patient-gender');
const inputContact = document.getElementById('patient-contact');
const searchInput = document.getElementById('patient-search-input');
const searchResultsGrid = document.getElementById('search-results-grid');
const resultsCount = document.getElementById('results-count');

// Initialize Lucide Icons
lucide.createIcons();

// --- Screen Switching & Navigation ---
function showScreen(screenId) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    const target = screens[screenId];
    if (target) {
        target.classList.add('active');
    }
}

// Navigation Actions
btnNewPatient.addEventListener('click', () => {
    showScreen('registration');
    startWebcam();
    resetForm();
});

btnExistingPatient.addEventListener('click', () => {
    showScreen('existing');
    loadAllPatients(); // load recent patients initially
});

btnBackButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        showScreen('home');
        stopWebcam();
        stopExistingWebcam();
    });
});

btnSuccessDone.addEventListener('click', () => {
    showScreen('home');
});

// --- Clock Display ---
function updateClock() {
    const timeElement = document.getElementById('header-time');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}
setInterval(updateClock, 1000);
updateClock();

// --- Toast System ---
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    
    toast.className = 'toast'; // Reset classes
    if (type === 'success') toast.classList.add('success');
    if (type === 'error') toast.classList.add('error');
    
    toastMsg.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// --- Camera Controller ---
async function startWebcam() {
    stopWebcam();
    cameraError.style.display = 'none';
    webcamElement.style.display = 'block';
    cameraOverlay.style.display = 'flex';
    
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        webcamElement.srcObject = stream;
    } catch (err) {
        console.error('Error accessing webcam:', err);
        webcamElement.style.display = 'none';
        cameraOverlay.style.display = 'none';
        cameraError.style.display = 'flex';
        showToast('Webcam access was denied or is unavailable', 'error');
    }
}

function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    webcamElement.srcObject = null;
}

// --- Existing Patient Camera Controller ---
async function startExistingWebcam() {
    stopExistingWebcam();
    existingCameraPanel.style.display = 'block';
    
    try {
        existingStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });
        existingWebcam.srcObject = existingStream;
    } catch (err) {
        console.error('Error accessing search webcam:', err);
        existingCameraPanel.style.display = 'none';
        showToast('Webcam access was denied or is unavailable', 'error');
    }
}

function stopExistingWebcam() {
    if (existingStream) {
        existingStream.getTracks().forEach(track => track.stop());
        existingStream = null;
    }
    existingWebcam.srcObject = null;
    existingCameraPanel.style.display = 'none';
}

// Event Bindings for Face Scanning
btnExistingScanTrigger.addEventListener('click', () => {
    if (existingCameraPanel.style.display === 'none') {
        startExistingWebcam();
    } else {
        stopExistingWebcam();
    }
});

btnExistingCameraClose.addEventListener('click', () => {
    stopExistingWebcam();
});

btnExistingCapture.addEventListener('click', async () => {
    if (!existingStream) {
        showToast('Camera is not active.', 'error');
        return;
    }
    
    const context = existingPhotoCanvas.getContext('2d');
    existingPhotoCanvas.width = existingWebcam.videoWidth || 640;
    existingPhotoCanvas.height = existingWebcam.videoHeight || 480;
    
    // Draw mirrored video frame
    context.save();
    context.translate(existingPhotoCanvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(existingWebcam, 0, 0, existingPhotoCanvas.width, existingPhotoCanvas.height);
    context.restore();
    
    const faceBase64 = existingPhotoCanvas.toDataURL('image/jpeg', 0.95);
    
    // UI Loading state
    const originalText = btnExistingCapture.innerHTML;
    btnExistingCapture.disabled = true;
    btnExistingCapture.innerHTML = '<span class="status-dot" style="background-color: white; box-shadow: none;"></span> Verifying Face...';
    
    try {
        const response = await fetch('/api/scan_face', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ photo: faceBase64 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Welcome back, ${data.patient.name}!`, 'success');
            stopExistingWebcam();
            
            // Render this single patient in the Dashboard
            showPatientDashboard(data.patient);
        } else {
            showToast(data.message || 'Face not recognized. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Scan face error:', err);
        showToast('Connection to server failed.', 'error');
    } finally {
        btnExistingCapture.disabled = false;
        btnExistingCapture.innerHTML = originalText;
    }
});

btnRetryCamera.addEventListener('click', startWebcam);

// Capture Photo Action
btnCapture.addEventListener('click', () => {
    if (!stream) {
        showToast('Camera is not active. Please retry camera permission.', 'error');
        return;
    }
    
    const context = canvasElement.getContext('2d');
    canvasElement.width = webcamElement.videoWidth || 640;
    canvasElement.height = webcamElement.videoHeight || 480;
    
    // Draw mirrored video frame to canvas
    context.save();
    context.translate(canvasElement.width, 0);
    context.scale(-1, 1);
    context.drawImage(webcamElement, 0, 0, canvasElement.width, canvasElement.height);
    context.restore();
    
    capturedPhotoBase64 = canvasElement.toDataURL('image/jpeg', 0.95);
    
    // Update preview img
    previewImg.src = capturedPhotoBase64;
    previewImg.style.display = 'block';
    webcamElement.style.display = 'none';
    cameraOverlay.style.display = 'none';
    
    // Switch buttons
    btnCapture.style.display = 'none';
    captureConfirmButtons.style.display = 'grid';
});

// Retake Photo Action
btnRetake.addEventListener('click', () => {
    capturedPhotoBase64 = null;
    previewImg.style.display = 'none';
    webcamElement.style.display = 'block';
    cameraOverlay.style.display = 'flex';
    
    btnCapture.style.display = 'block';
    captureConfirmButtons.style.display = 'none';
});

// --- Register Submit Action ---
registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!capturedPhotoBase64) {
        showToast('Please capture a patient photo first.', 'error');
        return;
    }
    
    const payload = {
        name: inputName.value.trim(),
        age: parseInt(inputAge.value, 10),
        gender: inputGender.value,
        contact: inputContact.value.trim(),
        photo: capturedPhotoBase64,
        symptom_category: document.getElementById('patient-symptom-cat').value,
        symptom_details: document.getElementById('patient-symptom-details').value.trim()
    };
    
    // Disable submit to prevent double-post
    const submitBtn = document.getElementById('btn-submit-registration');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="status-dot" style="background-color: white; box-shadow: none;"></span> Registering...';
    
    try {
        const response = await fetch('/api/register_patient', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Registration successful!', 'success');
            stopWebcam();
            
            // Populate Success Screen details
            document.getElementById('success-patient-id').textContent = `#${data.patient.id}`;
            document.getElementById('success-patient-name').textContent = data.patient.name;
            document.getElementById('success-patient-age-gender').textContent = `${data.patient.age} / ${data.patient.gender}`;
            document.getElementById('success-patient-contact').textContent = data.patient.contact;
            
            const timeFormatted = new Date(data.patient.registered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.getElementById('success-patient-time').textContent = timeFormatted;
            
            document.getElementById('success-patient-photo').src = data.patient.photo_path || '/static/placeholder.jpg';
            
            // Extract initial visit details
            const activeVisit = data.patient.visits && data.patient.visits.length > 0 ? data.patient.visits[0] : null;
            if (activeVisit) {
                document.getElementById('success-assigned-dept').textContent = activeVisit.department;
                document.getElementById('success-assigned-doctor').textContent = activeVisit.doctor;
                document.getElementById('success-assigned-room').textContent = activeVisit.room_number;
                document.getElementById('success-assigned-fees').textContent = `₹${activeVisit.fees}`;
            } else {
                document.getElementById('success-assigned-dept').textContent = '-';
                document.getElementById('success-assigned-doctor').textContent = '-';
                document.getElementById('success-assigned-room').textContent = '-';
                document.getElementById('success-assigned-fees').textContent = '-';
            }
            
            // Go to Success Screen
            showScreen('success');
        } else {
            showToast(data.message || 'Error occurred during registration.', 'error');
        }
    } catch (err) {
        console.error('Submit registration error:', err);
        showToast('Connection to server failed.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

function resetForm() {
    registrationForm.reset();
    capturedPhotoBase64 = null;
    previewImg.style.display = 'none';
    btnCapture.style.display = 'block';
    captureConfirmButtons.style.display = 'none';
}

// --- Existing Patient Controller ---
async function performSearch(query) {
    if (!query) {
        showToast('Please enter a name or contact number to search.', 'error');
        return;
    }
    
    try {
        const url = `/api/search_patient?query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            renderResults(data.patients);
        } else {
            showToast(data.message || 'Search failed.', 'error');
        }
    } catch (err) {
        console.error('Search error:', err);
        showToast('Connection to server failed.', 'error');
    }
}

function showPatientDashboard(patient) {
    // Hide search results
    searchResultsGrid.style.display = 'none';
    resultsCount.style.display = 'none';
    
    // Show dashboard
    const dashboard = document.getElementById('patient-dashboard');
    dashboard.style.display = 'block';
    
    // Populate Profile details
    document.getElementById('dash-patient-photo').src = patient.photo_path || '/static/placeholder.jpg';
    document.getElementById('dash-patient-name').textContent = patient.name;
    document.getElementById('dash-patient-id').textContent = `#${patient.id}`;
    document.getElementById('dash-patient-age-gender').textContent = `${patient.age} / ${patient.gender}`;
    document.getElementById('dash-patient-contact').textContent = patient.contact;
    
    const regDate = new Date(patient.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('dash-patient-registered-at').textContent = regDate;
    
    // Set hidden input
    document.getElementById('new-visit-patient-id').value = patient.id;
    
    // Populate Active/Last Consultation Card
    const activeVisit = patient.visits && patient.visits.length > 0 ? patient.visits[0] : null;
    if (activeVisit) {
        document.getElementById('dash-consult-complaint').textContent = activeVisit.symptom_details || activeVisit.symptom_category;
        document.getElementById('dash-consult-dept').textContent = activeVisit.department;
        document.getElementById('dash-consult-doctor').textContent = activeVisit.doctor;
        document.getElementById('dash-consult-room').textContent = activeVisit.room_number;
        document.getElementById('dash-consult-fees').textContent = `₹${activeVisit.fees}`;
    } else {
        document.getElementById('dash-consult-complaint').textContent = 'No visits logged';
        document.getElementById('dash-consult-dept').textContent = '-';
        document.getElementById('dash-consult-doctor').textContent = '-';
        document.getElementById('dash-consult-room').textContent = '-';
        document.getElementById('dash-consult-fees').textContent = '-';
    }
    
    // Populate historical Visit timeline
    const timeline = document.getElementById('dash-visit-timeline');
    timeline.innerHTML = '';
    
    if (patient.visits && patient.visits.length > 0) {
        patient.visits.forEach((v, index) => {
            const isCurrent = index === 0;
            const visitedDate = new Date(v.visited_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            const item = document.createElement('div');
            item.className = `timeline-item ${isCurrent ? 'current' : 'old'}`;
            item.innerHTML = `
                <div class="timeline-date">
                    ${visitedDate} 
                    ${isCurrent ? '<span style="color: var(--color-success); font-weight: bold; margin-left: 8px;">[ACTIVE VISIT]</span>' : ''}
                </div>
                <div class="timeline-title">${v.department} - ${v.doctor}</div>
                <div class="timeline-desc"><strong>Complaint:</strong> ${v.symptom_details || v.symptom_category}</div>
                <div class="timeline-meta" style="margin-top: 6px; display: flex; gap: 16px; font-size: 0.8rem; color: var(--color-accent); margin-bottom: 8px;">
                    <span><i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> ${v.room_number}</span>
                    <span><i data-lucide="indian-rupee" style="width: 12px; height: 12px;"></i> Fee Paid: ₹${v.fees}</span>
                    <span style="color: ${v.status === 'Completed' ? 'var(--color-success)' : 'var(--color-accent)'};"><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Status: ${v.status}</span>
                </div>
                ${v.status === 'Completed' ? `
                <div class="timeline-clinical-record" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); font-size: 0.85rem; line-height: 1.4;">
                    <div style="margin-bottom: 4px;"><strong style="color: var(--text-primary);">Diagnosis:</strong> <span style="color: var(--text-secondary);">${v.diagnosis || 'N/A'}</span></div>
                    <div style="margin-bottom: 4px;"><strong style="color: var(--text-primary);">Prescription:</strong> <code style="color: var(--color-accent); background: rgba(6,182,212,0.06); padding: 2px 6px; border-radius: 4px; display: inline-block; font-family: inherit; font-size: 0.8rem;">${v.prescription || 'None'}</code></div>
                    <div><strong style="color: var(--text-primary);">Doctor's Advice:</strong> <span style="color: var(--text-muted); font-style: italic;">${v.treatment_notes || 'None'}</span></div>
                </div>
                ` : ''}
            `;
            timeline.appendChild(item);
        });
    } else {
        timeline.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No past visits recorded.</p>';
    }
    
    lucide.createIcons();
}

function renderResults(patients) {
    searchResultsGrid.innerHTML = '';
    document.getElementById('patient-dashboard').style.display = 'none';
    
    if (patients.length === 0) {
        resultsCount.textContent = '0 patients found';
        resultsCount.style.display = 'block';
        searchResultsGrid.style.display = 'grid';
        searchResultsGrid.innerHTML = `
            <div class="search-empty-state">
                <i data-lucide="users-round" class="empty-icon"></i>
                <p>No matching patient profiles found. Enter your registered name or phone number.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Privacy protection: if exactly one match, display their dashboard immediately!
    if (patients.length === 1) {
        showPatientDashboard(patients[0]);
        return;
    }
    
    // If multiple matches exist, prompt patient to enter exact contact detail to open their dashboard
    resultsCount.textContent = 'Multiple matches found';
    resultsCount.style.display = 'block';
    searchResultsGrid.style.display = 'grid';
    searchResultsGrid.innerHTML = `
        <div class="search-empty-state">
            <i data-lucide="shield-alert" class="empty-icon" style="color: var(--color-accent);"></i>
            <p style="font-weight: 500;">Multiple profiles matched your query.</p>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">To protect patient privacy, please search by your exact 10-digit contact number or use the Face Scan option.</p>
        </div>
    `;
    lucide.createIcons();
}

async function loadAllPatients() {
    // Hide dashboard initially
    document.getElementById('patient-dashboard').style.display = 'none';
    searchResultsGrid.style.display = 'grid';
    resultsCount.style.display = 'block';
    resultsCount.textContent = 'Use search or face scan to lookup details';
    searchResultsGrid.innerHTML = `
        <div class="search-empty-state">
            <i data-lucide="search" class="empty-icon"></i>
            <p>Please search by entering your phone number or click "Scan Face".</p>
        </div>
    `;
    lucide.createIcons();
}

// Search triggers
btnSearchTrigger.addEventListener('click', () => {
    const query = searchInput.value.trim();
    performSearch(query);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        performSearch(query);
    }
});

// New Visit Form Submission
const newVisitForm = document.getElementById('new-visit-form');
if (newVisitForm) {
    newVisitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const patientId = document.getElementById('new-visit-patient-id').value;
        const category = document.getElementById('new-visit-symptom-cat').value;
        const details = document.getElementById('new-visit-symptom-details').value.trim();
        
        if (!patientId || !category) {
            showToast('Please select a complaint category.', 'error');
            return;
        }
        
        const submitBtn = document.getElementById('btn-submit-new-visit');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="status-dot" style="background-color: white; box-shadow: none;"></span> Processing...';
        
        try {
            const response = await fetch('/api/new_visit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_id: parseInt(patientId, 10),
                    symptom_category: category,
                    symptom_details: details
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showToast('Check-In recorded successfully!', 'success');
                newVisitForm.reset();
                showPatientDashboard(data.patient);
            } else {
                showToast(data.message || 'Failed to record new visit.', 'error');
            }
        } catch (err) {
            console.error('New visit submission error:', err);
            showToast('Connection to server failed.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// --- Staff Portal Login & Role Dashboards ---

let currentStaff = null;

// Modal Controls
const loginModal = document.getElementById('login-modal');
const btnStaffPortal = document.getElementById('btn-staff-portal');
const btnCloseLogin = document.getElementById('btn-close-login');
const loginForm = document.getElementById('login-form');

if (btnStaffPortal) {
    btnStaffPortal.addEventListener('click', () => {
        loginModal.style.display = 'flex';
        document.getElementById('login-username').focus();
    });
}

if (btnCloseLogin) {
    btnCloseLogin.addEventListener('click', () => {
        loginModal.style.display = 'none';
        loginForm.reset();
    });
}

// Close modal on click outside content
window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
        loginModal.style.display = 'none';
        loginForm.reset();
    }
});

// Logout Buttons
const btnLogouts = document.querySelectorAll('.btn-logout');
btnLogouts.forEach(btn => {
    btn.addEventListener('click', () => {
        currentStaff = null;
        showScreen('home');
        showToast('Logged out successfully', 'success');
    });
});

// Login Form Submit
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentStaff = {
                    username: data.username,
                    role: data.role,
                    name: data.name,
                    status: data.status,
                    department: data.department,
                    permissions: data.permissions,
                    experience_years: data.experience_years,
                    qualification: data.qualification,
                    bio: data.bio
                };
                
                loginModal.style.display = 'none';
                loginForm.reset();
                showToast(`Welcome, ${data.name}!`, 'success');
                
                // Route to appropriate screen
                if (data.role === 'admin') {
                    showScreen('admin');
                    loadAdminDashboard();
                } else if (data.role === 'doctor') {
                    showScreen('doctor');
                    loadDoctorDashboard();
                } else if (data.role === 'receptionist') {
                    showScreen('receptionist');
                    loadReceptionistDashboard();
                }
            } else {
                showToast(data.message || 'Invalid credentials.', 'error');
            }
        } catch (err) {
            console.error('Login error:', err);
            showToast('Failed to connect to authentication server.', 'error');
        }
    });
}

// 1. Super Admin Dashboard Loader
async function loadAdminDashboard() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to fetch admin statistics.', 'error');
            return;
        }
        
        const stats = data.stats;
        
        // Populate stats counters
        document.getElementById('admin-stat-patients').textContent = stats.total_patients;
        document.getElementById('admin-stat-visits').textContent = stats.total_visits;
        document.getElementById('admin-stat-revenue').textContent = `₹${stats.total_revenue}`;
        
        // Populate recent activity table
        const recentTable = document.getElementById('admin-recent-visits-table');
        recentTable.innerHTML = '';
        if (stats.recent_visits && stats.recent_visits.length > 0) {
            stats.recent_visits.forEach(v => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px 8px; font-weight: 500;">${v.patient_name}</td>
                    <td style="padding: 10px 8px;">${v.department}</td>
                    <td style="padding: 10px 8px;">${v.doctor}</td>
                    <td style="padding: 10px 8px; color: var(--color-success); font-weight: 500;">₹${v.fees}</td>
                    <td style="padding: 10px 8px;">
                        <span class="queue-badge" style="background: ${v.status === 'Completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(6, 182, 212, 0.15)'}; color: ${v.status === 'Completed' ? 'var(--color-success)' : 'var(--color-accent)'};">
                            ${v.status}
                        </span>
                    </td>
                `;
                recentTable.appendChild(tr);
            });
        } else {
            recentTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No recent check-ins found.</td></tr>`;
        }
        
        // Populate Department Distribution List
        const loadList = document.getElementById('admin-dept-load-list');
        loadList.innerHTML = '';
        const depts = Object.keys(stats.visits_by_dept);
        if (depts.length > 0) {
            // Find max load to compute progress percentages
            const maxVal = Math.max(...Object.values(stats.visits_by_dept));
            
            depts.forEach(d => {
                const count = stats.visits_by_dept[d];
                const percentage = maxVal > 0 ? (count / maxVal) * 100 : 0;
                
                const item = document.createElement('div');
                item.className = 'dept-bar-item';
                item.innerHTML = `
                    <div class="dept-bar-label">
                        <span>${d}</span>
                        <strong>${count} visit${count > 1 ? 's' : ''}</strong>
                    </div>
                    <div class="dept-bar-bg">
                        <div class="dept-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                `;
                loadList.appendChild(item);
            });
        } else {
            loadList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">No department load logs recorded.</p>`;
        }
        
        // Populate full Patient database
        const dbTable = document.getElementById('admin-patients-db-table');
        dbTable.innerHTML = '';
        if (stats.patients_list && stats.patients_list.length > 0) {
            stats.patients_list.forEach(p => {
                const regDate = new Date(p.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px 8px; color: var(--text-muted);">#${p.id}</td>
                    <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary);">${p.name}</td>
                    <td style="padding: 10px 8px;">${p.age} yrs / ${p.gender}</td>
                    <td style="padding: 10px 8px; color: var(--text-secondary);">${p.contact}</td>
                    <td style="padding: 10px 8px; color: var(--text-muted);">${regDate}</td>
                    <td style="padding: 10px 8px; font-weight: 600; text-align: center; color: var(--color-accent);">${p.visit_count}</td>
                `;
                dbTable.appendChild(tr);
            });
        } else {
            dbTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No patient records found in database.</td></tr>`;
        }
        
        lucide.createIcons();
    } catch (err) {
        console.error('Error loading admin stats:', err);
        showToast('Connection to stats server failed.', 'error');
    }
}

// 2. Doctor Dashboard Loader
let selectedVisit = null;

// Doctor Status Selection listener
const statusSelect = document.getElementById('doctor-status-select');
if (statusSelect) {
    statusSelect.addEventListener('change', async () => {
        if (!currentStaff || currentStaff.role !== 'doctor') return;
        const newStatus = statusSelect.value;
        try {
            const response = await fetch('/api/doctor/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentStaff.username, status: newStatus })
            });
            const data = await response.json();
            if (data.success) {
                currentStaff.status = newStatus;
                showToast(`Status updated to ${newStatus}`, 'success');
            } else {
                showToast('Failed to update status', 'error');
            }
        } catch (err) {
            console.error('Error updating doctor status:', err);
            showToast('Connection to server failed.', 'error');
        }
    });
}

// Doctor Tab Switchers and Profile Editor logic
const docTabConsult = document.getElementById('doc-tab-consult');
const docTabProfile = document.getElementById('doc-tab-profile');
const docConsultSection = document.getElementById('doctor-consult-section');
const docProfileSection = document.getElementById('doctor-profile-section');
const docProfileForm = document.getElementById('doctor-profile-form');

if (docTabConsult && docTabProfile) {
    docTabConsult.addEventListener('click', () => {
        docConsultSection.style.display = 'grid';
        docProfileSection.style.display = 'none';
        docTabConsult.style.background = 'var(--accent-color)';
        docTabConsult.style.color = 'white';
        docTabProfile.style.background = 'transparent';
        docTabProfile.style.color = 'var(--text-secondary)';
    });

    docTabProfile.addEventListener('click', async () => {
        docConsultSection.style.display = 'none';
        docProfileSection.style.display = 'block';
        docTabProfile.style.background = 'var(--accent-color)';
        docTabProfile.style.color = 'white';
        docTabConsult.style.background = 'transparent';
        docTabConsult.style.color = 'var(--text-secondary)';
        await loadDoctorProfile();
    });
}

async function loadDoctorProfile() {
    if (!currentStaff || currentStaff.role !== 'doctor') return;
    try {
        const response = await fetch(`/api/doctor/profile?username=${encodeURIComponent(currentStaff.username)}`);
        const data = await response.json();
        if (data.success && data.profile) {
            document.getElementById('doc-profile-name').value = data.profile.name;
            document.getElementById('doc-profile-dept').value = data.profile.department;
            document.getElementById('doc-profile-experience').value = data.profile.experience_years || 0;
            document.getElementById('doc-profile-qualification').value = data.profile.qualification || '';
            document.getElementById('doc-profile-bio').value = data.profile.bio || '';
        } else {
            showToast('Failed to load doctor profile details.', 'error');
        }
    } catch (err) {
        console.error('Error fetching doctor profile:', err);
        showToast('Error loading profile.', 'error');
    }
}

if (docProfileForm) {
    docProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentStaff || currentStaff.role !== 'doctor') return;
        
        const experience = parseInt(document.getElementById('doc-profile-experience').value) || 0;
        const qualification = document.getElementById('doc-profile-qualification').value.trim();
        const bio = document.getElementById('doc-profile-bio').value.trim();
        
        try {
            const response = await fetch('/api/doctor/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentStaff.username,
                    experience_years: experience,
                    qualification: qualification,
                    bio: bio
                })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Profile updated successfully!', 'success');
                // Update local storage/state
                currentStaff.experience_years = experience;
                currentStaff.qualification = qualification;
                currentStaff.bio = bio;
            } else {
                showToast(data.message || 'Failed to update profile.', 'error');
            }
        } catch (err) {
            console.error('Error saving doctor profile:', err);
            showToast('Connection to server failed.', 'error');
        }
    });
}

async function loadDoctorDashboard() {
    if (!currentStaff || currentStaff.role !== 'doctor') return;

    // Reset tabs
    if (docConsultSection && docProfileSection) {
        docConsultSection.style.display = 'grid';
        docProfileSection.style.display = 'none';
        docTabConsult.style.background = 'var(--accent-color)';
        docTabConsult.style.color = 'white';
        docTabProfile.style.background = 'transparent';
        docTabProfile.style.color = 'var(--text-secondary)';
    }
    
    // Reset consult panel
    selectedVisit = null;
    document.getElementById('doctor-consult-panel').style.display = 'none';
    document.getElementById('doctor-consult-empty').style.display = 'flex';
    document.getElementById('doctor-treatment-form').reset();
    
    // Set status dropdown
    if (statusSelect && currentStaff.status) {
        statusSelect.value = currentStaff.status;
    }
    
    document.getElementById('doctor-panel-title').innerHTML = `<i data-lucide="stethoscope" style="vertical-align: middle; margin-right: 8px; color: var(--color-accent);"></i> Dr. ${currentStaff.name.replace('Dr. ', '')} Console`;
    
    try {
        const url = `/api/doctor/patients?doctor_name=${encodeURIComponent(currentStaff.name)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to fetch patient queue.', 'error');
            return;
        }
        
        const queueList = document.getElementById('doctor-queue-list');
        queueList.innerHTML = '';
        
        if (data.patients && data.patients.length > 0) {
            data.patients.forEach(p => {
                const card = document.createElement('div');
                card.className = 'queue-card';
                card.dataset.visitId = p.visit_id;
                
                const timeStr = new Date(p.visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                card.innerHTML = `
                    <div class="queue-avatar">
                        <img src="${p.photo_path || '/static/placeholder.jpg'}" alt="${p.name}">
                    </div>
                    <div class="queue-info">
                        <h4>${p.name}</h4>
                        <p>${p.age} yrs • ${p.gender} • Registered ${timeStr}</p>
                    </div>
                    <span class="queue-badge" style="background: rgba(6,182,212,0.15); color: var(--color-accent); font-size: 0.65rem;">
                        ${p.symptom_category}
                    </span>
                `;
                
                // Click queue card to load consult details
                card.addEventListener('click', () => {
                    // Remove active from all
                    queueList.querySelectorAll('.queue-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    openPatientConsultation(p);
                });
                
                queueList.appendChild(card);
            });
        } else {
            queueList.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 32px 16px;">
                    <i data-lucide="check-circle" style="width: 32px; height: 32px; color: var(--color-success); margin-bottom: 8px; opacity: 0.6;"></i>
                    <p style="font-size: 0.9rem;">Queue is empty!</p>
                    <p style="font-size: 0.8rem; margin-top: 2px;">No pending patients assigned today.</p>
                </div>
            `;
        }
        
        lucide.createIcons();
        if (currentStaff && currentStaff.name) {
            loadDoctorAppointments(currentStaff.name);
        }
    } catch (err) {
        console.error('Error loading doctor queue:', err);
        showToast('Connection to queue server failed.', 'error');
    }
}

function openPatientConsultation(patient) {
    selectedVisit = patient;
    document.getElementById('doctor-consult-empty').style.display = 'none';
    document.getElementById('doctor-consult-panel').style.display = 'block';
    
    // Set text elements
    document.getElementById('doc-patient-name').textContent = patient.name;
    document.getElementById('doc-patient-id').textContent = `#${patient.patient_id}`;
    document.getElementById('doc-patient-age-gender').textContent = `${patient.age} / ${patient.gender}`;
    document.getElementById('doc-patient-contact').textContent = patient.contact;
    document.getElementById('doc-patient-complaint').textContent = patient.symptom_category.toUpperCase();
    document.getElementById('doc-patient-symptom-desc').textContent = patient.symptom_details || 'No additional details provided.';
    document.getElementById('doc-patient-photo').src = patient.photo_path || '/static/placeholder.jpg';
    document.getElementById('doc-active-visit-id').value = patient.visit_id;
    
    // Set diagnosis, prescription, and advice
    document.getElementById('doc-diagnosis').value = patient.diagnosis || '';
    document.getElementById('doc-prescription').value = patient.prescription || '';
    document.getElementById('doc-treatment-notes').value = patient.treatment_notes || '';
    
    document.getElementById('doc-diagnosis').focus();
}

// Doctor Treatment Form Submission
const docTreatmentForm = document.getElementById('doctor-treatment-form');
if (docTreatmentForm) {
    docTreatmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const visitId = parseInt(document.getElementById('doc-active-visit-id').value, 10);
        const diagnosis = document.getElementById('doc-diagnosis').value.trim();
        const prescription = document.getElementById('doc-prescription').value.trim();
        const notes = document.getElementById('doc-treatment-notes').value.trim();
        
        if (!visitId) return;
        
        const submitBtn = docTreatmentForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="status-dot" style="background-color: white; box-shadow: none;"></span> Submitting...';
        
        try {
            const response = await fetch('/api/doctor/treat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    visit_id: visitId, 
                    diagnosis: diagnosis,
                    prescription: prescription,
                    treatment_notes: notes 
                })
            });
            const data = await response.json();
            
            if (data.success) {
                showToast('Prescription and treatment recorded successfully!', 'success');
                
                // Populate prescription print modal
                document.getElementById('print-presc-patient-name').textContent = selectedVisit ? selectedVisit.name : '-';
                document.getElementById('print-presc-patient-age-gender').textContent = selectedVisit ? `${selectedVisit.age} / ${selectedVisit.gender}` : '-';
                document.getElementById('print-presc-patient-contact').textContent = selectedVisit ? selectedVisit.contact : '-';
                document.getElementById('print-presc-date').textContent = new Date().toLocaleDateString('en-GB');
                document.getElementById('print-presc-doc-name').textContent = currentStaff ? currentStaff.name : '-';
                document.getElementById('print-presc-doc-dept').textContent = selectedVisit ? selectedVisit.department : (currentStaff ? currentStaff.department : '-');
                document.getElementById('print-presc-diagnosis').textContent = diagnosis;
                document.getElementById('print-presc-medication').textContent = prescription;
                document.getElementById('print-presc-notes').textContent = notes;
                
                // Show modal
                document.getElementById('modal-doctor-prescription-print').style.display = 'flex';
                
                docTreatmentForm.reset();
                
                // Hide consult panel and show empty state
                document.getElementById('doctor-consult-panel').style.display = 'none';
                document.getElementById('doctor-consult-empty').style.display = 'flex';
                
                loadDoctorDashboard(); // Reload queue
            } else {
                showToast(data.message || 'Failed to submit treatment.', 'error');
            }
        } catch (err) {
            console.error('Submit treatment error:', err);
            showToast('Connection to database failed.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// Generic Modal Helpers
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.toggleTransferTypeFields = function() {
    const type = document.getElementById('transfer-type-select').value;
    const wardFields = document.getElementById('transfer-ward-fields');
    const hospitalFields = document.getElementById('transfer-hospital-fields');
    
    if (type === 'ward') {
        wardFields.style.display = 'block';
        hospitalFields.style.display = 'none';
    } else {
        wardFields.style.display = 'none';
        hospitalFields.style.display = 'block';
    }
};

window.addEventListener('click', (e) => {
    ['modal-update-patient', 'modal-transfer-patient', 'modal-death-patient', 'modal-edit-doctor'].forEach(id => {
        const modal = document.getElementById(id);
        if (e.target === modal) {
            closeModal(id);
        }
    });
});

// Tab Switching in Receptionist Dashboard
const recepTabPatients = document.getElementById('recep-tab-patients');
const recepTabDoctors = document.getElementById('recep-tab-doctors');
const recepPatientsSection = document.getElementById('recep-patients-section');
const recepDoctorsSection = document.getElementById('recep-doctors-section');

if (recepTabPatients && recepTabDoctors) {
    recepTabPatients.addEventListener('click', () => {
        recepTabPatients.style.background = 'var(--color-accent)';
        recepTabPatients.style.color = 'white';
        recepTabPatients.style.border = 'none';
        
        recepTabDoctors.style.background = 'rgba(255,255,255,0.05)';
        recepTabDoctors.style.color = 'var(--text-secondary)';
        recepTabDoctors.style.border = '1px solid rgba(255,255,255,0.1)';
        
        recepPatientsSection.style.display = 'block';
        recepDoctorsSection.style.display = 'none';
        loadReceptionistDashboard();
    });
    
    recepTabDoctors.addEventListener('click', () => {
        recepTabDoctors.style.background = 'var(--color-accent)';
        recepTabDoctors.style.color = 'white';
        recepTabDoctors.style.border = 'none';
        
        recepTabPatients.style.background = 'rgba(255,255,255,0.05)';
        recepTabPatients.style.color = 'var(--text-secondary)';
        recepTabPatients.style.border = '1px solid rgba(255,255,255,0.1)';
        
        recepPatientsSection.style.display = 'none';
        recepDoctorsSection.style.display = 'block';
        loadDoctorsDirectory();
    });
}

function hasPermission(permName) {
    if (!currentStaff) return false;
    if (currentStaff.role === 'admin') return true;
    if (currentStaff.role === 'receptionist') {
        const permsStr = currentStaff.permissions || '';
        const perms = permsStr.split(',');
        return perms.includes(permName);
    }
    return false;
}

function applyReceptionistPermissions() {
    const btnNewPatient = document.getElementById('btn-receptionist-new-patient');
    if (btnNewPatient) {
        btnNewPatient.style.display = hasPermission('register_patient') ? 'flex' : 'none';
    }

    const tabApts = document.getElementById('recep-tab-appointments');
    if (tabApts) {
        tabApts.style.display = (hasPermission('book_appointment') || hasPermission('checkin_appointment')) ? 'flex' : 'none';
    }

    const verificationPanel = document.getElementById('recep-apt-verification-panel');
    if (verificationPanel) {
        verificationPanel.style.display = hasPermission('checkin_appointment') ? 'block' : 'none';
    }
}

function refreshPatientData() {
    if (currentStaff && currentStaff.role === 'admin') {
        loadAdminPatients();
    } else {
        loadReceptionistDashboard();
    }
}

// 3. Receptionist Dashboard Loader
async function loadReceptionistDashboard() {
    applyReceptionistPermissions();
    try {
        const response = await fetch('/api/receptionist/patients');
        const data = await response.json();
        
        if (!data.success) {
            showToast('Failed to fetch patient directory.', 'error');
            return;
        }
        
        renderReceptionistDirectory(data.patients);
    } catch (err) {
        console.error('Error loading receptionist stats:', err);
        showToast('Connection to server failed.', 'error');
    }
}

async function loadDoctorsDirectory() {
    try {
        const response = await fetch('/api/receptionist/doctors');
        const data = await response.json();
        if (!data.success) {
            showToast('Failed to load doctors list', 'error');
            return;
        }
        renderReceptionistDoctors(data.doctors);
    } catch (err) {
        console.error('Error loading doctor list:', err);
        showToast('Connection to server failed.', 'error');
    }
}

function renderReceptionistDoctors(doctors) {
    const tableBody = document.getElementById('receptionist-doctors-table');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    doctors.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px 8px; font-weight: bold; color: var(--text-muted);">${d.username}</td>
            <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary);">${d.name}</td>
            <td style="padding: 10px 8px;">${d.department}</td>
            <td style="padding: 10px 8px;">${d.room_number}</td>
            <td style="padding: 10px 8px; color: var(--color-success); font-weight: 600;">₹${d.consultation_fee}</td>
            <td style="padding: 10px 8px;">
                <span class="queue-badge" style="background: ${d.status === 'Available' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${d.status === 'Available' ? 'var(--color-success)' : 'var(--color-danger)'};">
                    ${d.status}
                </span>
            </td>
            <td style="padding: 10px 8px; text-align: center;">
                <button class="btn btn-outline btn-edit-doc" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm);"><i data-lucide="edit-3" style="width: 12px; height: 12px; margin-right: 4px; vertical-align: middle;"></i>Edit</button>
            </td>
        `;
        
        tr.querySelector('.btn-edit-doc').addEventListener('click', () => {
            document.getElementById('edit-doctor-id').value = d.id;
            document.getElementById('edit-doctor-name').value = d.name;
            document.getElementById('edit-doctor-dept').value = d.department;
            document.getElementById('edit-doctor-room').value = d.room_number;
            document.getElementById('edit-doctor-fee').value = d.consultation_fee;
            document.getElementById('edit-doctor-status').value = d.status;
            openModal('modal-edit-doctor');
        });
        
        tableBody.appendChild(tr);
    });
    
    lucide.createIcons();
}

function renderReceptionistDirectory(patients) {
    const tableBody = document.getElementById('receptionist-directory-table');
    tableBody.innerHTML = '';
    
    if (patients && patients.length > 0) {
        patients.forEach(p => {
            const regDate = new Date(p.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Format Status & Location Badge
            let statusColor = 'var(--color-accent)';
            let statusBg = 'rgba(6, 182, 212, 0.15)';
            if (p.status === 'Discharged') {
                statusColor = 'var(--text-muted)';
                statusBg = 'rgba(255, 255, 255, 0.08)';
            } else if (p.status === 'Deceased') {
                statusColor = 'var(--color-danger)';
                statusBg = 'rgba(239, 68, 68, 0.15)';
            } else if (p.status === 'Transferred') {
                statusColor = 'var(--color-warning)';
                statusBg = 'rgba(245, 158, 11, 0.15)';
            }
            
            const locationStr = p.status === 'Active' ? `${p.current_ward} (${p.ward_room || 'No bed'})` : p.status;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px 8px; color: var(--text-muted);">#${p.id}</td>
                <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <img src="${p.photo_path || '/static/placeholder.jpg'}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); flex-shrink: 0;">
                    <span>${p.name}</span>
                </td>
                <td style="padding: 10px 8px;">${p.age} yrs / ${p.gender}</td>
                <td style="padding: 10px 8px;">${p.contact}</td>
                <td style="padding: 10px 8px;">
                    <span class="queue-badge" style="background: ${statusBg}; color: ${statusColor}; font-size: 0.75rem;">
                        ${locationStr}
                    </span>
                </td>
                <td style="padding: 10px 8px; color: var(--text-muted);">${regDate}</td>
                <td style="padding: 10px 8px; text-align: center; display: flex; justify-content: center; gap: 8px;">
                    <button class="btn btn-outline btn-open-profile" title="Open Dashboard" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm);"><i data-lucide="external-link" style="width: 14px; height: 14px;"></i></button>
                    ${hasPermission('register_patient') ? `<button class="btn btn-outline btn-edit-patient" title="Edit Profile" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(6, 182, 212, 0.3); color: var(--color-accent);"><i data-lucide="edit-2" style="width: 14px; height: 14px;"></i></button>` : ''}
                    ${hasPermission('transfer_patient') ? `<button class="btn btn-outline btn-transfer-patient" title="Shift Ward/Hospital" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(245, 158, 11, 0.3); color: var(--color-warning);"><i data-lucide="git-compare" style="width: 14px; height: 14px;"></i></button>` : ''}
                    ${hasPermission('discharge_patient') ? `<button class="btn btn-outline btn-discharge-patient" title="Discharge" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(34, 197, 94, 0.3); color: var(--color-success);"><i data-lucide="log-out" style="width: 14px; height: 14px;"></i></button>` : ''}
                    ${hasPermission('report_death') ? `<button class="btn btn-outline btn-death-patient" title="Record Death" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(239, 68, 68, 0.3); color: var(--color-danger);"><i data-lucide="heart-off" style="width: 14px; height: 14px;"></i></button>` : ''}
                    ${hasPermission('delete_patient') ? `<button class="btn btn-outline btn-delete-patient" title="Delete Patient Record" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(239, 68, 68, 0.5); color: var(--color-danger);"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>` : ''}
                </td>
            `;
            
            // Bind actions if elements exist
            const btnOpen = tr.querySelector('.btn-open-profile');
            if (btnOpen) {
                btnOpen.addEventListener('click', () => {
                    showScreen('existing');
                    searchResultsGrid.style.display = 'none';
                    resultsCount.style.display = 'none';
                    showPatientDashboard(p);
                });
            }
            
            const btnEdit = tr.querySelector('.btn-edit-patient');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => {
                    document.getElementById('edit-patient-id').value = p.id;
                    document.getElementById('edit-patient-name').value = p.name;
                    document.getElementById('edit-patient-age').value = p.age;
                    document.getElementById('edit-patient-gender').value = p.gender;
                    document.getElementById('edit-patient-contact').value = p.contact;
                    openModal('modal-update-patient');
                });
            }
            
            const btnTransfer = tr.querySelector('.btn-transfer-patient');
            if (btnTransfer) {
                btnTransfer.addEventListener('click', () => {
                    document.getElementById('transfer-patient-id').value = p.id;
                    document.getElementById('transfer-type-select').value = 'ward';
                    toggleTransferTypeFields();
                    if (p.current_ward && p.current_ward !== 'Outpatient' && p.current_ward !== 'Discharged' && p.current_ward !== 'Deceased' && p.current_ward !== 'Transferred Out') {
                        document.getElementById('transfer-ward').value = p.current_ward;
                    }
                    document.getElementById('transfer-room').value = p.ward_room || '';
                    openModal('modal-transfer-patient');
                });
            }
            
            const btnDischarge = tr.querySelector('.btn-discharge-patient');
            if (btnDischarge) {
                btnDischarge.addEventListener('click', async () => {
                    if (!confirm(`Are you sure you want to discharge patient ${p.name}?`)) return;
                    try {
                        const response = await fetch('/api/receptionist/patient/discharge', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: p.id })
                        });
                        const data = await response.json();
                        if (data.success) {
                            showToast(`${p.name} discharged successfully`, 'success');
                            refreshPatientData();
                        } else {
                            showToast(data.message || 'Discharge failed', 'error');
                        }
                    } catch (err) {
                        console.error('Error discharging:', err);
                        showToast('Connection failed.', 'error');
                    }
                });
            }
            
            const btnDeath = tr.querySelector('.btn-death-patient');
            if (btnDeath) {
                btnDeath.addEventListener('click', () => {
                    document.getElementById('death-patient-id').value = p.id;
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    document.getElementById('death-date').value = now.toISOString().slice(0, 16);
                    document.getElementById('death-cause').value = '';
                    openModal('modal-death-patient');
                });
            }
            
            const btnDelete = tr.querySelector('.btn-delete-patient');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (!confirm(`⚠️ WARNING: Are you sure you want to delete patient ${p.name} and all their clinical/visit history? This action is permanent.`)) return;
                    try {
                        const response = await fetch('/api/receptionist/patient/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: p.id })
                        });
                        const data = await response.json();
                        if (data.success) {
                            showToast(`${p.name} deleted successfully`, 'success');
                            refreshPatientData();
                        } else {
                            showToast(data.message || 'Delete failed', 'error');
                        }
                    } catch (err) {
                        console.error('Error deleting patient:', err);
                        showToast('Connection failed.', 'error');
                    }
                });
            }
            
            tableBody.appendChild(tr);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">No patient records match the search.</td></tr>`;
    }
    
    lucide.createIcons();
}

// Modal Form Submissions
const formUpdatePatient = document.getElementById('form-update-patient');
if (formUpdatePatient) {
    formUpdatePatient.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-patient-id').value, 10);
        const name = document.getElementById('edit-patient-name').value.trim();
        const age = parseInt(document.getElementById('edit-patient-age').value, 10);
        const gender = document.getElementById('edit-patient-gender').value;
        const contact = document.getElementById('edit-patient-contact').value.trim();
        
        try {
            const response = await fetch('/api/receptionist/patient/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, age, gender, contact })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Patient details updated successfully!', 'success');
                closeModal('modal-update-patient');
                loadReceptionistDashboard();
            } else {
                showToast(data.message || 'Failed to update patient.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed.', 'error');
        }
    });
}

const formTransferPatient = document.getElementById('form-transfer-patient');
if (formTransferPatient) {
    formTransferPatient.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('transfer-patient-id').value, 10);
        const transfer_type = document.getElementById('transfer-type-select').value;
        
        let payload = { id, transfer_type };
        if (transfer_type === 'ward') {
            payload.ward = document.getElementById('transfer-ward').value;
            payload.room = document.getElementById('transfer-room').value.trim();
        } else {
            payload.hospital_name = document.getElementById('transfer-hospital-name').value.trim();
        }
        
        try {
            const response = await fetch('/api/receptionist/patient/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                showToast('Transfer completed successfully!', 'success');
                closeModal('modal-transfer-patient');
                loadReceptionistDashboard();
            } else {
                showToast(data.message || 'Transfer failed.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed.', 'error');
        }
    });
}

const formDeathPatient = document.getElementById('form-death-patient');
if (formDeathPatient) {
    formDeathPatient.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('death-patient-id').value, 10);
        const death_date = document.getElementById('death-date').value;
        const death_cause = document.getElementById('death-cause').value.trim();
        
        try {
            const response = await fetch('/api/receptionist/patient/death', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, death_date, death_cause })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Registry recorded successfully.', 'success');
                closeModal('modal-death-patient');
                loadReceptionistDashboard();
            } else {
                showToast(data.message || 'Failed to record registry.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed.', 'error');
        }
    });
}

const formEditDoctor = document.getElementById('form-edit-doctor');
if (formEditDoctor) {
    formEditDoctor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-doctor-id').value, 10);
        const department = document.getElementById('edit-doctor-dept').value;
        const room_number = document.getElementById('edit-doctor-room').value.trim();
        const consultation_fee = parseInt(document.getElementById('edit-doctor-fee').value, 10);
        const status = document.getElementById('edit-doctor-status').value;
        
        try {
            const response = await fetch('/api/receptionist/doctors/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, department, room_number, consultation_fee, status })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Doctor configuration updated!', 'success');
                closeModal('modal-edit-doctor');
                loadDoctorsDirectory();
            } else {
                showToast(data.message || 'Failed to update configuration.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed.', 'error');
        }
    });
}

// Receptionist Search Action
const btnRecepSearchTrigger = document.getElementById('btn-receptionist-search-trigger');
const recepSearchInput = document.getElementById('receptionist-search-input');

if (btnRecepSearchTrigger && recepSearchInput) {
    const handleRecepSearch = async () => {
        const query = recepSearchInput.value.trim();
        if (!query) {
            loadReceptionistDashboard();
            return;
        }
        
        try {
            const url = `/api/search_patient?query=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                renderReceptionistDirectory(data.patients);
            } else {
                showToast(data.message || 'Search failed.', 'error');
            }
        } catch (err) {
            console.error('Recep search error:', err);
            showToast('Connection to search server failed.', 'error');
        }
    };
    
    btnRecepSearchTrigger.addEventListener('click', handleRecepSearch);
    recepSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRecepSearch();
    });
}

// Receptionist New Patient Quick Jump
const btnRecepNewPatient = document.getElementById('btn-receptionist-new-patient');
if (btnRecepNewPatient) {
    btnRecepNewPatient.addEventListener('click', () => {
        showScreen('registration');
        startWebcam();
        resetForm();
    });
}

// =========================================================================
// SUPER ADMIN DASHBOARD CONTROLLERS & WORKFLOWS
// =========================================================================

const adminTabOverview = document.getElementById('admin-tab-overview');
const adminTabDoctors = document.getElementById('admin-tab-doctors');
const adminTabReceptionists = document.getElementById('admin-tab-receptionists');
const adminTabPatients = document.getElementById('admin-tab-patients');

const adminOverviewSection = document.getElementById('admin-overview-section');
const adminDoctorsSection = document.getElementById('admin-doctors-section');
const adminReceptionistsSection = document.getElementById('admin-receptionists-section');
const adminPatientsSection = document.getElementById('admin-patients-section');

// Function to reset all admin tab button styles
function resetAdminTabs() {
    const tabs = [adminTabOverview, adminTabDoctors, adminTabReceptionists, adminTabPatients];
    tabs.forEach(tab => {
        if (tab) {
            tab.style.background = 'rgba(255,255,255,0.05)';
            tab.style.color = 'var(--text-secondary)';
            tab.style.border = '1px solid rgba(255,255,255,0.1)';
        }
    });
}

function setActiveAdminTab(activeTab, activeSection) {
    resetAdminTabs();
    if (activeTab) {
        activeTab.style.background = 'var(--color-accent)';
        activeTab.style.color = 'white';
        activeTab.style.border = 'none';
    }
    
    const sections = [adminOverviewSection, adminDoctorsSection, adminReceptionistsSection, adminPatientsSection];
    sections.forEach(sec => {
        if (sec) sec.style.display = 'none';
    });
    if (activeSection) {
        activeSection.style.display = 'block';
    }
}

if (adminTabOverview) {
    adminTabOverview.addEventListener('click', () => {
        setActiveAdminTab(adminTabOverview, adminOverviewSection);
        loadAdminDashboard();
    });
    adminTabDoctors.addEventListener('click', () => {
        setActiveAdminTab(adminTabDoctors, adminDoctorsSection);
        loadAdminDoctors();
    });
    adminTabReceptionists.addEventListener('click', () => {
        setActiveAdminTab(adminTabReceptionists, adminReceptionistsSection);
        loadAdminReceptionists();
    });
    adminTabPatients.addEventListener('click', () => {
        setActiveAdminTab(adminTabPatients, adminPatientsSection);
        loadAdminPatients();
    });
}

// 1. MANAGE DOCTORS LOGIC
async function loadAdminDoctors() {
    try {
        const response = await fetch('/api/receptionist/doctors');
        const data = await response.json();
        if (!data.success) {
            showToast('Failed to load doctor directory.', 'error');
            return;
        }
        
        const tableBody = document.getElementById('admin-doctors-table-body');
        tableBody.innerHTML = '';
        
        data.doctors.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px 8px; font-weight: bold; color: var(--text-muted);">${d.username}</td>
                <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary);">${d.name}</td>
                <td style="padding: 10px 8px;">${d.department}</td>
                <td style="padding: 10px 8px;">${d.room_number}</td>
                <td style="padding: 10px 8px; color: var(--color-success); font-weight: 600;">₹${d.consultation_fee}</td>
                <td style="padding: 10px 8px;">
                    <span class="queue-badge" style="background: ${d.status === 'Available' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${d.status === 'Available' ? 'var(--color-success)' : 'var(--color-danger)'};">
                        ${d.status}
                    </span>
                </td>
                <td style="padding: 10px 8px; text-align: center;">
                    <button class="btn btn-outline btn-admin-edit-doctor" style="padding: 4px 8px; font-size: 0.8rem; border-color: rgba(6,182,212,0.3); color: var(--color-accent); margin-right: 4px;"><i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Edit</button>
                    <button class="btn btn-outline btn-admin-delete-doctor" style="padding: 4px 8px; font-size: 0.8rem; border-color: rgba(239,68,68,0.3); color: var(--color-danger);"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Delete</button>
                </td>
            `;
            
            // Edit trigger
            tr.querySelector('.btn-admin-edit-doctor').addEventListener('click', () => {
                document.getElementById('admin-doctor-modal-title').textContent = 'Edit Doctor Details';
                document.getElementById('admin-doctor-id').value = d.id;
                document.getElementById('admin-doctor-name').value = d.name;
                document.getElementById('admin-doctor-username').value = d.username;
                document.getElementById('admin-doctor-password').value = '';
                document.getElementById('admin-doctor-password').placeholder = 'Enter password (changes existing)';
                document.getElementById('admin-doctor-dept').value = d.department;
                document.getElementById('admin-doctor-room').value = d.room_number;
                document.getElementById('admin-doctor-fee').value = d.consultation_fee;
                document.getElementById('admin-doctor-status').value = d.status;
                document.getElementById('admin-doctor-experience').value = d.experience_years || 0;
                document.getElementById('admin-doctor-qualification').value = d.qualification || '';
                document.getElementById('admin-doctor-bio').value = d.bio || '';
                openModal('modal-admin-doctor');
            });
            
            // Delete trigger
            tr.querySelector('.btn-admin-delete-doctor').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete Dr. ${d.name} (${d.username})?`)) {
                    try {
                        const res = await fetch('/api/admin/doctor/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: d.id })
                        });
                        const resData = await res.json();
                        if (resData.success) {
                            showToast('Doctor profile deleted successfully.', 'success');
                            loadAdminDoctors();
                        } else {
                            showToast(resData.message, 'error');
                        }
                    } catch (err) {
                        showToast('Failed to delete doctor.', 'error');
                    }
                }
            });
            
            tableBody.appendChild(tr);
        });
        
        lucide.createIcons();
    } catch (err) {
        console.error('Error loading admin doctors directory:', err);
    }
}

// Add New Doctor Button
const btnAdminAddDoctor = document.getElementById('btn-admin-add-doctor');
if (btnAdminAddDoctor) {
    btnAdminAddDoctor.addEventListener('click', () => {
        document.getElementById('admin-doctor-modal-title').textContent = 'Add New Doctor';
        document.getElementById('admin-doctor-id').value = '';
        document.getElementById('admin-doctor-name').value = '';
        document.getElementById('admin-doctor-username').value = '';
        document.getElementById('admin-doctor-password').value = '';
        document.getElementById('admin-doctor-password').placeholder = 'Enter password';
        document.getElementById('admin-doctor-dept').value = 'General Medicine';
        document.getElementById('admin-doctor-room').value = '';
        document.getElementById('admin-doctor-fee').value = '';
        document.getElementById('admin-doctor-status').value = 'Available';
        document.getElementById('admin-doctor-experience').value = '';
        document.getElementById('admin-doctor-qualification').value = '';
        document.getElementById('admin-doctor-bio').value = '';
        openModal('modal-admin-doctor');
    });
}

// Save Doctor Form Submit
const formAdminDoctor = document.getElementById('form-admin-doctor');
if (formAdminDoctor) {
    formAdminDoctor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const docId = document.getElementById('admin-doctor-id').value;
        const name = document.getElementById('admin-doctor-name').value.trim();
        const username = document.getElementById('admin-doctor-username').value.trim();
        const password = document.getElementById('admin-doctor-password').value.trim();
        const department = document.getElementById('admin-doctor-dept').value;
        const room = document.getElementById('admin-doctor-room').value.trim();
        const fee = document.getElementById('admin-doctor-fee').value;
        const status = document.getElementById('admin-doctor-status').value;
        const experience = parseInt(document.getElementById('admin-doctor-experience').value) || 0;
        const qualification = document.getElementById('admin-doctor-qualification').value.trim();
        const bio = document.getElementById('admin-doctor-bio').value.trim();
        
        if (!docId && !password) {
            showToast('Password is required for new doctors.', 'error');
            return;
        }
        
        const payload = {
            username,
            name,
            department,
            room_number: room,
            consultation_fee: parseInt(fee),
            status,
            experience_years: experience,
            qualification,
            bio
        };
        
        if (password) payload.password = password;
        
        let url = '/api/admin/doctor/add';
        if (docId) {
            payload.id = parseInt(docId);
            url = '/api/admin/doctor/update';
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                showToast(data.message || 'Doctor saved successfully!', 'success');
                closeModal('modal-admin-doctor');
                loadAdminDoctors();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            showToast('Failed to save doctor details.', 'error');
        }
    });
}

// 2. MANAGE RECEPTIONISTS LOGIC
async function loadAdminReceptionists() {
    try {
        const response = await fetch('/api/admin/receptionists');
        const data = await response.json();
        if (!data.success) {
            showToast('Failed to load receptionists.', 'error');
            return;
        }
        
        const tableBody = document.getElementById('admin-receptionists-table-body');
        tableBody.innerHTML = '';
        
        data.receptionists.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px 8px; font-weight: bold; color: var(--text-muted);">${r.username}</td>
                <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary);">${r.name}</td>
                <td style="padding: 10px 8px; font-family: monospace;">••••••••</td>
                <td style="padding: 10px 8px; text-align: center;">
                    <button class="btn btn-outline btn-admin-edit-recep" style="padding: 4px 8px; font-size: 0.8rem; border-color: rgba(6,182,212,0.3); color: var(--color-accent); margin-right: 4px;"><i data-lucide="edit-2" style="width: 12px; height: 12px;"></i> Edit</button>
                    <button class="btn btn-outline btn-admin-delete-recep" style="padding: 4px 8px; font-size: 0.8rem; border-color: rgba(239,68,68,0.3); color: var(--color-danger);"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Delete</button>
                </td>
            `;
            
            // Edit trigger
            tr.querySelector('.btn-admin-edit-recep').addEventListener('click', () => {
                document.getElementById('admin-recep-modal-title').textContent = 'Edit Receptionist Details';
                document.getElementById('admin-recep-id').value = r.id;
                document.getElementById('admin-recep-name').value = r.name;
                document.getElementById('admin-recep-username').value = r.username;
                document.getElementById('admin-recep-password').value = r.password;
                
                // Set permissions checkboxes
                const perms = (r.permissions || '').split(',');
                document.getElementById('perm-register').checked = perms.includes('register_patient');
                document.getElementById('perm-book').checked = perms.includes('book_appointment');
                document.getElementById('perm-checkin').checked = perms.includes('checkin_appointment');
                document.getElementById('perm-transfer').checked = perms.includes('transfer_patient');
                document.getElementById('perm-discharge').checked = perms.includes('discharge_patient');
                document.getElementById('perm-death').checked = perms.includes('report_death');
                document.getElementById('perm-delete').checked = perms.includes('delete_patient');
                
                openModal('modal-admin-receptionist');
            });
            
            // Delete trigger
            tr.querySelector('.btn-admin-delete-recep').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete receptionist ${r.name}?`)) {
                    try {
                        const res = await fetch('/api/admin/receptionist/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: r.id })
                        });
                        const resData = await res.json();
                        if (resData.success) {
                            showToast('Receptionist deleted.', 'success');
                            loadAdminReceptionists();
                        } else {
                            showToast(resData.message, 'error');
                        }
                    } catch (err) {
                        showToast('Failed to delete receptionist.', 'error');
                    }
                }
            });
            
            tableBody.appendChild(tr);
        });
        
        lucide.createIcons();
    } catch (err) {
        console.error('Error loading receptionists:', err);
    }
}

// Add New Receptionist Button
const btnAdminAddRecep = document.getElementById('btn-admin-add-receptionist');
if (btnAdminAddRecep) {
    btnAdminAddRecep.addEventListener('click', () => {
        document.getElementById('admin-recep-modal-title').textContent = 'Add New Receptionist';
        document.getElementById('admin-recep-id').value = '';
        document.getElementById('admin-recep-name').value = '';
        document.getElementById('admin-recep-username').value = '';
        document.getElementById('admin-recep-password').value = '';
        
        // Reset permissions checks to checked by default
        document.getElementById('perm-register').checked = true;
        document.getElementById('perm-book').checked = true;
        document.getElementById('perm-checkin').checked = true;
        document.getElementById('perm-transfer').checked = true;
        document.getElementById('perm-discharge').checked = true;
        document.getElementById('perm-death').checked = true;
        document.getElementById('perm-delete').checked = true;
        
        openModal('modal-admin-receptionist');
    });
}

// Save Receptionist Form Submit
const formAdminRecep = document.getElementById('form-admin-receptionist');
if (formAdminRecep) {
    formAdminRecep.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rId = document.getElementById('admin-recep-id').value;
        const name = document.getElementById('admin-recep-name').value.trim();
        const username = document.getElementById('admin-recep-username').value.trim();
        const password = document.getElementById('admin-recep-password').value.trim();
        
        const permsList = [];
        if (document.getElementById('perm-register').checked) permsList.push('register_patient');
        if (document.getElementById('perm-book').checked) permsList.push('book_appointment');
        if (document.getElementById('perm-checkin').checked) permsList.push('checkin_appointment');
        if (document.getElementById('perm-transfer').checked) permsList.push('transfer_patient');
        if (document.getElementById('perm-discharge').checked) permsList.push('discharge_patient');
        if (document.getElementById('perm-death').checked) permsList.push('report_death');
        if (document.getElementById('perm-delete').checked) permsList.push('delete_patient');
        const permissions = permsList.join(',');
        
        const payload = { name, username, password, permissions };
        let url = '/api/admin/receptionist/add';
        if (rId) {
            payload.id = parseInt(rId);
            url = '/api/admin/receptionist/update';
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                showToast(data.message || 'Receptionist saved successfully!', 'success');
                closeModal('modal-admin-receptionist');
                loadAdminReceptionists();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            showToast('Failed to save receptionist.', 'error');
        }
    });
}

// 3. COMPLETE PATIENT RECORD LOGS LOGIC
async function loadAdminPatients() {
    try {
        const response = await fetch('/api/receptionist/patients');
        const data = await response.json();
        if (!data.success) {
            showToast('Failed to load patient records.', 'error');
            return;
        }
        
        const dbTable = document.getElementById('admin-patients-db-table');
        dbTable.innerHTML = '';
        
        data.patients.forEach(p => {
            const regDate = new Date(p.registered_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Format Status & Location Badge
            let statusColor = 'var(--color-accent)';
            let statusBg = 'rgba(6, 182, 212, 0.15)';
            if (p.status === 'Discharged') {
                statusColor = 'var(--text-muted)';
                statusBg = 'rgba(255, 255, 255, 0.08)';
            } else if (p.status === 'Deceased') {
                statusColor = 'var(--color-danger)';
                statusBg = 'rgba(239, 68, 68, 0.15)';
            } else if (p.status === 'Transferred') {
                statusColor = 'var(--color-warning)';
                statusBg = 'rgba(245, 158, 11, 0.15)';
            }
            
            const locationStr = p.status === 'Active' ? `${p.current_ward} (${p.ward_room || 'No bed'})` : p.status;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px 8px; color: var(--text-muted);">#${p.id}</td>
                <td style="padding: 10px 8px; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <img src="${p.photo_path || '/static/placeholder.jpg'}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); flex-shrink: 0;">
                    <span>${p.name}</span>
                </td>
                <td style="padding: 10px 8px;">${p.age} yrs / ${p.gender}</td>
                <td style="padding: 10px 8px; color: var(--text-secondary);">${p.contact}</td>
                <td style="padding: 10px 8px;">
                    <span class="queue-badge" style="background: ${statusBg}; color: ${statusColor}; font-size: 0.75rem;">
                        ${locationStr}
                    </span>
                </td>
                <td style="padding: 10px 8px; color: var(--text-muted);">${regDate}</td>
                <td style="padding: 10px 8px; text-align: center; display: flex; justify-content: center; gap: 8px;">
                    <button class="btn btn-outline btn-admin-view-history" title="View Full History" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(6,182,212,0.3); color: var(--color-accent);"><i data-lucide="history" style="width: 14px; height: 14px;"></i></button>
                    <button class="btn btn-outline btn-edit-patient" title="Edit Profile" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(6, 182, 212, 0.3); color: var(--color-accent);"><i data-lucide="edit-2" style="width: 14px; height: 14px;"></i></button>
                    <button class="btn btn-outline btn-transfer-patient" title="Shift Ward/Hospital" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(245, 158, 11, 0.3); color: var(--color-warning);"><i data-lucide="git-compare" style="width: 14px; height: 14px;"></i></button>
                    <button class="btn btn-outline btn-discharge-patient" title="Discharge" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(34, 197, 94, 0.3); color: var(--color-success);"><i data-lucide="log-out" style="width: 14px; height: 14px;"></i></button>
                    <button class="btn btn-outline btn-death-patient" title="Record Death" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(239, 68, 68, 0.3); color: var(--color-danger);"><i data-lucide="heart-off" style="width: 14px; height: 14px;"></i></button>
                    <button class="btn btn-outline btn-admin-delete-patient" title="Delete Patient Record" style="padding: 6px 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border-color: rgba(239, 68, 68, 0.5); color: var(--color-danger);"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                </td>
            `;
            
            // View History click binding
            tr.querySelector('.btn-admin-view-history').addEventListener('click', () => {
                showPatientConsultationHistoryModal(p.id);
            });

            tr.querySelector('.btn-edit-patient').addEventListener('click', () => {
                document.getElementById('edit-patient-id').value = p.id;
                document.getElementById('edit-patient-name').value = p.name;
                document.getElementById('edit-patient-age').value = p.age;
                document.getElementById('edit-patient-gender').value = p.gender;
                document.getElementById('edit-patient-contact').value = p.contact;
                openModal('modal-update-patient');
            });
            
            tr.querySelector('.btn-transfer-patient').addEventListener('click', () => {
                document.getElementById('transfer-patient-id').value = p.id;
                document.getElementById('transfer-type-select').value = 'ward';
                toggleTransferTypeFields();
                if (p.current_ward && p.current_ward !== 'Outpatient' && p.current_ward !== 'Discharged' && p.current_ward !== 'Deceased' && p.current_ward !== 'Transferred Out') {
                    document.getElementById('transfer-ward').value = p.current_ward;
                }
                document.getElementById('transfer-room').value = p.ward_room || '';
                openModal('modal-transfer-patient');
            });
            
            tr.querySelector('.btn-discharge-patient').addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to discharge patient ${p.name}?`)) return;
                try {
                    const response = await fetch('/api/receptionist/patient/discharge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: p.id })
                    });
                    const data = await response.json();
                    if (data.success) {
                        showToast(`${p.name} discharged successfully`, 'success');
                        loadAdminPatients();
                    } else {
                        showToast(data.message || 'Discharge failed', 'error');
                    }
                } catch (err) {
                    console.error('Error discharging:', err);
                    showToast('Connection failed.', 'error');
                }
            });
            
            tr.querySelector('.btn-death-patient').addEventListener('click', () => {
                document.getElementById('death-patient-id').value = p.id;
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                document.getElementById('death-date').value = now.toISOString().slice(0, 16);
                document.getElementById('death-cause').value = '';
                openModal('modal-death-patient');
            });

            tr.querySelector('.btn-admin-delete-patient').addEventListener('click', async () => {
                if (!confirm(`⚠️ WARNING: Are you sure you want to delete patient ${p.name} and all associated consultation logs? This action is permanent.`)) return;
                try {
                    const response = await fetch('/api/receptionist/patient/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: p.id })
                    });
                    const data = await response.json();
                    if (data.success) {
                        showToast(`${p.name} deleted successfully`, 'success');
                        loadAdminPatients();
                    } else {
                        showToast(data.message || 'Delete failed', 'error');
                    }
                } catch (err) {
                    console.error('Error deleting patient:', err);
                    showToast('Connection failed.', 'error');
                }
            });
            
            dbTable.appendChild(tr);
        });
        
        lucide.createIcons();
    } catch (err) {
        console.error('Error loading patients list in admin:', err);
    }
}

// Show Patient History Timeline Modal
async function showPatientConsultationHistoryModal(patientId) {
    try {
        const response = await fetch(`/api/admin/patient/history/${patientId}`);
        const data = await response.json();
        if (!data.success) {
            showToast(data.message || 'Failed to load history.', 'error');
            return;
        }
        
        const p = data.patient;
        
        // Populate profile card in modal
        const infoDiv = document.getElementById('admin-history-patient-info');
        infoDiv.innerHTML = `
            <img src="${p.photo_path || '/static/placeholder.jpg'}" alt="${p.name}" style="width: 60px; height: 60px; border-radius: var(--radius-md); object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
            <div>
                <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">${p.name}</h4>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">${p.age} yrs • ${p.gender} • Contact: ${p.contact}</p>
                <span class="patient-id-badge" style="margin-top: 6px; display: inline-block;">Patient ID: #${p.id}</span>
            </div>
        `;
        
        // Populate timeline
        const timeline = document.getElementById('admin-history-timeline');
        timeline.innerHTML = '';
        
        if (data.visits && data.visits.length > 0) {
            data.visits.forEach(v => {
                const dateStr = new Date(v.visited_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                const card = document.createElement('div');
                card.className = 'history-log-card glass-panel';
                card.style.padding = '16px';
                card.style.borderRadius = 'var(--radius-md)';
                card.style.border = '1px solid rgba(255,255,255,0.06)';
                card.style.background = 'rgba(255,255,255,0.02)';
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <div>
                            <strong style="color: var(--color-accent); font-size: 0.9rem;">${v.department} Department</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">Consulting Doctor: ${v.doctor} (Room ${v.room_number})</div>
                        </div>
                        <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${dateStr}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem;">
                        <div>
                            <span style="color: var(--text-secondary);">Chief Complaint:</span>
                            <strong style="color: var(--text-primary); margin-left: 4px;">${v.symptom_details || v.symptom_category}</strong>
                        </div>
                        <div>
                            <span style="color: var(--text-secondary);">Diagnosis:</span>
                            <span style="color: var(--text-primary); margin-left: 4px; font-style: italic;">${v.diagnosis || 'Pending doctor consultation'}</span>
                        </div>
                        <div>
                            <span style="color: var(--text-secondary);">Prescription:</span>
                            <span style="color: var(--color-success); margin-left: 4px; font-family: monospace; font-weight: bold;">${v.prescription || 'N/A'}</span>
                        </div>
                        <div>
                            <span style="color: var(--text-secondary);">Advice/Follow-up:</span>
                            <span style="color: var(--text-primary); margin-left: 4px;">${v.treatment_notes || 'N/A'}</span>
                        </div>
                    </div>
                `;
                timeline.appendChild(card);
            });
        } else {
            timeline.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No check-ins logged for this patient.</p>`;
        }
        
        openModal('modal-admin-history');
    } catch (err) {
        showToast('Failed to retrieve patient history.', 'error');
    }
}

// --- APPOINTMENT BOOKING WIZARD LOGIC ---
let bookingStream = null;
let bookingPhotoBase64 = null;
let verifiedBookingPatient = null;

// Navigate to booking screen
const btnBookAppointment = document.getElementById('btn-book-appointment');
const btnBackAppointment = document.getElementById('btn-back-appointment');

if (btnBookAppointment) {
    btnBookAppointment.addEventListener('click', () => {
        screens.appointment = document.getElementById('appointment-booking-screen');
        showScreen('appointment');
        resetBookingWizard();
    });
}

if (btnBackAppointment) {
    btnBackAppointment.addEventListener('click', () => {
        showScreen('home');
        stopBookingWebcam();
    });
}

// Set up radio buttons for Patient Type selection
const bookingPatientTypeRadios = document.querySelectorAll('input[name="booking-patient-type"]');
const bookingExistingPanel = document.getElementById('booking-existing-panel');
const bookingNewPanel = document.getElementById('booking-new-panel');
const btnBookingNext1 = document.getElementById('btn-booking-next-1');

bookingPatientTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        // Toggle active style on label
        bookingPatientTypeRadios.forEach(r => {
            r.closest('.btn-check-label').style.opacity = r.checked ? '1' : '0.6';
        });
        
        if (e.target.value === 'existing') {
            bookingExistingPanel.style.display = 'block';
            bookingNewPanel.style.display = 'none';
            stopBookingWebcam();
            // Enable next only if patient verified
            btnBookingNext1.disabled = !verifiedBookingPatient;
        } else {
            bookingExistingPanel.style.display = 'none';
            bookingNewPanel.style.display = 'block';
            // Enable next only if new patient form and photo is ready
            validateNewPatientStep1();
        }
    });
});

// Webcam operations for booking
const bookingWebcam = document.getElementById('booking-webcam');
const bookingPhotoCanvas = document.getElementById('booking-photo-canvas');
const bookingPhotoPreview = document.getElementById('booking-photo-preview');
const bookingCameraPlaceholderText = document.getElementById('booking-camera-placeholder-text');
const btnBookingStartCamera = document.getElementById('btn-booking-start-camera');
const btnBookingCapturePhoto = document.getElementById('btn-booking-capture-photo');

async function startBookingWebcam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Webcam requires secure origin (localhost or HTTPS). If on Chromebook, configure Port Forwarding to localhost:5000.', 'error');
        return;
    }
    try {
        if (bookingStream) {
            stopBookingWebcam();
        }
        bookingStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        bookingWebcam.srcObject = bookingStream;
        bookingWebcam.style.display = 'block';
        bookingPhotoPreview.style.display = 'none';
        bookingCameraPlaceholderText.style.display = 'none';
        btnBookingCapturePhoto.disabled = false;
        btnBookingStartCamera.innerHTML = '<i data-lucide="video-off"></i> Stop';
        lucide.createIcons();
    } catch (err) {
        showToast('Could not access camera: ' + err.message, 'error');
    }
}

function stopBookingWebcam() {
    if (bookingStream) {
        bookingStream.getTracks().forEach(track => track.stop());
        bookingStream = null;
    }
    if (bookingWebcam) {
        bookingWebcam.srcObject = null;
        bookingWebcam.style.display = 'none';
    }
    if (bookingPhotoPreview) {
        bookingPhotoPreview.style.display = 'block';
    }
    if (bookingCameraPlaceholderText) {
        bookingCameraPlaceholderText.style.display = 'block';
        bookingCameraPlaceholderText.textContent = 'Camera is Off';
    }
    if (btnBookingStartCamera) {
        btnBookingStartCamera.innerHTML = '<i data-lucide="video"></i> Start';
        lucide.createIcons();
    }
    if (btnBookingCapturePhoto) {
        btnBookingCapturePhoto.disabled = true;
    }
}

if (btnBookingStartCamera) {
    btnBookingStartCamera.addEventListener('click', () => {
        if (bookingStream) {
            stopBookingWebcam();
        } else {
            startBookingWebcam();
        }
    });
}

if (btnBookingCapturePhoto) {
    btnBookingCapturePhoto.addEventListener('click', () => {
        if (!bookingStream) return;
        const context = bookingPhotoCanvas.getContext('2d');
        bookingPhotoCanvas.width = bookingWebcam.videoWidth || 640;
        bookingPhotoCanvas.height = bookingWebcam.videoHeight || 480;
        
        context.save();
        context.translate(bookingPhotoCanvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(bookingWebcam, 0, 0, bookingPhotoCanvas.width, bookingPhotoCanvas.height);
        context.restore();
        
        bookingPhotoBase64 = bookingPhotoCanvas.toDataURL('image/jpeg', 0.95);
        bookingPhotoPreview.src = bookingPhotoBase64;
        
        stopBookingWebcam();
        validateNewPatientStep1();
    });
}

const btnBookingUploadTrigger = document.getElementById('btn-booking-upload-trigger');
const bookingPhotoUpload = document.getElementById('booking-photo-upload');

if (btnBookingUploadTrigger && bookingPhotoUpload) {
    btnBookingUploadTrigger.addEventListener('click', () => {
        bookingPhotoUpload.click();
    });
    
    bookingPhotoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            bookingPhotoBase64 = event.target.result;
            bookingPhotoPreview.src = bookingPhotoBase64;
            
            stopBookingWebcam();
            if (bookingWebcam) bookingWebcam.style.display = 'none';
            if (bookingPhotoPreview) bookingPhotoPreview.style.display = 'block';
            if (bookingCameraPlaceholderText) bookingCameraPlaceholderText.style.display = 'none';
            
            validateNewPatientStep1();
            showToast('Face photo uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

const btnBookingUploadTrigger = document.getElementById('btn-booking-upload-trigger');
const bookingPhotoUpload = document.getElementById('booking-photo-upload');

if (btnBookingUploadTrigger && bookingPhotoUpload) {
    btnBookingUploadTrigger.addEventListener('click', () => {
        bookingPhotoUpload.click();
    });
    
    bookingPhotoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            bookingPhotoBase64 = event.target.result;
            bookingPhotoPreview.src = bookingPhotoBase64;
            
            stopBookingWebcam();
            if (bookingWebcam) bookingWebcam.style.display = 'none';
            if (bookingPhotoPreview) bookingPhotoPreview.style.display = 'block';
            if (bookingCameraPlaceholderText) bookingCameraPlaceholderText.style.display = 'none';
            
            validateNewPatientStep1();
            showToast('Face photo uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

const btnBookingUploadTrigger = document.getElementById('btn-booking-upload-trigger');
const bookingPhotoUpload = document.getElementById('booking-photo-upload');

if (btnBookingUploadTrigger && bookingPhotoUpload) {
    btnBookingUploadTrigger.addEventListener('click', () => {
        bookingPhotoUpload.click();
    });
    
    bookingPhotoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            bookingPhotoBase64 = event.target.result;
            bookingPhotoPreview.src = bookingPhotoBase64;
            
            stopBookingWebcam();
            if (bookingWebcam) bookingWebcam.style.display = 'none';
            if (bookingPhotoPreview) bookingPhotoPreview.style.display = 'block';
            if (bookingCameraPlaceholderText) bookingCameraPlaceholderText.style.display = 'none';
            
            validateNewPatientStep1();
            showToast('Face photo uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

const btnBookingUploadTrigger = document.getElementById('btn-booking-upload-trigger');
const bookingPhotoUpload = document.getElementById('booking-photo-upload');

if (btnBookingUploadTrigger && bookingPhotoUpload) {
    btnBookingUploadTrigger.addEventListener('click', () => {
        bookingPhotoUpload.click();
    });
    
    bookingPhotoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            bookingPhotoBase64 = event.target.result;
            bookingPhotoPreview.src = bookingPhotoBase64;
            
            stopBookingWebcam();
            if (bookingWebcam) bookingWebcam.style.display = 'none';
            if (bookingPhotoPreview) bookingPhotoPreview.style.display = 'block';
            if (bookingCameraPlaceholderText) bookingCameraPlaceholderText.style.display = 'none';
            
            validateNewPatientStep1();
            showToast('Face photo uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

const btnBookingUploadTrigger = document.getElementById('btn-booking-upload-trigger');
const bookingPhotoUpload = document.getElementById('booking-photo-upload');

if (btnBookingUploadTrigger && bookingPhotoUpload) {
    btnBookingUploadTrigger.addEventListener('click', () => {
        bookingPhotoUpload.click();
    });
    
    bookingPhotoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            bookingPhotoBase64 = event.target.result;
            bookingPhotoPreview.src = bookingPhotoBase64;
            
            stopBookingWebcam();
            if (bookingWebcam) bookingWebcam.style.display = 'none';
            if (bookingPhotoPreview) bookingPhotoPreview.style.display = 'block';
            if (bookingCameraPlaceholderText) bookingCameraPlaceholderText.style.display = 'none';
            
            validateNewPatientStep1();
            showToast('Face photo uploaded successfully!', 'success');
        };
        reader.readAsDataURL(file);
    });
}

// New Patient field validators
const bookingNewName = document.getElementById('booking-new-name');
const bookingNewAge = document.getElementById('booking-new-age');
const bookingNewGender = document.getElementById('booking-new-gender');
const bookingNewContact = document.getElementById('booking-new-contact');

function validateNewPatientStep1() {
    const isNew = document.querySelector('input[name="booking-patient-type"]:checked').value === 'new';
    if (!isNew) return;
    
    const nameVal = bookingNewName.value.trim();
    const ageVal = bookingNewAge.value.trim();
    const contactVal = bookingNewContact.value.trim();
    
    const isValid = nameVal && ageVal && contactVal.length >= 10 && bookingPhotoBase64;
    btnBookingNext1.disabled = !isValid;
}

if (bookingNewName) bookingNewName.addEventListener('input', validateNewPatientStep1);
if (bookingNewAge) bookingNewAge.addEventListener('input', validateNewPatientStep1);
if (bookingNewContact) bookingNewContact.addEventListener('input', validateNewPatientStep1);
if (bookingNewGender) bookingNewGender.addEventListener('change', validateNewPatientStep1);

// Existing Patient search verification
const bookingSearchInput = document.getElementById('booking-search-input');
const btnBookingSearch = document.getElementById('btn-booking-search');
const bookingSearchResult = document.getElementById('booking-search-result');

if (btnBookingSearch) {
    btnBookingSearch.addEventListener('click', async () => {
        const query = bookingSearchInput.value.trim();
        if (!query) {
            showToast('Please enter Patient ID or contact number.', 'warning');
            return;
        }
        
        btnBookingSearch.disabled = true;
        btnBookingSearch.textContent = 'Searching...';
        
        try {
            const response = await fetch(`/api/search_patient?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success && data.patients && data.patients.length > 0) {
                verifiedBookingPatient = data.patients[0];
                bookingSearchResult.style.display = 'block';
                bookingSearchResult.className = 'status-banner success-banner';
                bookingSearchResult.innerHTML = `
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--color-success);"><i data-lucide="check-circle" style="display:inline-block; width:16px; height:16px; margin-right:4px;"></i> Patient Verified!</div>
                    <div style="font-size: 0.85rem; margin-top: 4px; color: var(--text-primary);">
                        <strong>Name:</strong> ${verifiedBookingPatient.name} | <strong>ID:</strong> #${verifiedBookingPatient.id} <br>
                        <strong>Contact:</strong> ${verifiedBookingPatient.contact}
                    </div>
                `;
                btnBookingNext1.disabled = false;
                lucide.createIcons();
            } else {
                verifiedBookingPatient = null;
                bookingSearchResult.style.display = 'block';
                bookingSearchResult.className = 'status-banner error-banner';
                bookingSearchResult.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;"><i data-lucide="alert-circle" style="display:inline-block; width:16px; height:16px; margin-right:4px;"></i> Patient not found. Please register as a New Patient instead.</div>`;
                btnBookingNext1.disabled = true;
                lucide.createIcons();
            }
        } catch (err) {
            showToast('Error verifying patient.', 'error');
        } finally {
            btnBookingSearch.disabled = false;
            btnBookingSearch.textContent = 'Verify Patient';
        }
    });
}

// Existing Patient Face Scan booking path
let bookingFaceStream = null;
const bookingFaceWebcam = document.getElementById('booking-face-webcam');
const bookingFaceCanvas = document.getElementById('booking-face-canvas');
const btnBookingFaceCapture = document.getElementById('btn-booking-face-capture');
const btnBookingFaceClose = document.getElementById('btn-booking-face-close');
const btnBookingFaceCancel = document.getElementById('btn-booking-face-cancel');

async function startBookingFaceScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Webcam requires secure origin (localhost or HTTPS). If on Chromebook, configure Port Forwarding to localhost:5000.', 'error');
        return;
    }
    try {
        bookingFaceStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        bookingFaceWebcam.srcObject = bookingFaceStream;
        openModal('modal-booking-face-scan');
    } catch (err) {
        showToast('Cannot access camera: ' + err.message, 'error');
    }
}

function stopBookingFaceScan() {
    if (bookingFaceStream) {
        bookingFaceStream.getTracks().forEach(track => track.stop());
        bookingFaceStream = null;
    }
    if (bookingFaceWebcam) {
        bookingFaceWebcam.srcObject = null;
    }
    closeModal('modal-booking-face-scan');
}

const btnBookingFaceScan = document.getElementById('btn-booking-face-scan');
if (btnBookingFaceScan) {
    btnBookingFaceScan.addEventListener('click', startBookingFaceScan);
}
if (btnBookingFaceClose) btnBookingFaceClose.addEventListener('click', stopBookingFaceScan);
if (btnBookingFaceCancel) btnBookingFaceCancel.addEventListener('click', stopBookingFaceScan);

if (btnBookingFaceCapture) {
    btnBookingFaceCapture.addEventListener('click', async () => {
        if (!bookingFaceStream) return;
        
        const context = bookingFaceCanvas.getContext('2d');
        bookingFaceCanvas.width = bookingFaceWebcam.videoWidth || 640;
        bookingFaceCanvas.height = bookingFaceWebcam.videoHeight || 480;
        
        context.save();
        context.translate(bookingFaceCanvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(bookingFaceWebcam, 0, 0, bookingFaceCanvas.width, bookingFaceCanvas.height);
        context.restore();
        
        const faceBase64 = bookingFaceCanvas.toDataURL('image/jpeg', 0.95);
        
        btnBookingFaceCapture.disabled = true;
        btnBookingFaceCapture.textContent = 'Verifying Face...';
        
        bookingSearchResult.style.display = 'block';
        bookingSearchResult.className = 'status-banner';
        bookingSearchResult.innerHTML = 'Scanning face in database...';
        
        try {
            const response = await fetch('/api/scan_face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: faceBase64 })
            });
            const data = await response.json();
            
            if (data.success && data.patient) {
                stopBookingFaceScan();
                verifiedBookingPatient = data.patient;
                bookingSearchResult.className = 'status-banner success-banner';
                bookingSearchResult.innerHTML = `
                    <div style="font-weight: 600; font-size: 0.9rem; color: var(--color-success);"><i data-lucide="check-circle" style="display:inline-block; width:16px; height:16px; margin-right:4px;"></i> Face Verified!</div>
                    <div style="font-size: 0.85rem; margin-top: 4px; color: var(--text-primary);">
                        <strong>Name:</strong> ${verifiedBookingPatient.name} | <strong>ID:</strong> #${verifiedBookingPatient.id} <br>
                        <strong>Contact:</strong> ${verifiedBookingPatient.contact}
                    </div>
                `;
                btnBookingNext1.disabled = false;
                showToast(`Verified: ${verifiedBookingPatient.name}`, 'success');
            } else {
                verifiedBookingPatient = null;
                bookingSearchResult.className = 'status-banner error-banner';
                bookingSearchResult.innerHTML = `<div style="color: var(--color-danger); font-size: 0.85rem;"><i data-lucide="alert-circle" style="display:inline-block; width:16px; height:16px; margin-right:4px;"></i> Face match not found. Please try typing your ID/Phone.</div>`;
                btnBookingNext1.disabled = true;
            }
            lucide.createIcons();
        } catch (err) {
            showToast('Error scanning face.', 'error');
        } finally {
            btnBookingFaceCapture.disabled = false;
            btnBookingFaceCapture.textContent = 'Capture & Verify';
        }
    });
}

// Wizard Step Navigation
const bookingStep1 = document.getElementById('booking-step-1');
const bookingStep2 = document.getElementById('booking-step-2');
const bookingStep3 = document.getElementById('booking-step-3');

const stepIndicator1 = document.getElementById('step-indicator-1');
const stepIndicator2 = document.getElementById('step-indicator-2');
const stepIndicator3 = document.getElementById('step-indicator-3');
const wizardProgressLine = document.getElementById('wizard-progress-line');

function resetBookingWizard() {
    bookingStep1.style.display = 'block';
    bookingStep2.style.display = 'none';
    bookingStep3.style.display = 'none';
    
    stepIndicator1.querySelector('.step-num').style.background = 'var(--accent-color)';
    stepIndicator1.querySelector('.step-num').style.borderColor = 'var(--accent-color)';
    stepIndicator1.querySelector('p').style.color = 'var(--text-primary)';
    
    [stepIndicator2, stepIndicator3].forEach(indicator => {
        indicator.querySelector('.step-num').style.background = 'rgba(15, 23, 42, 0.8)';
        indicator.querySelector('.step-num').style.borderColor = 'var(--border-color)';
        indicator.querySelector('p').style.color = 'var(--text-secondary)';
    });
    
    wizardProgressLine.style.width = '0%';
    
    bookingSearchInput.value = '';
    bookingSearchResult.style.display = 'none';
    bookingNewName.value = '';
    bookingNewAge.value = '';
    bookingNewContact.value = '';
    bookingPhotoBase64 = null;
    bookingPhotoPreview.src = '/static/placeholder.jpg';
    verifiedBookingPatient = null;
    btnBookingNext1.disabled = true;
    
    const dateInput = document.getElementById('booking-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
    
    stopBookingWebcam();
}

// Next Step 1 -> Step 2
document.getElementById('btn-booking-next-1').addEventListener('click', () => {
    bookingStep1.style.display = 'none';
    bookingStep2.style.display = 'block';
    
    stepIndicator2.querySelector('.step-num').style.background = 'var(--accent-color)';
    stepIndicator2.querySelector('.step-num').style.borderColor = 'var(--accent-color)';
    stepIndicator2.querySelector('p').style.color = 'var(--text-primary)';
    wizardProgressLine.style.width = '50%';
});

// Prev Step 2 -> Step 1
document.getElementById('btn-booking-prev-2').addEventListener('click', () => {
    bookingStep2.style.display = 'none';
    bookingStep1.style.display = 'block';
    
    stepIndicator2.querySelector('.step-num').style.background = 'rgba(15, 23, 42, 0.8)';
    stepIndicator2.querySelector('.step-num').style.borderColor = 'var(--border-color)';
    stepIndicator2.querySelector('p').style.color = 'var(--text-secondary)';
    wizardProgressLine.style.width = '0%';
});

// Submit Appointment Booking
const btnSubmitBooking = document.getElementById('btn-submit-booking');
if (btnSubmitBooking) {
    btnSubmitBooking.addEventListener('click', async () => {
        const patientType = document.querySelector('input[name="booking-patient-type"]:checked').value;
        const symptom_category = document.getElementById('booking-symptom-cat').value;
        const symptom_details = document.getElementById('booking-symptom-details').value.trim();
        const appointment_date = document.getElementById('booking-date').value;
        const time_slot = document.getElementById('booking-time-slot').value;
        
        if (!appointment_date || !time_slot) {
            showToast('Please select a date and preferred time slot.', 'warning');
            return;
        }
        
        btnSubmitBooking.disabled = true;
        btnSubmitBooking.innerHTML = '<span class="status-dot" style="background-color: white; box-shadow: none;"></span> Scheduling...';
        
        const payload = {
            patient_type: patientType,
            symptom_category: symptom_category,
            symptom_details: symptom_details,
            appointment_date: appointment_date,
            time_slot: time_slot
        };
        
        if (patientType === 'existing') {
            payload.patient_id = verifiedBookingPatient.id;
        } else {
            payload.name = bookingNewName.value.trim();
            payload.age = parseInt(bookingNewAge.value.trim());
            payload.gender = bookingNewGender.value;
            payload.contact = bookingNewContact.value.trim();
            payload.photo = bookingPhotoBase64;
        }
        
        try {
            const response = await fetch('/api/book_appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            
            if (data.success) {
                showToast('Appointment scheduled successfully!', 'success');
                
                document.getElementById('booking-slip-id').textContent = `#APT-${data.appointment.id}`;
                document.getElementById('booking-slip-patient-name').textContent = data.patient.name;
                document.getElementById('booking-slip-patient-id').textContent = `#${data.patient.id}`;
                document.getElementById('booking-slip-date').textContent = data.appointment.date;
                document.getElementById('booking-slip-time').textContent = data.appointment.time_slot;
                document.getElementById('booking-slip-doctor').textContent = data.appointment.doctor;
                document.getElementById('booking-slip-room-fees').textContent = `${data.appointment.room} | Fee: ₹${data.appointment.fees}`;
                
                bookingStep2.style.display = 'none';
                bookingStep3.style.display = 'block';
                
                stepIndicator3.querySelector('.step-num').style.background = 'var(--accent-color)';
                stepIndicator3.querySelector('.step-num').style.borderColor = 'var(--accent-color)';
                stepIndicator3.querySelector('p').style.color = 'var(--text-primary)';
                wizardProgressLine.style.width = '100%';
            } else {
                showToast(data.message || 'Booking failed.', 'error');
            }
        } catch (err) {
            showToast('Network error during booking.', 'error');
        } finally {
            btnSubmitBooking.disabled = false;
            btnSubmitBooking.innerHTML = 'Confirm & Book <i data-lucide="check-circle"></i>';
            lucide.createIcons();
        }
    });
}

// Print Slip
const btnBookingPrintSlip = document.getElementById('btn-booking-print-slip');
if (btnBookingPrintSlip) {
    btnBookingPrintSlip.addEventListener('click', () => {
        document.body.classList.add('print-mode-appointment');
        window.print();
        document.body.classList.remove('print-mode-appointment');
    });
}

// Finish Booking
const btnBookingFinish = document.getElementById('btn-booking-finish');
if (btnBookingFinish) {
    btnBookingFinish.addEventListener('click', () => {
        showScreen('home');
    });
}

// Print Prescription (Doctor Dashboard)
const btnPrintPrescTrigger = document.getElementById('btn-print-presc-trigger');
if (btnPrintPrescTrigger) {
    btnPrintPrescTrigger.addEventListener('click', () => {
        document.body.classList.add('print-mode-prescription');
        window.print();
        document.body.classList.remove('print-mode-prescription');
    });
}

// --- RECEPTIONIST DASHBOARD APPOINTMENTS TAB ---
const recepTabAppointments = document.getElementById('recep-tab-appointments');
const recepAppointmentsSection = document.getElementById('recep-appointments-section');

if (recepTabAppointments) {
    recepTabAppointments.addEventListener('click', () => {
        document.getElementById('recep-tab-patients').style.background = 'rgba(255,255,255,0.05)';
        document.getElementById('recep-tab-patients').style.color = 'var(--text-secondary)';
        document.getElementById('recep-tab-patients').style.border = '1px solid rgba(255,255,255,0.1)';
        
        document.getElementById('recep-tab-doctors').style.background = 'rgba(255,255,255,0.05)';
        document.getElementById('recep-tab-doctors').style.color = 'var(--text-secondary)';
        document.getElementById('recep-tab-doctors').style.border = '1px solid rgba(255,255,255,0.1)';
        
        recepTabAppointments.style.background = 'var(--color-accent)';
        recepTabAppointments.style.color = 'white';
        recepTabAppointments.style.border = 'none';
        
        document.getElementById('recep-patients-section').style.display = 'none';
        document.getElementById('recep-doctors-section').style.display = 'none';
        if (recepAppointmentsSection) recepAppointmentsSection.style.display = 'block';
        
        loadScheduledAppointments();
    });
}

document.getElementById('recep-tab-patients').addEventListener('click', () => {
    if (recepAppointmentsSection) recepAppointmentsSection.style.display = 'none';
});
document.getElementById('recep-tab-doctors').addEventListener('click', () => {
    if (recepAppointmentsSection) recepAppointmentsSection.style.display = 'none';
});

async function loadScheduledAppointments() {
    try {
        const response = await fetch('/api/receptionist/appointments');
        const data = await response.json();
        
        const tbody = document.getElementById('receptionist-appointments-table');
        tbody.innerHTML = '';
        
        if (data.success && data.appointments && data.appointments.length > 0) {
            data.appointments.forEach(apt => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                tr.innerHTML = `
                    <td style="padding: 12px 8px;">
                        <span style="font-weight:600; color:var(--text-primary);">${apt.date}</span> <br>
                        <span style="font-size:0.75rem; color:var(--accent-color);">${apt.time_slot}</span>
                    </td>
                    <td style="padding: 12px 8px; font-weight:600; color:var(--text-primary);">${apt.name} (ID: #${apt.patient_id})</td>
                    <td style="padding: 12px 8px;">${apt.age} / ${apt.gender}</td>
                    <td style="padding: 12px 8px;">${apt.contact}</td>
                    <td style="padding: 12px 8px;">${apt.doctor} <br> <span style="font-size:0.75rem; color:var(--text-secondary);">${apt.department}</span></td>
                    <td style="padding: 12px 8px;"><span class="badge" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">${apt.status}</span></td>
                    <td style="padding: 12px 8px; text-align: center;">
                        <button class="btn btn-success btn-sm btn-checkin-apt" data-id="${apt.visit_id}" style="padding: 6px 12px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                            <i data-lucide="check" style="width:12px; height:12px;"></i> Arrived / Check-In
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            document.querySelectorAll('.btn-checkin-apt').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const visitId = e.currentTarget.getAttribute('data-id');
                    try {
                        const res = await fetch('/api/receptionist/appointment/checkin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ visit_id: parseInt(visitId) })
                        });
                        const checkinData = await res.json();
                        if (checkinData.success) {
                            showToast('Patient successfully checked in! Queued for Doctor.', 'success');
                            loadScheduledAppointments();
                        } else {
                            showToast(checkinData.message || 'Check-in failed.', 'error');
                        }
                    } catch (err) {
                        showToast('Error during check-in.', 'error');
                    }
                });
            });
            
            lucide.createIcons();
        } else {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-secondary);">No scheduled appointments found.</td></tr>`;
        }
    } catch (err) {
        showToast('Failed to load scheduled appointments.', 'error');
    }
}

// --- DOCTOR DASHBOARD SCHEDULED APPOINTMENTS ---
async function loadDoctorAppointments(doctorName) {
    const listContainer = document.getElementById('doctor-appointments-list');
    if (!listContainer) return;
    
    try {
        const response = await fetch('/api/receptionist/appointments');
        const data = await response.json();
        
        listContainer.innerHTML = '';
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (data.success && data.appointments) {
            const doctorApts = data.appointments.filter(apt => {
                return (apt.doctor === doctorName || doctorName.toLowerCase().includes(apt.doctor.toLowerCase())) && apt.date === todayStr;
            });
            
            if (doctorApts.length > 0) {
                doctorApts.forEach(apt => {
                    const div = document.createElement('div');
                    div.style.background = 'rgba(255,255,255,0.02)';
                    div.style.border = '1px solid var(--border-color)';
                    div.style.borderRadius = 'var(--radius-sm)';
                    div.style.padding = '10px 12px';
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';
                    div.innerHTML = `
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">${apt.name}</strong> <br>
                            <span style="font-size:0.75rem; color:var(--text-secondary);">Phone: ${apt.contact}</span>
                        </div>
                        <span style="font-size:0.75rem; font-weight:600; color:var(--accent-color); background:rgba(139,92,246,0.1); padding:2px 6px; border-radius:3px;">
                            ${apt.time_slot.split(' - ')[0]}
                        </span>
                    `;
                    listContainer.appendChild(div);
                });
            } else {
                listContainer.innerHTML = `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px 0;">No appointments for today.</p>`;
            }
        }
    } catch (err) {
        console.error('Error loading doctor appointments:', err);
    }
}

// --- RECEPTIONIST VERIFY & CHECK-IN LOGIC ---
let activeVerifyAppointment = null;
let recepFaceStream = null;

const btnRecepAptVerify = document.getElementById('btn-recep-apt-verify');
const recepAptSearchInput = document.getElementById('recep-apt-search-input');
const recepVerifyModalDetails = document.getElementById('recep-verify-modal-details');
const btnRecepConfirmCheckin = document.getElementById('btn-recep-confirm-checkin');

async function verifyAndOpenAptModal(query) {
    if (!query) {
        showToast('Please type an Appointment ID, Patient ID, or Phone.', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/receptionist/appointments');
        const data = await response.json();
        
        if (!data.success || !data.appointments) {
            showToast('Failed to load appointments.', 'error');
            return;
        }
        
        // Find appointment by visit_id, patient_id or contact number
        const apt = data.appointments.find(a => 
            a.visit_id.toString() === query || 
            a.patient_id.toString() === query || 
            a.contact === query ||
            a.name.toLowerCase().includes(query.toLowerCase())
        );
        
        if (apt) {
            activeVerifyAppointment = apt;
            recepVerifyModalDetails.innerHTML = `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 10px;">
                    <h4 style="color: var(--text-primary); margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">Patient Information</h4>
                    <div><span style="color: var(--text-secondary);">Name:</span> <strong style="color: var(--text-primary);">${apt.name}</strong></div>
                    <div><span style="color: var(--text-secondary);">Patient ID:</span> <strong style="color: var(--text-primary);">#${apt.patient_id}</strong></div>
                    <div><span style="color: var(--text-secondary);">Age/Gender:</span> <strong style="color: var(--text-primary);">${apt.age} yrs / ${apt.gender}</strong></div>
                    <div><span style="color: var(--text-secondary);">Contact:</span> <strong style="color: var(--text-primary);">${apt.contact}</strong></div>
                </div>
                
                <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.1); padding: 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 10px;">
                    <h4 style="color: var(--accent-color); margin-bottom: 4px; border-bottom: 1px solid rgba(139, 92, 246, 0.1); padding-bottom: 8px;">Appointment Scheduled Details</h4>
                    <div><span style="color: var(--text-secondary);">Appointment ID:</span> <strong style="color: var(--text-primary);">#APT-${apt.visit_id}</strong></div>
                    <div><span style="color: var(--text-secondary);">Consulting Date:</span> <strong style="color: var(--text-primary);">${apt.date}</strong></div>
                    <div><span style="color: var(--text-secondary);">Time Slot:</span> <strong style="color: var(--text-primary);">${apt.time_slot}</strong></div>
                    <div><span style="color: var(--text-secondary);">Doctor Assigned:</span> <strong style="color: var(--text-primary);">${apt.doctor} (${apt.department})</strong></div>
                    <div><span style="color: var(--text-secondary);">Room & Fee:</span> <strong style="color: var(--text-primary);">${apt.room_number || 'Room N/A'} | Fee: ₹${apt.fees}</strong></div>
                </div>
                
                <div class="status-banner success-banner" style="margin-top: 10px; text-align: center; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 12px; border-radius: var(--radius-sm);">
                    <p style="color: #10b981; font-size: 0.85rem; font-weight: 600; margin: 0;">
                        Patient is authorized to consult Dr. ${apt.doctor} in ${apt.room_number || 'Room N/A'}.
                    </p>
                </div>
            `;
            openModal('modal-recep-apt-verify');
            lucide.createIcons();
        } else {
            showToast('No active scheduled appointment found matching that ID/Phone.', 'error');
        }
    } catch (err) {
        showToast('Error during appointment verification.', 'error');
    }
}

if (btnRecepAptVerify) {
    btnRecepAptVerify.addEventListener('click', () => {
        const query = recepAptSearchInput.value.trim();
        verifyAndOpenAptModal(query);
    });
    // Support pressing Enter key
    recepAptSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = recepAptSearchInput.value.trim();
            verifyAndOpenAptModal(query);
        }
    });
}

if (btnRecepConfirmCheckin) {
    btnRecepConfirmCheckin.addEventListener('click', async () => {
        if (!activeVerifyAppointment) return;
        
        btnRecepConfirmCheckin.disabled = true;
        btnRecepConfirmCheckin.textContent = 'Checking in...';
        
        try {
            const res = await fetch('/api/receptionist/appointment/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visit_id: activeVerifyAppointment.visit_id })
            });
            const checkinData = await res.json();
            if (checkinData.success) {
                showToast(`Check-In Succeeded! Patient is routed to Dr. ${activeVerifyAppointment.doctor} in ${activeVerifyAppointment.room_number}.`, 'success');
                closeModal('modal-recep-apt-verify');
                recepAptSearchInput.value = '';
                loadScheduledAppointments();
            } else {
                showToast(checkinData.message || 'Check-in failed.', 'error');
            }
        } catch (err) {
            showToast('Error checking in appointment.', 'error');
        } finally {
            btnRecepConfirmCheckin.disabled = false;
            btnRecepConfirmCheckin.textContent = 'Confirm & Check-In';
        }
    });
}

// Face scan check-in for receptionist
const btnRecepAptFaceScan = document.getElementById('btn-recep-apt-face-scan');
const recepFaceWebcam = document.getElementById('recep-face-webcam');
const recepFaceCanvas = document.getElementById('recep-face-canvas');
const btnRecepFaceScanCapture = document.getElementById('btn-recep-face-scan-capture');
const btnRecepFaceScanCancel = document.getElementById('btn-recep-face-scan-cancel');
const btnRecepFaceScanClose = document.getElementById('btn-recep-face-scan-close');

async function startRecepFaceScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Webcam requires secure origin (localhost or HTTPS). If on Chromebook, configure Port Forwarding to localhost:5000.', 'error');
        return;
    }
    try {
        recepFaceStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        recepFaceWebcam.srcObject = recepFaceStream;
        openModal('modal-recep-apt-face-scan');
    } catch (err) {
        showToast('Cannot access camera: ' + err.message, 'error');
    }
}

function stopRecepFaceScan() {
    if (recepFaceStream) {
        recepFaceStream.getTracks().forEach(track => track.stop());
        recepFaceStream = null;
    }
    if (recepFaceWebcam) {
        recepFaceWebcam.srcObject = null;
    }
    closeModal('modal-recep-apt-face-scan');
}

if (btnRecepAptFaceScan) {
    btnRecepAptFaceScan.addEventListener('click', startRecepFaceScan);
}

if (btnRecepFaceScanCancel) btnRecepFaceScanCancel.addEventListener('click', stopRecepFaceScan);
if (btnRecepFaceScanClose) btnRecepFaceScanClose.addEventListener('click', stopRecepFaceScan);

if (btnRecepFaceScanCapture) {
    btnRecepFaceScanCapture.addEventListener('click', async () => {
        if (!recepFaceStream) return;
        
        const context = recepFaceCanvas.getContext('2d');
        recepFaceCanvas.width = recepFaceWebcam.videoWidth || 640;
        recepFaceCanvas.height = recepFaceWebcam.videoHeight || 480;
        
        context.save();
        context.translate(recepFaceCanvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(recepFaceWebcam, 0, 0, recepFaceCanvas.width, recepFaceCanvas.height);
        context.restore();
        
        const faceBase64 = recepFaceCanvas.toDataURL('image/jpeg', 0.95);
        
        btnRecepFaceScanCapture.disabled = true;
        btnRecepFaceScanCapture.textContent = 'Verifying Face...';
        
        try {
            const response = await fetch('/api/scan_face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: faceBase64 })
            });
            const data = await response.json();
            
            if (data.success && data.patient) {
                stopRecepFaceScan();
                showToast(`Welcome, ${data.patient.name}! Verifying appointment...`, 'success');
                // Verify if they have a scheduled appointment
                verifyAndOpenAptModal(data.patient.id.toString());
            } else {
                showToast(data.message || 'Face match not found in database.', 'error');
            }
        } catch (err) {
            showToast('Error scanning face.', 'error');
        } finally {
            btnRecepFaceScanCapture.disabled = false;
            btnRecepFaceScanCapture.textContent = 'Capture & Verify';
        }
    });
}


