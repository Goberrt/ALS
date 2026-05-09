# Profile Photo Upload - Architecture & Flow Diagram

## User Interface Layout

### Sidebar (student_sidebar.html)
```
┌─────────────────────────────────┐
│      SIDEBAR HEADER             │
├─────────────────────────────────┤
│  ┌──────────────────────────┐   │
│  │  Profile Photo Header    │   │
│  │  ┌────────────────────┐  │   │
│  │  │                    │  │   │
│  │  │  [Photo/Icon]  📷  │  │   │  ← Click to upload
│  │  │                    │  │   │
│  │  └────────────────────┘  │   │
│  └──────────────────────────┘   │
│    ALS Portal (Student Name)     │
└─────────────────────────────────┘
```

### Profile Page (student_profile.html)
```
┌──────────────────────────────────────────────────┐
│         PROFILE HEADER (Gradient Background)     │
│  ┌────────────┐  Student Full Name               │
│  │            │  ALS Learner                     │
│  │ [Photo]    │  ┌──────────┐ ┌──────────┐      │
│  │            │  │LRN       │ │Birthdate │      │
│  │  Clickable │  └──────────┘ └──────────┘      │
│  │ for upload │  ┌──────────┐ ┌──────────┐      │
│  │            │  │Sex       │ │Contact   │      │
│  └────────────┘  └──────────┘ └──────────┘      │
└──────────────────────────────────────────────────┘

[Other Profile Sections Below - Academic, Personal Info, etc.]
```

## Data Flow Diagram

### Photo Upload Flow
```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
│                                                              │
│  1. Click on profile photo (sidebar or profile header)       │
│     ↓                                                        │
│  2. File input dialog opens (sidebarPhotoInput/photoInput)   │
│     ↓                                                        │
│  3. User selects image file                                 │
│     ↓                                                        │
│  4. handlePhotoUpload() triggered                            │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  CLIENT-SIDE VALIDATION                      │
│                                                              │
│  - File Type Check (JPEG, PNG, GIF, WebP)                   │
│  - File Size Check (Max 5MB)                                │
│  - Show "Uploading..." message                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              SEND TO BACKEND                                 │
│                                                              │
│  POST /api/student-profile/{user_id}/photo                  │
│  Body: FormData with file                                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND PROCESSING (ALS.py)                     │
│                                                              │
│  1. Validate file type & size again                          │
│  2. Generate filename: {user_id}_{timestamp}.{ext}           │
│  3. Create COMPONENTS/PFP/ directory if needed               │
│  4. Save file to COMPONENTS/PFP/                             │
│  5. Get enrollment record for user                           │
│  6. Update als_enrollments_approved.profile_photo            │
│  7. Return filename in response                              │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│           DISPLAY PHOTO (displayPhoto)                       │
│                                                              │
│  1. Set profilePhotoImg.src = /profile-photo/{filename}      │
│  2. Show image, hide placeholder (profile header)            │
│  3. Set sidebarProfilePhoto.src = /profile-photo/{filename}  │
│  4. Show image, hide placeholder (sidebar)                   │
│  5. Update window.currentProfileData.profile_photo           │
└─────────────────────────────────────────────────────────────┘
                         ↓
                   PHOTO DISPLAYED
```

## File Structure

```
ALS project/
├── HTML/
│   └── student_profile.html          [MODIFIED - removed photo section]
├── COMPONENTS/
│   ├── student_sidebar.html          [MODIFIED - added clickable photo]
│   └── PFP/                          [Photo storage location]
│       ├── userid_timestamp1.jpg     ← Photos stored here
│       ├── userid_timestamp2.jpg
│       └── ...
├── JS/
│   └── student_profile.js            [MODIFIED - added photo functions]
├── CSS/
│   ├── student_styles.css            [MODIFIED - sidebar photo styles]
│   └── student_profile.css           [MODIFIED - profile header styles]
└── IMPLEMENTATION_SUMMARY.md         [NEW - this documentation]
```

## Key Components & Functions

### HTML Elements
```javascript
// In profile page
<img id="profilePhotoImg" class="profile-photo-img">
<div id="profilePhotoPlaceholder" class="profile-photo-placeholder">

// In sidebar
<img id="sidebarProfilePhoto" class="profile-photo-header-img">
<div id="profilePhotoHeaderPlaceholder" class="profile-photo-header-placeholder">
<input type="file" id="sidebarPhotoInput" accept="image/*">
<div class="photo-upload-overlay"> 📷 </div>
```

### JavaScript Functions

#### displayPhoto(filename)
- Displays uploaded photo in profile header
- Displays uploaded photo in sidebar
- Shows image, hides placeholder
- Called after successful upload

#### handlePhotoUpload(event)
- Validates file type & size
- Sends POST request to backend
- Updates profile data
- Calls displayPhoto() on success
- Handles errors with user feedback

#### removePhoto()
- Sends DELETE request to backend
- Hides photos and shows placeholders
- Updates profile data
- Shows success/error messages

### CSS Classes

#### Sidebar Photo
```css
.profile-photo-header          /* Circular container */
.profile-photo-header-img      /* Uploaded image */
.profile-photo-header-placeholder  /* Icon placeholder */
.photo-upload-overlay          /* Camera icon on hover */
```

#### Profile Header Photo
```css
.profile-photo                 /* Container */
.profile-photo-img             /* Uploaded image */
.profile-photo-placeholder     /* Icon placeholder */
```

## Database Integration

### Table: als_enrollments_approved
```sql
Column: profile_photo (varchar(255))
Example Value: "user_uuid_20250111_120530.jpg"
```

### API Endpoints Used

1. **GET /api/student-profile/{user_id}**
   - Returns profile data including profile_photo filename
   - Called on profile page load

2. **POST /api/student-profile/{user_id}/photo**
   - Accepts file upload
   - Saves to COMPONENTS/PFP/
   - Updates database
   - Returns filename

3. **DELETE /api/student-profile/{user_id}/photo**
   - Removes photo from database
   - Deletes file from COMPONENTS/PFP/
   - Returns success message

4. **GET /profile-photo/{filename}**
   - Serves photo files from COMPONENTS/PFP/
   - Used in img src attributes

## Validation & Security

### Client-Side Validation
- File type: Only images (JPEG, PNG, GIF, WebP)
- File size: Maximum 5MB
- User feedback on validation errors

### Server-Side Validation (ALS.py)
- File type validation (same as client)
- File size validation (5MB max)
- User authentication (via user_id)
- Safe filename generation with timestamp
- Enrollment record verification

## User Experience Flow

### First Time User (No Photo)
```
User visits profile
    ↓
Sidebar shows user icon placeholder with camera overlay
Profile header shows user icon placeholder
    ↓
User clicks on sidebar profile area
    ↓
File picker opens
    ↓
User selects photo
    ↓
Photo uploads
    ↓
Both locations display uploaded photo
User icon hidden, photo shown
```

### Returning User (Has Photo)
```
User visits profile
    ↓
loadProfileData() fetches data including profile_photo filename
    ↓
displayPhoto() called
    ↓
Both sidebar and profile header show uploaded photo
    ↓
User can click to replace photo
    ↓
Same upload flow as first-time user
```

## Error Handling

### Validation Errors
- Invalid file type → "Invalid file type. Please upload a JPG, PNG, or GIF image."
- File too large → "File size must be less than 5MB."

### Upload Errors
- Network error → "Error uploading photo: [error message]"
- Server error → "Failed to upload photo: [error message]"

### Display Errors
- Missing photo element → Function checks existence before updating
- Missing data → Gracefully shows placeholder

## Browser Compatibility

- Uses standard HTML5 File API
- CSS Grid and Flexbox for layout
- Fetch API for HTTP requests
- Compatible with modern browsers (Chrome, Firefox, Safari, Edge)

## Performance Considerations

- Photos displayed via GET /profile-photo/{filename} for consistency
- Backend serves files efficiently
- Filename stored in database, not blob data
- File size limited to 5MB
- Timestamp in filename prevents conflicts

## Future Enhancements

1. Photo cropping before upload
2. Multiple photo galleries
3. Photo filters/effects
4. Progress bar for large files
5. Drag-and-drop upload support
6. Photo validation with AI (verify face, appropriate content)
